#!/usr/bin/env node
//
// Extract Osakidetza-style multiple-choice questions from a PDF into a
// ready-to-commit question-set file under `src/data/<id>.js`.
//
// Usage:
//   node scripts/pdf-to-questions.js <input.pdf> [options]
//
// Options:
//   --id <id>              Set id (default: slug of --name, or PDF basename).
//   --name <name>          Human-friendly name shown in the picker.
//   --description <text>   Short description shown under the name.
//   --answers <path>       Answer-key file. Flexible format: "1.b 2.a 3.c…",
//                          "1) b", one letter per line, or letters in any
//                          whitespace-separated order. Only a-d are read.
//   --out <path>           Output .js file (default: src/data/<id>.js).
//   --force                Overwrite the output file if it already exists.
//   --print                Print to stdout instead of writing a file.
//   --raw                  Use pdftotext's -raw mode instead of -layout.
//                          Needed for PDFs whose columns break around
//                          option labels (the default -layout floats
//                          `a) b) c) d)` into a separate column).
//
// Requires `pdftotext` (poppler-utils) on PATH.
//   Ubuntu/Debian: sudo apt-get install poppler-utils
//   macOS:         brew install poppler

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------- CLI parsing ----------

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
        } else if (a === '--force') {
            args.force = true;
        } else if (a === '--print') {
            args.print = true;
        } else if (a === '--raw') {
            args.raw = true;
        } else if (a.startsWith('--')) {
            const key = a.slice(2);
            const val = argv[i + 1];
            if (val === undefined || val.startsWith('--')) {
                die(`Missing value for --${key}`);
            }
            args[key] = val;
            i++;
        } else {
            args._.push(a);
        }
    }
    return args;
}

function usage() {
    console.log(
        [
            'Usage: node scripts/pdf-to-questions.js <input.pdf> [options]',
            '',
            'Options:',
            '  --id <id>              Set id (default: slug of --name).',
            '  --name <name>          Human-friendly name (default: PDF basename).',
            '  --description <text>   Short description.',
            '  --answers <path>       Answer-key file (letters a-d).',
            '  --out <path>           Output .js file (default: src/data/<id>.js).',
            '  --force                Overwrite the output file if it exists.',
            '  --print                Print the generated file to stdout.',
            '  --raw                  Use pdftotext -raw (for column-break PDFs).',
            ''
        ].join('\n')
    );
}

function die(msg, code = 1) {
    console.error('Error: ' + msg);
    process.exit(code);
}

// ---------- Utils ----------

function slug(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function runPdftotext(pdfPath, { raw = false } = {}) {
    const mode = raw ? '-raw' : '-layout';
    try {
        return execFileSync(
            'pdftotext',
            [mode, '-enc', 'UTF-8', pdfPath, '-'],
            {
                encoding: 'utf8',
                maxBuffer: 64 * 1024 * 1024
            }
        );
    } catch (e) {
        if (e.code === 'ENOENT') {
            console.error('Error: `pdftotext` was not found on PATH.');
            console.error('Install poppler-utils:');
            console.error(
                '  Ubuntu/Debian: sudo apt-get install poppler-utils'
            );
            console.error('  macOS:         brew install poppler');
            process.exit(127);
        }
        throw e;
    }
}

// ---------- Parser ----------

// Match a question header like "   12.-   Texto…". The dot is optional to
// tolerate typos like "195-" instead of "195.-".
const QUESTION_RE = /^\s*(\d+)\.?-\s+(.*\S)\s*$/;
// Match an option header like "a)   Texto…", "c)  Texto", or bare "d)" with
// the text wrapping onto the next line.
const OPTION_RE = /^\s*([abcd])\)\s*(.*)$/;
// Lines we want to drop outright (page headers/footers, running titles).
// Keep this conservative — we only skip things that cannot be actual content.
const NOISE_RE =
    /^\s*(CELADOR\/?A?|PREGUNTAS|Página\s+\d+|P[áa]gina\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*$/i;

function parseQuestions(text) {
    const lines = text.split(/\r?\n/);
    const questions = [];
    let current = null;
    let mode = null; // 'stem' | 'opt'
    let currentOpt = -1;

    function finalize() {
        if (!current) return;
        if (current.o.length !== 4) {
            throw new Error(
                `Question ${current.n} has ${current.o.length} options, expected 4.`
            );
        }
        // Collapse runs of whitespace in each field.
        current.q = current.q.replace(/\s+/g, ' ').trim();
        current.o = current.o.map((s) => s.replace(/\s+/g, ' ').trim());
        questions.push(current);
        current = null;
        mode = null;
        currentOpt = -1;
    }

    for (const raw of lines) {
        const line = raw.replace(/\s+$/, '');
        if (!line.trim()) {
            // Blank lines separate blocks visually but don't close the question
            // — the next option/question header will switch modes cleanly.
            continue;
        }
        if (NOISE_RE.test(line)) continue;

        const qm = line.match(QUESTION_RE);
        const om = line.match(OPTION_RE);

        if (qm) {
            finalize();
            current = { n: parseInt(qm[1], 10), q: qm[2], o: [] };
            mode = 'stem';
            currentOpt = -1;
        } else if (om) {
            if (!current) continue;
            const expected = 'abcd'[current.o.length];
            if (om[1] !== expected) {
                throw new Error(
                    `Question ${current.n}: expected option ${expected}), got ${om[1]}).`
                );
            }
            current.o.push((om[2] || '').trim());
            mode = 'opt';
            currentOpt = current.o.length - 1;
        } else {
            // Continuation of the current stem or option.
            if (!current) continue;
            const cont = line.trim();
            if (mode === 'stem') {
                current.q += ' ' + cont;
            } else if (mode === 'opt' && currentOpt >= 0) {
                current.o[currentOpt] += ' ' + cont;
            }
        }
    }
    finalize();

    // Sanity: question numbers should be contiguous from 1.
    for (let i = 0; i < questions.length; i++) {
        if (questions[i].n !== i + 1) {
            console.warn(
                `Warning: question at position ${i + 1} is numbered ${questions[i].n}.`
            );
        }
    }
    return questions;
}

// ---------- Answer key ----------

function parseAnswers(filePath, expected) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const letters = new Array(expected).fill(null);

    // Try numbered parse first (e.g. "1) b", "1.b", "1 - b", "1\tb").
    const numbered = /^\s*\d+\s*[.)\-:\t ]+\s*[abcdABCD]\b/m.test(raw);
    if (numbered) {
        const re = /(\d+)\s*[.)\-:\t ]+\s*([abcdABCD])\b/g;
        let m;
        while ((m = re.exec(raw)) !== null) {
            const idx = parseInt(m[1], 10) - 1;
            if (idx >= 0 && idx < expected) {
                letters[idx] = m[2].toLowerCase();
            }
        }
    } else {
        // Fall back to "collect letters in order".
        const re = /\b([abcdABCD])\b/g;
        let m;
        let i = 0;
        while ((m = re.exec(raw)) !== null && i < expected) {
            letters[i++] = m[1].toLowerCase();
        }
    }

    const missing = letters
        .map((v, i) => (v ? null : i + 1))
        .filter((x) => x !== null);
    if (missing.length) {
        throw new Error(
            `Answer key is missing entries for questions: ${missing.join(', ')}`
        );
    }
    return letters.map((l) => 'abcd'.indexOf(l));
}

// ---------- Emitter ----------

function jsStr(s) {
    // Output as a double-quoted JS string. Unicode is preserved as-is.
    return (
        '"' +
        String(s)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r?\n/g, '\\n') +
        '"'
    );
}

function formatSet(meta, questions) {
    const lines = [];
    lines.push('// Generated by scripts/pdf-to-questions.js.');
    lines.push('// Re-run the extractor to refresh.');
    lines.push(
        '// Format per item: { q: String, o: [a,b,c,d], a: Number (0..3 correct index) }'
    );
    lines.push('(window.QUESTION_SETS = window.QUESTION_SETS || []).push({');
    lines.push(`  id: ${jsStr(meta.id)},`);
    lines.push(`  name: ${jsStr(meta.name)},`);
    lines.push(`  description: ${jsStr(meta.description || '')},`);
    lines.push('  questions: [');
    questions.forEach((q, i) => {
        const opts = q.o.map(jsStr).join(',');
        const sep = i === questions.length - 1 ? '' : ',';
        lines.push(`    {q:${jsStr(q.q)},o:[${opts}],a:${q.a}}${sep}`);
    });
    lines.push('  ]');
    lines.push('});');
    lines.push('');
    return lines.join('\n');
}

// ---------- Main ----------

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args._.length) {
        usage();
        process.exit(args.help ? 0 : 1);
    }

    const pdfPath = args._[0];
    if (!fs.existsSync(pdfPath)) die(`File not found: ${pdfPath}`);

    const base = path.basename(pdfPath, path.extname(pdfPath));
    const name = args.name || base;
    const id = args.id || slug(name) || slug(base);
    if (!id) die('Could not derive a valid id. Pass --id explicitly.');
    const description = args.description || '';
    const outPath = args.out || path.join('src', 'data', `${id}.js`);

    const text = runPdftotext(pdfPath, { raw: !!args.raw });
    const questions = parseQuestions(text);

    if (!questions.length) die('No questions were parsed from the PDF.');

    let answers = null;
    if (args.answers) {
        try {
            answers = parseAnswers(args.answers, questions.length);
        } catch (e) {
            die(e.message);
        }
    }

    const withAnswers = questions.map((q, i) => ({
        q: q.q,
        o: q.o,
        a: answers ? answers[i] : 0
    }));

    const output = formatSet({ id, name, description }, withAnswers);

    // Stdout = set file (when --print); stderr = human-facing messages.
    const log = args.print ? console.error : console.log;

    if (args.print) {
        process.stdout.write(output);
    } else {
        if (fs.existsSync(outPath) && !args.force) {
            die(`Refusing to overwrite ${outPath}. Pass --force to overwrite.`);
        }
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, output);
        log(`✔ Wrote ${questions.length} questions to ${outPath}`);
    }

    if (!answers) {
        log(
            'Note: all answers default to 0 ("a"). Pass --answers <file> to set them.'
        );
    }

    // Remind user to wire up the script tag.
    if (!args.print) {
        log(
            `Next: add  <script src="./data/${id}.js"></script>  to src/index.html`
        );
        log('above <script src="./app.js"></script>.');
    }
}

main();

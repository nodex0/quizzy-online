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

// Match a question header. Stem on the same line is optional — column-broken
// PDFs sometimes emit a bare "124.-" with the stem floating below the labels.
// The dot is optional to tolerate typos like "195-" instead of "195.-".
const QUESTION_RE = /^\s*(\d+)\.?-(?:\s+(.*\S))?\s*$/;
// Match an option header like "a)   Texto…", "c)  Texto", or bare "d)" with
// the text wrapping onto the next line.
const OPTION_RE = /^\s*([abcd])\)\s*(.*)$/;
// Lines we want to drop outright (page headers/footers, running titles).
// Keep this conservative — we only skip things that cannot be actual content.
const NOISE_RE =
    /^\s*(CELADOR\/?A?|ZELADOREA|GALDERAK|PREGUNTAS|Página\s+\d+|P[áa]gina\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*$/i;

// Sentence-end detector for floating-text paragraph splitting. A line that
// ends with `.`, `?`, `!` or an ellipsis closes the current paragraph. This
// works for column-broken option lists where each option is one sentence and
// gets its own line(s) in the PDF — even when the option text starts with
// non-letter characters (e.g. "-logia.").
function endsSentence(line) {
    return /[.!?…]\s*$/.test(line);
}

// Parse one question block (lines between two N.- markers) into {q, o}.
// `firstStem` is the inline stem captured from the marker line (may be empty
// for column-broken PDFs where the stem floats after the labels).
function parseBlock(n, firstStem, blockLines) {
    const lines = blockLines
        .map((l) => l.replace(/\s+$/, ''))
        .filter((l) => !NOISE_RE.test(l));

    const stemParts = firstStem ? [firstStem] : [];
    const labels = []; // { idx, inline: string ('' if bare label) }
    const floating = []; // paragraph strings collected after bare labels
    let phase = 'stem'; // 'stem' | 'opts'
    // Index into `labels` of the most-recent inline label whose text we may
    // still extend with continuation lines. -1 once we leave inline mode
    // (i.e., the most recent label was bare).
    let inlineIdx = -1;
    let curPara = '';

    function flushPara() {
        const t = curPara.trim();
        if (t) floating.push(t);
        curPara = '';
    }

    for (const raw of lines) {
        const line = raw.trim();
        if (!line) {
            flushPara();
            continue;
        }
        const om = line.match(OPTION_RE);
        // Only treat as a label while we still need labels (max 4). After the
        // 4th label, lines like "b) eta c) erantzunak zuzenak dira." are
        // option content, not new labels.
        if (om && labels.length < 4) {
            flushPara();
            phase = 'opts';
            const inline = om[2].trim();
            labels.push({ idx: 'abcd'.indexOf(om[1]), inline });
            inlineIdx = inline ? labels.length - 1 : -1;
            continue;
        }
        if (phase === 'stem') {
            stemParts.push(line);
            continue;
        }
        // phase === 'opts'
        if (inlineIdx >= 0) {
            // Continuation wrap of the most recent inline label.
            labels[inlineIdx].inline += ' ' + line;
        } else {
            // Floating text after a bare label: a paragraph closes the
            // moment its line ends with sentence punctuation.
            curPara += (curPara ? ' ' : '') + line;
            if (endsSentence(line)) flushPara();
        }
    }
    flushPara();

    if (labels.length !== 4) {
        throw new Error(
            `Question ${n}: expected 4 option labels, got ${labels.length}.`
        );
    }
    for (let i = 0; i < 4; i++) {
        if (labels[i].idx !== i) {
            throw new Error(
                `Question ${n}: expected label ${'abcd'[i]}), got ${'abcd'[labels[i].idx]}).`
            );
        }
    }

    const opts = labels.map((l) => l.inline);
    const bareIndices = labels
        .map((l, i) => (l.inline ? -1 : i))
        .filter((x) => x >= 0);

    let stem = stemParts.join(' ').replace(/\s+/g, ' ').trim();
    let pi = 0;
    // Column-break case: bare `N.-` AND exactly bareCount + 1 paragraphs;
    // the first paragraph is the stem, the rest are option texts.
    if (!stem && bareIndices.length && floating.length === bareIndices.length + 1) {
        stem = floating[0];
        pi = 1;
    }
    for (const idx of bareIndices) {
        if (pi >= floating.length) {
            throw new Error(
                `Question ${n}: ran out of paragraphs for bare label ${'abcd'[idx]}).`
            );
        }
        opts[idx] = floating[pi++];
    }
    while (pi < floating.length) {
        // Leftover paragraph: append to the last option (rare; happens when
        // the heuristic over-split an option's text).
        opts[3] += ' ' + floating[pi++];
    }
    return {
        n,
        q: stem,
        o: opts.map((s) => s.replace(/\s+/g, ' ').trim())
    };
}

function parseQuestions(text) {
    const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));

    // First pass: locate question boundaries.
    const starts = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(QUESTION_RE);
        if (m) starts.push({ i, n: parseInt(m[1], 10), firstStem: m[2] || '' });
    }
    if (!starts.length) return [];

    const questions = [];
    for (let s = 0; s < starts.length; s++) {
        const start = starts[s];
        const end = s + 1 < starts.length ? starts[s + 1].i : lines.length;
        const block = lines.slice(start.i + 1, end);
        questions.push(parseBlock(start.n, start.firstStem, block));
    }

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

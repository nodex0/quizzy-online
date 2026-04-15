#!/usr/bin/env node
//
// Apply an answer key to an existing question-set file (src/data/<id>.js),
// rewriting only the `a:N` field of each question line — the stems, options,
// formatting and surrounding content are preserved byte-for-byte.
//
// Usage:
//   node scripts/apply-answers.js <set-file> --answers <path> [--dry-run]
//
// Options:
//   --answers <path>   Answer-key file. Flexible format — same parser as
//                      pdf-to-questions.js: "1 A", "1.b", "1) c", one letter
//                      per line, etc. Only a-d are read.
//   --dry-run          Report changes without writing the file.
//
// Example:
//   node scripts/apply-answers.js src/data/celador.js \
//     --answers answers/celador.txt

'use strict';

const fs = require('fs');

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') args.help = true;
        else if (a === '--dry-run') args.dryRun = true;
        else if (a.startsWith('--')) {
            const key = a.slice(2);
            const val = argv[i + 1];
            if (val === undefined || val.startsWith('--')) {
                die(`Missing value for --${key}`);
            }
            args[key] = val;
            i++;
        } else args._.push(a);
    }
    return args;
}

function usage() {
    console.log(
        [
            'Usage: node scripts/apply-answers.js <set-file> --answers <path> [--dry-run]',
            '',
            'Applies an answer key to an existing question-set JS file,',
            'rewriting only the `a:N` field of each question line.',
            ''
        ].join('\n')
    );
}

function die(msg, code = 1) {
    console.error('Error: ' + msg);
    process.exit(code);
}

// Same flexible parser as scripts/pdf-to-questions.js. Returns an array of
// 0..3 indices, one per expected question.
function parseAnswers(filePath, expected) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const letters = new Array(expected).fill(null);

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

// Match one question-item line: leading indent, `{q:"..."...,a:N}` with an
// optional trailing comma. The `a:N` at the tail is the only part we rewrite.
// The dotall-ish middle uses a lazy capture terminated by `,a:` to avoid
// cross-line matches (ripgrep/JS regex on a single line).
const ITEM_RE = /^(\s*\{q:.*,a:)([0-3])(\},?)\s*$/;

function rewrite(source, answers) {
    const lines = source.split(/\r?\n/);
    let itemIdx = 0;
    let changed = 0;
    const mismatches = [];

    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(ITEM_RE);
        if (!m) continue;
        if (itemIdx >= answers.length) {
            throw new Error(
                `Found more question lines than answer entries (line ${i + 1}).`
            );
        }
        const oldA = parseInt(m[2], 10);
        const newA = answers[itemIdx];
        if (oldA !== newA) {
            lines[i] = `${m[1]}${newA}${m[3]}`;
            changed++;
            mismatches.push({ n: itemIdx + 1, from: oldA, to: newA });
        }
        itemIdx++;
    }

    if (itemIdx !== answers.length) {
        throw new Error(
            `Question count mismatch: file has ${itemIdx} items, answer key has ${answers.length}.`
        );
    }
    return { text: lines.join('\n'), changed, mismatches };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args._.length) {
        usage();
        process.exit(args.help ? 0 : 1);
    }
    const setPath = args._[0];
    if (!fs.existsSync(setPath)) die(`File not found: ${setPath}`);
    if (!args.answers) die('Missing --answers <path>.');

    const source = fs.readFileSync(setPath, 'utf8');
    const itemCount = (source.match(/^\s*\{q:.*,a:[0-3]\},?\s*$/gm) || [])
        .length;
    if (!itemCount) die(`No question items found in ${setPath}.`);

    const answers = parseAnswers(args.answers, itemCount);
    const { text, changed, mismatches } = rewrite(source, answers);

    if (args.dryRun) {
        console.log(
            `${changed}/${itemCount} answers would change in ${setPath}.`
        );
        for (const m of mismatches.slice(0, 10)) {
            console.log(
                `  Q${m.n}: ${'abcd'[m.from]} → ${'abcd'[m.to]}`
            );
        }
        if (mismatches.length > 10) {
            console.log(`  … and ${mismatches.length - 10} more.`);
        }
        return;
    }

    fs.writeFileSync(setPath, text);
    console.log(`✔ ${setPath}: ${changed}/${itemCount} answers updated.`);
}

main();

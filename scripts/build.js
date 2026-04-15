#!/usr/bin/env node
// Mirror src/ → docs/ for GitHub Pages.
//
// The repo ships two publish paths and they must stay in sync:
//   1. Modern: actions/upload-pages-artifact uploads ./docs (see pages.yml).
//   2. Legacy: "Deploy from branch" in repo settings reads main:/docs directly.
//
// docs/.nojekyll disables Jekyll processing so github-pages gem doesn't try
// (and fail) to SCSS-compile the site. src/ stays the single source of truth.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

function rimraf(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            rimraf(p);
            fs.rmdirSync(p);
        } else {
            fs.unlinkSync(p);
        }
    }
}

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const srcPath = path.join(from, entry.name);
        const dstPath = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(srcPath, dstPath);
        else fs.copyFileSync(srcPath, dstPath);
    }
}

if (!fs.existsSync(SRC)) {
    console.error(`source not found: ${SRC}`);
    process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
rimraf(OUT);
copyDir(SRC, OUT);

// .nojekyll tells GitHub Pages to serve the files verbatim (no Jekyll build),
// which sidesteps the jekyll-sass-converter chdir crash on github-pages v232.
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

console.log(
    `✔ mirrored ${path.relative(ROOT, SRC)}/ → ${path.relative(ROOT, OUT)}/`
);

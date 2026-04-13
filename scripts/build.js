// Build: copy the static src/ tree into docs/ for GitHub Pages deployment.
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const DEST = path.resolve(__dirname, '..', 'docs');

function rimraf(p) {
    if (!fs.existsSync(p)) return;
    for (const entry of fs.readdirSync(p)) {
        const full = path.join(p, entry);
        const stat = fs.lstatSync(full);
        if (stat.isDirectory()) rimraf(full);
        else fs.unlinkSync(full);
    }
    fs.rmdirSync(p);
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
        const s = path.join(src, entry);
        const d = path.join(dest, entry);
        const stat = fs.statSync(s);
        if (stat.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

rimraf(DEST);
copyDir(SRC, DEST);
console.log(`✅  Built ${SRC} → ${DEST}`);

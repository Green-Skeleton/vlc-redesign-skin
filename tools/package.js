// Packs ./skin into dist/VLC-Redesign.vlt: a gzipped ustar archive with a single
// top-level folder, the same layout as VLC's own default.vlt.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const NAME = 'VLC-Redesign';
const stage = path.join(ROOT, 'build', 'package');
const out = path.join(ROOT, 'dist', `${NAME}.vlt`);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
fs.cpSync(path.join(ROOT, 'skin'), path.join(stage, NAME), { recursive: true });
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { force: true });

// Relative paths only: GNU tar (Git Bash) reads "C:\..." as a remote host.
const rel = path.relative(stage, out);
execFileSync('tar', ['--format=ustar', '-czf', rel, NAME], { cwd: stage, stdio: 'inherit' });
console.log(`wrote ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);

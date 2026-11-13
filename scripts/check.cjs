'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
let count = 0;
let failed = false;
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(file); continue; }
    if (!/\.(js|cjs)$/.test(file)) continue;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    count++;
    if (result.status !== 0) {
      failed = true;
      console.error(result.error || result.stderr || `Unable to check ${file}`);
    }
  }
}
visit(root);
console.log(`JavaScript syntax: ${count} files, ${failed ? 'failed' : 'passed'}.`);
process.exitCode = failed ? 1 : 0;

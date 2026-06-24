/**
 * Fail CI if user-facing files still contain em dashes (U+2014).
 * Run: npm run check:no-em-dash
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EM = '\u2014';

const ALLOWLIST = new Set([
  'AGENT-HANDOVER.md',
  'docs/MEDIFORGE-PRODUCT-RULES.md',
  'scripts/replace-em-dashes.mjs',
  'scripts/check-no-em-dash.mjs'
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.netlify', 'vendor']);
const SCAN_EXT = /\.(html|md|js|json|txt)$/i;

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(name.name)) continue;
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, files);
    else if (SCAN_EXT.test(name.name)) files.push(full);
  }
  return files;
}

const errors = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  if (rel.startsWith('js/vendor/')) continue;
  if (ALLOWLIST.has(rel)) continue;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(EM)) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes(EM)) errors.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`);
  });
}

if (errors.length) {
  console.error(`check:no-em-dash: ${errors.length} em dash(es) found. Use colons instead. Fix: node scripts/replace-em-dashes.mjs\n`);
  errors.slice(0, 30).forEach((e) => console.error(e));
  if (errors.length > 30) console.error(`... and ${errors.length - 30} more`);
  process.exit(1);
}
console.log('check:no-em-dash: OK (no em dashes in scanned files).');

/**
 * Replace em dashes (—) with colons in user-facing and project text files.
 * Run: node scripts/replace-em-dashes.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EM = '\u2014';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.netlify', 'vendor'
]);

const SKIP_FILES = new Set([
  'scripts/replace-em-dashes.mjs',
  'js/vendor/supabase.min.js'
]);

function shouldProcess(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (SKIP_FILES.has(rel)) return false;
  const parts = rel.split('/');
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (/\.(html|md|js|json|txt|ps1|cjs|mjs)$/i.test(rel)) return true;
  return false;
}

function replaceEmDash(text) {
  return text
    .split(` ${EM} `).join(': ')
    .split(EM).join(':');
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (!SKIP_DIRS.has(name.name)) walk(full, files);
    } else if (shouldProcess(full)) {
      files.push(full);
    }
  }
  return files;
}

let changed = 0;
let total = 0;
for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  if (!before.includes(EM)) continue;
  total += 1;
  const after = replaceEmDash(before);
  if (after !== before) {
    fs.writeFileSync(file, after, 'utf8');
    changed += 1;
    console.log(path.relative(ROOT, file));
  }
}
console.log(`\nreplace-em-dashes: ${changed} file(s) updated (${total} contained em dashes).`);

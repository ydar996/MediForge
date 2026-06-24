/**
 * Fail CI if user-facing files contain replacement-character or known mojibake.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BAD = '\uFFFD';
const SKIP_DIRS = new Set(['node_modules', '.git', 'js/vendor', 'tests']);
/** Large generated ICD code databases: icd10ca excluded (stable build output). */
const MOJIBAKE_SKIP = new Set(['js/icd10ca.js']);

/** Legacy double-encoding / mojibake icon sequences (UTF-8 read as Latin-1). */
const MOJIBAKE_PATTERNS = [
  { pattern: /Â®/g, label: 'double-encoded registered mark (Â®)' },
  { pattern: /Â²/g, label: 'double-encoded superscript two (Â²)' },
  { pattern: /â€"/g, label: 'mis-encoded en dash (â€")' },
  { pattern: /â€“/g, label: 'mis-encoded en dash (â€“)' },
  { pattern: /Ã©/g, label: 'mis-encoded e-acute (Ã©)' },
  { pattern: /Ã­/g, label: 'mis-encoded i-acute (Ã­)' },
  { pattern: /Ã³/g, label: 'mis-encoded o-acute (Ã³)' },
  { pattern: /âš[\u00a0\u008f]?/g, label: 'mis-encoded warning icon (âš )' },
  { pattern: /â„¹\u008f?/g, label: 'mis-encoded info icon (â„¹)' },
  { pattern: /âŒ/g, label: 'mis-encoded cross mark (âŒ)' },
  { pattern: /â†[\u0090\u008c]?/g, label: 'mis-encoded arrow (â†)' }
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js|css)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function findReplacementCharHits(rel, text) {
  const hits = [];
  if (!text.includes(BAD)) return hits;
  text.split('\n').forEach((line, i) => {
    if (line.includes(BAD)) hits.push(`${rel}:${i + 1}: U+FFFD in ${line.trim().slice(0, 100)}`);
  });
  return hits;
}

function findMojibakeHits(rel, text) {
  const hits = [];
  for (const { pattern, label } of MOJIBAKE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      hits.push(`${rel}:${line}: ${label}`);
      if (hits.length >= 40) return hits;
    }
  }
  return hits;
}

const replacementHits = [];
const mojibakeHits = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  replacementHits.push(...findReplacementCharHits(rel, text));
  if (!MOJIBAKE_SKIP.has(rel) && !rel.startsWith('js/vendor/')) {
    mojibakeHits.push(...findMojibakeHits(rel, text));
  }
}

let failed = false;

if (replacementHits.length) {
  failed = true;
  console.error('Corrupted replacement character (U+FFFD) found:');
  replacementHits.slice(0, 30).forEach((h) => console.error(`  ${h}`));
  if (replacementHits.length > 30) console.error(`  ... and ${replacementHits.length - 30} more`);
}

if (mojibakeHits.length) {
  failed = true;
  console.error('Legacy mojibake sequences found:');
  mojibakeHits.slice(0, 30).forEach((h) => console.error(`  ${h}`));
  if (mojibakeHits.length > 30) console.error(`  ... and ${mojibakeHits.length - 30} more`);
}

if (failed) process.exit(1);

console.log('No U+FFFD or known mojibake sequences in scanned UI files (ICD databases excluded).');

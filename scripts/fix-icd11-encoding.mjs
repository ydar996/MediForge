/**
 * One-off repair for legacy UTF-8 mojibake in js/icd11.js title strings.
 * Run: node scripts/fix-icd11-encoding.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const filePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'js', 'icd11.js');
let text = fs.readFileSync(filePath, 'utf8');

const exact = [
  [
    'Haemoglobin H disease ( â€“ ?/â€“  â€“ included)',
    'Haemoglobin H disease (α–/?/α– α– included)'
  ]
];

for (const [from, to] of exact) {
  if (!text.includes(from)) {
    console.warn(`Warning: exact match not found: ${from.slice(0, 60)}...`);
  }
  text = text.split(from).join(to);
}

const globalReplacements = [
  ['Â®', '®'],
  ['Â²', '²'],
  ['â€“', '–'],
  ['Ã©', 'é'],
  ['Ã­', 'í'],
  ['Ã³', 'ó']
];

for (const [from, to] of globalReplacements) {
  const count = text.split(from).length - 1;
  if (count) {
    text = text.split(from).join(to);
    console.log(`Replaced ${count}x: ${from} -> ${to}`);
  }
}

fs.writeFileSync(filePath, text, 'utf8');
console.log('Updated js/icd11.js');

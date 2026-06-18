/**
 * Replace UTF-8 mojibake icon sequences and lone ? icon placeholders with Font Awesome.
 * Run: node scripts/fix-mojibake-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'js/vendor', 'tests', 'docs']);
const SKIP_FILES = new Set(['js/icd10ca.js']);

const I = {
  warn: '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>',
  info: '<i class="fa-solid fa-circle-info" aria-hidden="true"></i>',
  check: '<i class="fa-solid fa-circle-check" aria-hidden="true"></i>',
  xmark: '<i class="fa-solid fa-circle-xmark" aria-hidden="true"></i>',
  spinner: '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>',
  staff: '<i class="fa-solid fa-user-doctor" aria-hidden="true"></i>',
  back: '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>',
  bullet: '<i class="fa-solid fa-circle" style="font-size:0.35em;vertical-align:middle" aria-hidden="true"></i>',
};

/** Mojibake from UTF-8 emoji/symbols mis-decoded as Latin-1/Windows-1252. */
const MOJIBAKE = [
  [/âš[\u00a0\u008f]?\u008f?/g, `${I.warn} `],
  [/âš•\u008f?/g, `${I.staff} `],
  [/â„¹\u008f?/g, `${I.info} `],
  [/âœ"[\u008f]?/g, `${I.check} `],
  [/âœ[\u201c\u201d"][\u008f]?/g, `${I.check} `],
  [/âŒ/g, `${I.xmark} `],
  [/âŒ/g, `${I.xmark} `],
  [/â³[\u008f]?/g, `${I.spinner} `],
  [/â†[\u0090\u008c]?/g, '→ '],
  [/â†'/g, '→ '],
  [/4,4ââ‚¬â„¢-/g, "4,4'-"],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(html|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function fixQuestionPlaceholders(text) {
  let s = text;
  // Large success icon placeholder (restore-tool)
  s = s.replace(
    /(<div style="font-size:\s*48px;\s*margin-bottom:\s*10px;">)\?(<\/div>)/g,
    `$1${I.check}$2`
  );
  // Event log separators (platform-dashboard-backup)
  s = s.replace(
    /<span style="color: #666; margin: 0 8px;">\?<\/span>/g,
    `<span style="color: #666; margin: 0 8px;" aria-hidden="true">·</span>`
  );
  // Template string list bullets in restore preview
  s = s.replace(/\.map\(name => '\s+\?\s+' \+ name\)/g, ".map(name => '  • ' + name)");
  s = s.replace(/\? This backup looks valid/g, `${I.check} This backup looks valid`);
  // Back-button left arrows
  s = s.replace(/â†[\u0090\u008c]?\s*Back/g, `${I.back} Back`);
  s = s.replace(
    /\$\{prescription\.status === 'signed' \? '(?:âœ.|✓)\s*Signed'/g,
    `\${prescription.status === 'signed' ? '${I.check} Signed'`
  );
  // comprehensive-platform-test result lines referencing corrupted xmark in includes()
  s = s.replace(/r\.includes\('âŒ'\)/g, `r.includes('${I.xmark}')`);
  s = s.replace(/r\.includes\('âŒ'\)/g, `r.includes('${I.xmark}')`);
  return s;
}

function fixFile(filePath) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  if (SKIP_FILES.has(rel)) return false;

  const original = fs.readFileSync(filePath, 'utf8');
  let updated = original;
  for (const [re, rep] of MOJIBAKE) {
    re.lastIndex = 0;
    updated = updated.replace(re, rep);
  }
  updated = fixQuestionPlaceholders(updated);

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    return true;
  }
  return false;
}

let changed = 0;
for (const file of walk(ROOT)) {
  if (fixFile(file)) {
    console.log('fixed:', path.relative(ROOT, file));
    changed += 1;
  }
}

console.log(`fix-mojibake-icons: ${changed} file(s) updated.`);

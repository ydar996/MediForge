#!/usr/bin/env node
/**
 * Inject ui-title-case.js into HTML pages that load styles.css (once per file).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const tag = '<script src="js/ui-title-case.js?v=20260616120000" defer></script>';

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

let updated = 0;
for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('styles.css')) continue;
  if (html.includes('ui-title-case.js')) continue;

  if (html.includes('</head>')) {
    html = html.replace('</head>', `  ${tag}\n</head>`);
  } else if (html.includes('</body>')) {
    html = html.replace('</body>', `  ${tag}\n</body>`);
  } else {
    continue;
  }

  fs.writeFileSync(file, html, 'utf8');
  updated += 1;
}

console.log(`Injected ui-title-case.js into ${updated} HTML file(s).`);

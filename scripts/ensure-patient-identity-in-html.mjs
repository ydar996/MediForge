/**
 * One-time / maintenance: insert js/patient-identity.js immediately after the first
 * <script src=".../patients.js..."> in each app HTML file (idempotent).
 * Run: node scripts/ensure-patient-identity-in-html.mjs
 */
import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TAG = '<script src="js/patient-identity.js?v=20260427160000"></script>';

async function processDir(dir) {
  const names = await readdir(dir, { withFileTypes: true });
  let changed = 0;
  for (const d of names) {
    if (d.name === 'node_modules' || d.name === '.git') continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) {
      if (d.name === 'sync-upgrade-backup-20251021-202245') continue; // archived copies
      changed += await processDir(p);
      continue;
    }
    if (extname(p) !== '.html') continue;
    let s = await readFile(p, 'utf8');
    if (!s.includes('patients.js') || !s.includes('<script')) continue;
    if (s.includes('patient-identity.js')) continue;
    // Insert after first patients.js script tag (same line or multiline)
    const re = /(<script[^>]+src=[^>]*js\/patients\.js[^>]*><\/script>)/i;
    if (!re.test(s)) continue;
    const next = s.replace(re, '$1\n  ' + TAG);
    if (next === s) continue;
    await writeFile(p, next, 'utf8');
    changed++;
    console.log('Patched:', p.replace(/\\/g, '/'));
  }
  return changed;
}

const n = await processDir(root);
console.log('ensure-patient-identity-in-html: files updated:', n);

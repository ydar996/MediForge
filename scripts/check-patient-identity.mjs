/**
 * Build guard: patient-identity module exists + UUID classifier tests (no browser).
 * Run: node scripts/check-patient-identity.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const modPath = join(root, 'js', 'patient-identity.js');

if (!existsSync(modPath)) {
  console.error('check-patient-identity: missing', modPath);
  process.exit(1);
}

const src = readFileSync(modPath, 'utf8');
for (const needle of ['isPatientRowUuid', 'resolveToPatientRowUuid', 'PatientIdentity']) {
  if (!src.includes(needle)) {
    console.error('check-patient-identity: patient-identity.js must contain:', needle);
    process.exit(1);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const table = [
  ['00000000-0000-4000-8000-000000000000', true],
  ['88aaa7f4-e119-4985-96ca-cbdb9922bd5d', true],
  ['MFA-MC9810', false],
  ['MFA0001', false],
  ['MEC0001', false],
  ['John', false]
];
let fail = false;
for (const [s, want] of table) {
  if (UUID_RE.test(s) !== want) {
    console.error('check-patient-identity: UUID_RE mismatch for', JSON.stringify(s), 'want', want, 'got', UUID_RE.test(s));
    fail = true;
  }
}
if (fail) process.exit(1);

console.log('check-patient-identity: OK (module + UUID table)');

#!/usr/bin/env node
/**
 * Remove tribe from collection, storage, and reporting: race only.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();

function patch(rel, transforms) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    console.warn('skip (missing):', rel);
    return;
  }
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  for (const [from, to] of transforms) {
    if (from instanceof RegExp) {
      s = s.replace(from, to);
    } else {
      s = s.split(from).join(to);
    }
  }
  if (s !== before) {
    fs.writeFileSync(file, s);
    console.log('patched:', rel);
  }
}

const readFallbacks = [
  [/patient\.race \|\| patient\.tribe/g, 'patient.race'],
  [/supabasePatient\.race \|\| supabasePatient\.tribe/g, 'supabasePatient.race'],
  [/updated\.race \|\| updated\.tribe/g, 'updated.race'],
  [/payload\.race \|\| payload\.tribe/g, 'payload.race'],
  [/p\.race \|\| p\.tribe/g, 'p.race'],
  [/localPatient\.race \|\| localPatient\.tribe \|\| localPatient\.Tribe/g, 'localPatient.race'],
  [/record\.race \|\| record\.tribe \|\| record\.ethnicity/g, 'record.race'],
  [/record\.race \|\| record\.tribe/g, 'record.race'],
];

// --- patients.js ---
patch('js/patients.js', [
  ...readFallbacks,
  [/^\s*tribe: [^\n]+\n/gm, ''],
  [/patient\.tribe = data\.tribe \|\| patient\.tribe;/g, 'patient.race = data.race || patient.race;'],
  [/patient\.tribe = race;/g, 'patient.race = race;'],
  [/updateData\.tribe = race;/g, ''],
  [/\.select\('middle_name, first_name, last_name, tribe'\)/g, ".select('middle_name, first_name, last_name, race')"],
  [/tribe: supabasePatientUpdate\.tribe/g, 'race: supabasePatientUpdate.race'],
  [/tribe: data\?\.tribe/g, 'race: data?.race'],
  [/tribe: verifyData\.tribe/g, 'race: verifyData.race'],
  [/tribe: patient\.tribe/g, 'race: patient.race'],
  [/tribe: localPatient\.tribe/g, 'race: localPatient.race'],
  [/'localPatient\.tribe': localPatient\.tribe/g, "'localPatient.race': localPatient.race"],
  [/k\.includes\('tribe'\) \|\| k\.includes\('Marital'\) \|\| k\.includes\('Tribe'\)/g, "k.includes('race') || k.includes('Marital') || k.includes('Race')"],
  [/marital_status\/tribe/g, 'marital_status/race'],
  [/id: "tribe", label: "Tribe"/g, 'id: "race", label: "Race"'],
]);

// --- intake / approval / API ---
patch('js/patient-intake.js', [
  [/race: form\.elements\["race"\]\.value\.trim\(\),\s*\n\s*tribe: form\.elements\["race"\]\.value\.trim\(\),/g,
    'race: form.elements["race"].value.trim(),'],
]);

patch('js/patient-intake-approvals.js', [
  ...readFallbacks,
  [/,\s*\n\s*tribe: payload\.race[^\n]*/g, ''],
]);

patch('js/patient-intake-approval-details.js', [
  [/payload\.race \|\| payload\.tribe/g, 'payload.race'],
]);

patch('netlify/functions/secure-supabase.js', [
  ...readFallbacks,
  [/,\s*\n\s*tribe: payload\.race[^\n]*/g, ''],
]);

// --- loaders / sync ---
patch('js/universal-data-loader.js', [
  [/tribe: patient\.tribe \|\| ''/g, "race: patient.race || ''"],
]);

patch('js/patient-sync-recovery.js', [
  [/tribe: patient\.tribe \|\| null/g, 'race: patient.race || null'],
]);

patch('js/main.js', [
  [/supabasePatient\.tribe/g, 'supabasePatient.race'],
  [/Demographics \(email, tribe, etc\.\)/g, 'Demographics (email, race, etc.)'],
  [/tribe: localPatient\.tribe \|\| null/g, 'race: localPatient.race || null'],
  [/tribe: patient\.tribe \|\| ''/g, "race: patient.race || ''"],
]);

// --- backup / interop ---
patch('js/backup.js', [
  [/Marital Status,Tribe,/g, 'Marital Status,Race,'],
  [/escapeCsv\(p\.tribe\)/g, 'escapeCsv(p.race)'],
  [/tribe: patient\.tribe/g, 'race: patient.race'],
]);

patch('js/interoperability.js', [
  [/'Tribe': 'tribe'/g, "'Race': 'race'"],
  [/'Ethnicity': 'tribe'/g, "'Ethnicity': 'race'"],
  [/patient\.tribe = patient\.tribe \|\| 'Other'/g, "patient.race = patient.race || 'Other'"],
  [/patient\.tribe/g, 'patient.race'],
]);

patch('js/log-filter.js', [
  [/'tribe'/g, "'race'"],
]);

patch('comprehensive-backup-analysis.js', [
  [/'tribe'/g, "'race'"],
]);

// --- reporting ---
for (const rel of [
  'disease-analytics.html',
  'conditions-breakdown.html',
  'condition-stats.html',
  'condition-patients.html',
  'js/conditions.js',
  'js/condition-stats.js',
]) {
  patch(rel, readFallbacks);
}

// --- race options ---
patch('js/patient-race-options.js', [
  [/record\.race \|\| record\.tribe \|\| record\.ethnicity/g, 'record.race'],
]);

// --- searchable dropdown: remove dead tribe init ---
patch('js/searchable-dropdown.js', [
  [/if \(selectedValue && selectedText && selectedText !== 'Select Tribe' && selectedText !== 'Select\.\.\.'\)/g,
    "if (selectedValue && selectedText && selectedText !== 'Select Race' && selectedText !== 'Select...')"],
]);

patch('edit-patient.html', [
  [/dob, tribe, address/g, 'dob, race, address'],
]);

console.log('race-only patch complete');

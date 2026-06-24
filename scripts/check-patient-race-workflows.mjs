#!/usr/bin/env node
/**
 * Static validation for patient race field wiring across registration/intake workflows.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];
const passes = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function pass(msg) {
  passes.push(msg);
}

function fail(msg) {
  failures.push(msg);
}

function assertIncludes(rel, needle, label) {
  const content = read(rel);
  if (!content.includes(needle)) {
    fail(`${label}: ${rel} missing "${needle}"`);
    return false;
  }
  pass(`${label}: ${rel}`);
  return true;
}

function assertNotMatch(rel, pattern, label) {
  const content = read(rel);
  if (pattern.test(content)) {
    fail(`${label}: ${rel} still matches ${pattern}`);
    return false;
  }
  pass(`${label}: ${rel}`);
  return true;
}

// HTML: race select + script include
for (const page of ['add-patient.html', 'edit-patient.html', 'patient-intake.html']) {
  assertIncludes(page, 'id="race"', `${page} has race field`);
  assertIncludes(page, 'patient-race-options.js', `${page} loads race options script`);
  assertIncludes(page, 'data-patient-race-help', `${page} has research note placeholder`);
}

// patient-intake.js payload
assertIncludes('js/patient-intake.js', 'form.elements["race"]', 'intake builds race from form');
assertNotMatch(
  'js/patient-intake.js',
  /\btribe\b/,
  'intake payload has no tribe field'
);

// patients.js: race only: no tribe storage or fallbacks
assertNotMatch('js/patients.js', /\btribe\b/, 'patients.js has no tribe references');
assertNotMatch('netlify/functions/secure-supabase.js', /\btribe\b/, 'secure-supabase has no tribe references');

// SQL: tribe column dropped
assertIncludes(
  'supabase/migrations/20260612130000_drop_patient_tribe_column.sql',
  'DROP COLUMN IF EXISTS tribe',
  'drop tribe column migration'
);

// patients.js edit/save
assertIncludes('js/patients.js', 'getElementById("race")', 'patients.js reads race field');
assertNotMatch(
  'js/patients.js',
  /getElementById\("tribe"\)/,
  'patients.js no longer reads tribe DOM id'
);

// secure-supabase intake approval insert
assertIncludes('netlify/functions/secure-supabase.js', 'race: payload.race', 'secure-supabase saves race');

// race options module
assertIncludes('js/patient-race-options.js', 'Declined to Disclose', 'race options include declined');
assertIncludes('js/patient-race-options.js', 'medical research', 'race help note present');

// registration RPC still present
assertIncludes(
  'supabase/migrations/20260612100000_registration_profile_rpc.sql',
  'complete_registration_user_profile',
  'registration profile RPC migration'
);

// SQL migrations for race
assertIncludes('supabase/migrations/20260612110000_add_patient_race_column.sql', 'ADD COLUMN IF NOT EXISTS race', 'race column migration');
assertIncludes('supabase/migrations/20260612120000_intake_approval_race_column.sql', "->> 'race'", 'intake approval race migration');

// intake approval UI
assertIncludes('js/patient-intake-approval-details.js', 'createDetailItem("Race"', 'approval details show Race');

console.log('\nPatient race workflow checks');
console.log('============================');
passes.forEach((p) => console.log('  OK  ', p));
failures.forEach((f) => console.log('  FAIL', f));
console.log(`\n${passes.length} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);

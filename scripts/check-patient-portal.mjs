#!/usr/bin/env node
/**
 * Smoke-test patient portal Supabase tables, RPCs, and RLS prerequisites.
 * Usage: node scripts/check-patient-portal.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or publishable key in env / js/supabase-env.js
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY;
  if (url && key) return { url, key };
  const envPath = join(root, 'js', 'supabase-env.js');
  if (existsSync(envPath)) {
    const src = readFileSync(envPath, 'utf8');
    const urlMatch = src.match(/url:\s*['"]([^'"]+)['"]/);
    const keyMatch = src.match(/publishableKey:\s*['"]([^'"]+)['"]/);
    if (urlMatch?.[1] && keyMatch?.[1]) return { url: urlMatch[1], key: keyMatch[1] };
  }
  return null;
}

const cfg = loadConfig();
if (!cfg) {
  console.error('check-patient-portal: set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or run inject-supabase-env first)');
  process.exit(1);
}

const supabase = createClient(cfg.url, cfg.key);

const tables = [
  'portal_messages',
  'portal_appointment_requests',
  'orders',
  'appointments',
  'prescriptions',
  'discharge_summaries'
];

const rpcs = [
  'portal_patient_send_message',
  'portal_patient_request_results',
  'portal_patient_mark_pickup',
  'portal_patient_request_appointment_cancel',
  'portal_patient_request_appointment_reschedule',
  'portal_patient_request_new_appointment'
];

let failed = 0;

console.log('Patient portal database check');
console.log('============================');

for (const table of tables) {
  const { error } = await supabase.from(table).select('*').limit(1);
  if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
    console.log(`  FAIL  table missing: ${table}`);
    failed++;
  } else if (error) {
    console.log(`  OK    table ${table} (${error.code || 'query blocked: expected without patient JWT'})`);
  } else {
    console.log(`  OK    table ${table}`);
  }
}

for (const rpc of rpcs) {
  const { error } = await supabase.rpc(rpc, {});
  if (error?.message?.includes('Could not find the function')
    || error?.message?.includes('does not exist')) {
    console.log(`  FAIL  RPC missing: ${rpc}`);
    failed++;
  } else {
    console.log(`  OK    RPC ${rpc} (exists; auth errors expected without patient session)`);
  }
}

const orderCols = ['portal_results_status', 'portal_results_published_at', 'patient_pickup_status'];
for (const col of orderCols) {
  const table = col === 'patient_pickup_status' ? 'prescriptions' : 'orders';
  const { error } = await supabase.from(table).select(col).limit(1);
  if (error?.message?.includes(col) && error?.message?.includes('column')) {
    console.log(`  FAIL  column missing: ${table}.${col}`);
    failed++;
  }
}

console.log('');
if (failed) {
  console.log(`${failed} check(s) failed. Run supabase/migrations/RUN_THIS_patient_portal_complete.sql in SQL Editor.`);
  process.exit(1);
}
console.log('All portal objects present. Ensure patient users have auth_user_id + patient_id linked.');

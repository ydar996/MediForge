#!/usr/bin/env node
/**
 * Fetch Supabase security advisors (same source as Dashboard → Database → Linter).
 *
 * Requires:
 *   SUPABASE_ACCESS_TOKEN — Personal access token (Account → Access Tokens)
 *   SUPABASE_PROJECT_REF  — Project ref (Settings → General), e.g. from project URL
 *
 * Usage:
 *   node scripts/fetch-security-advisors.mjs
 *   node scripts/fetch-security-advisors.mjs --filter rls_disabled,policy_exists,sensitive
 *   node scripts/fetch-security-advisors.mjs --json > advisors.json
 */

const FILTER_PRESETS = {
  rls_disabled: 'rls_disabled_in_public',
  policy_exists: 'policy_exists_rls_disabled',
  sensitive: 'sensitive_columns_exposed',
};

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const filterArg = args.find((a) => a.startsWith('--filter='))?.split('=')[1]
  ?? (args.includes('--filter') ? args[args.indexOf('--filter') + 1] : null);

const token =
  process.env.SUPABASE_ACCESS_TOKEN
  ?? process.env.SUPABASE_ACCESS_TOKEN_SECRET;
const projectRef =
  process.env.SUPABASE_PROJECT_REF
  ?? process.env.SUPABASE_PROJECT_ID;

if (!token || !projectRef) {
  console.error(`Missing credentials.

Set environment variables (PowerShell example):
  $env:SUPABASE_ACCESS_TOKEN = "<pat from https://supabase.com/dashboard/account/tokens>"
  $env:SUPABASE_PROJECT_REF = "<ref from Project Settings → General>"

Then run:
  npm run db:security-advisors

Or paste sql-scripts/database-linter-key-advisories.sql into the SQL Editor.
`);
  process.exit(1);
}

const url = new URL(
  `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/advisors/security`
);

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  },
});

if (!res.ok) {
  const body = await res.text();
  console.error(`API ${res.status} ${res.statusText}\n${body}`);
  process.exit(1);
}

const data = await res.json();
let lints = data.lints ?? [];

if (filterArg) {
  const names = new Set();
  for (const part of filterArg.split(',')) {
    const key = part.trim();
    if (FILTER_PRESETS[key]) names.add(FILTER_PRESETS[key]);
    else if (key) names.add(key);
  }
  lints = lints.filter((l) => names.has(l.name));
}

if (jsonOnly) {
  console.log(JSON.stringify({ lints }, null, 2));
  process.exit(0);
}

const byName = {};
for (const lint of lints) {
  byName[lint.name] = (byName[lint.name] ?? 0) + 1;
}

console.log(`Project: ${projectRef}`);
console.log(`Security lints: ${lints.length}${filterArg ? ` (filtered)` : ''}\n`);

if (lints.length === 0) {
  console.log('No matching security advisories — migration likely cleared the targeted checks.');
  process.exit(0);
}

for (const [name, count] of Object.entries(byName).sort()) {
  console.log(`  ${name}: ${count}`);
}
console.log('');

for (const lint of lints.sort((a, b) =>
  (a.name + (a.metadata?.name ?? '')).localeCompare(b.name + (b.metadata?.name ?? ''))
)) {
  const table = lint.metadata?.schema
    ? `${lint.metadata.schema}.${lint.metadata.name}`
    : lint.metadata?.name ?? '—';
  console.log(`[${lint.level}] ${lint.name}`);
  console.log(`  ${lint.title} — ${table}`);
  console.log(`  ${lint.detail}`);
  if (lint.metadata?.sensitive_columns) {
    console.log(`  columns: ${lint.metadata.sensitive_columns.join(', ')}`);
  }
  console.log(`  ${lint.remediation}`);
  console.log('');
}

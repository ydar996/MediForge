#!/usr/bin/env node
/**
 * Unlock permanently locked login rate limits (dev/staging/prod).
 *
 * Requires service role key for the target project:
 *   $env:SUPABASE_URL = "https://hhxsmenuphzfxvgwxvut.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role secret>"
 *   node scripts/unlock-login-rate-limit.mjs ydar102
 *
 * Or pass explicit identifiers:
 *   node scripts/unlock-login-rate-limit.mjs ydar102-8b3d23b6@mediforge.app ydar102@example.com
 */

const url = process.env.SUPABASE_URL || '';
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (!url || !serviceKey) {
  console.error(`Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.

PowerShell (dev example):
  $env:SUPABASE_URL = "https://hhxsmenuphzfxvgwxvut.supabase.co"
  $env:SUPABASE_SERVICE_ROLE_KEY = "<from Supabase → Project Settings → API → service_role>"
  node scripts/unlock-login-rate-limit.mjs ydar102
`);
  process.exit(1);
}

if (args.length === 0) {
  console.error('Usage: node scripts/unlock-login-rate-limit.mjs <username-or-email> [more identifiers...]');
  process.exit(1);
}

const identifiers = new Set();
for (const raw of args) {
  const id = String(raw).trim();
  if (!id) continue;
  identifiers.add(id);
  if (!id.includes('@')) {
    identifiers.add(`${id}@mediforge.app`);
    identifiers.add(`${id}@example.com`);
  } else if (id.includes('@mediforge.app')) {
    identifiers.add(id.split('@')[0]);
  }
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

async function listLocked() {
  const q = `${url}/rest/v1/rate_limits?rate_limit_type=eq.login&permanent_lock=eq.true&select=identifier,attempts,locked_at,permanent_lock`;
  const res = await fetch(q, { headers });
  if (!res.ok) throw new Error(`list locked failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function unlockOne(identifier) {
  const rpc = await fetch(`${url}/rest/v1/rpc/unlock_account`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_identifier: identifier,
      p_unlocked_by: 'scripts/unlock-login-rate-limit.mjs',
      p_reason: 'Manual unlock after failed login lockout',
    }),
  });
  const body = await rpc.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }
  return { identifier, status: rpc.status, result: parsed };
}

console.log('Target:', url);
console.log('Unlocking identifiers:', [...identifiers].join(', '));

const results = [];
for (const id of identifiers) {
  results.push(await unlockOne(id));
}

for (const r of results) {
  const ok = r.result?.success === true;
  console.log(ok ? 'OK' : 'SKIP', r.identifier, typeof r.result === 'object' ? JSON.stringify(r.result) : r.result);
}

const stillLocked = await listLocked();
const relevant = stillLocked.filter((row) =>
  [...identifiers].some((id) => row.identifier === id || row.identifier?.includes(args[0]))
);
if (relevant.length) {
  console.warn('\nStill permanently locked for related identifiers:');
  console.warn(JSON.stringify(relevant, null, 2));
} else {
  console.log('\nNo permanent login locks remain for requested identifiers.');
  console.log('Also clear browser localStorage on mediforge-dev (or hard-refresh after login).');
  console.log('Reset password in Supabase → Authentication → Users if credentials still fail.');
}

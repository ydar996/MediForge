const { execSync } = require('child_process');

const sites = [
  { name: 'dev', id: 'd15040f5-830c-49fc-bd54-10165abcc5e8', ref: 'hhxsmenuphzfxvgwxvut' },
  { name: 'staging', id: 'a0626083-1c07-436e-84a3-ca8555ca632e', ref: null },
  { name: 'prod', id: '06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a', ref: 'fyhtdkotlyyqyrjabojw' },
];

function getEnvVars(siteId) {
  const raw = execSync(`npx netlify api getEnvVars --data "${JSON.stringify({ site_id: siteId }).replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(raw);
}

function upsertProjectRef(siteId, ref) {
  const payload = JSON.stringify({
    site_id: siteId,
    key: 'SUPABASE_PROJECT_REF',
    value: ref,
    context: 'all',
    scope: 'builds',
  });
  execSync(`npx netlify api createEnvVars --data "${payload.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    stdio: 'inherit',
  });
}

for (const site of sites) {
  if (!site.ref) {
    console.log(`skip ${site.name} (ref unknown)`);
    continue;
  }
  try {
    const vars = getEnvVars(site.id);
    const existing = vars.find((v) => v.key === 'SUPABASE_PROJECT_REF');
    if (existing) {
      console.log(`${site.name}: SUPABASE_PROJECT_REF already set`);
      continue;
    }
  } catch (err) {
    console.warn(`${site.name}: could not list env`, err.message);
  }
  try {
    upsertProjectRef(site.id, site.ref);
    console.log(`${site.name}: set SUPABASE_PROJECT_REF=${site.ref}`);
  } catch (err) {
    console.error(`${site.name}: failed`, err.message);
  }
}

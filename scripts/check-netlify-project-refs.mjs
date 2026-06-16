const sites = [
  { name: 'dev', id: 'd15040f5-830c-49fc-bd54-10165abcc5e8' },
  { name: 'staging', id: 'a0626083-1c07-436e-84a3-ca8555ca632e' },
  { name: 'prod', id: '06ef6cf9-280d-4d5f-97a2-7cbfd7586b7a' },
];

for (const site of sites) {
  const res = await fetch(
    `https://api.netlify.com/api/v1/accounts/${process.env.NETLIFY_ACCOUNT_ID || ''}/env?site_id=${site.id}`,
    { headers: { Authorization: `Bearer ${process.env.NETLIFY_AUTH_TOKEN || ''}` } }
  ).catch(() => null);
  if (!res || !res.ok) {
    console.log(site.name, 'use cli');
    continue;
  }
  const vars = await res.json();
  const hit = vars.find((v) => v.key === 'SUPABASE_PROJECT_REF');
  console.log(site.name, hit?.values?.[0]?.value || '(not set)');
}

const sites = [
  { name: 'dev', url: 'https://mediforge-dev.netlify.app/js/supabase-env.js' },
  { name: 'staging', url: 'https://mediforge-staging.netlify.app/js/supabase-env.js' },
  { name: 'prod', url: 'https://mediforge.netlify.app/js/supabase-env.js' },
];

const username = process.argv[2] || 'ydar102';

for (const site of sites) {
  const text = await (await fetch(site.url)).text();
  const url = text.match(/url:\s*"([^"]+)"/)?.[1];
  const key = text.match(/anonKey:\s*"([^"]+)"/)?.[1];
  const ref = url?.match(/https:\/\/([^.]+)/)?.[1];
  const rpc = await fetch(`${url}/rest/v1/rpc/lookup_user_public_login`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_identifier: username, p_type: 'username', p_role: null }),
  });
  const body = await rpc.json();
  const row = Array.isArray(body) ? body[0] : null;
  console.log(site.name, {
    ref,
    found: !!row,
    email: row?.email,
    auth_user_id: row?.auth_user_id,
    temp_password: row?.temp_password ? '(set)' : null,
    password_reset_required: row?.password_reset_required,
  });
}

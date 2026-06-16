const envRes = await fetch('https://mediforge-dev.netlify.app/js/supabase-env.js');
const text = await envRes.text();
const url = text.match(/url:\s*"([^"]+)"/)?.[1];
const key = text.match(/anonKey:\s*"([^"]+)"/)?.[1];
console.log('Supabase URL:', url);
console.log('Key prefix:', key?.slice(0, 20));

if (!url || !key) {
  console.error('Missing Supabase config on dev site');
  process.exit(1);
}

const rpcRes = await fetch(`${url}/rest/v1/rpc/lookup_user_public_login`, {
  method: 'POST',
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    p_identifier: 'ydar102',
    p_type: 'username',
    p_role: null,
  }),
});
const body = await rpcRes.text();
console.log('RPC status:', rpcRes.status);
console.log('RPC body:', body.slice(0, 800));

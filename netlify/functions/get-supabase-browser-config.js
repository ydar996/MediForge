/**
 * Returns browser-safe Supabase config (project URL + publishable key).
 * Used when js/supabase-env.js is missing or corrupted by secret-scan redaction.
 */
const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'public, max-age=300',
};

const { isValidSupabaseUrl, resolveSupabaseUrl } = require('./resolve-supabase-url.cjs');

exports.handler = async () => {
  const url = resolveSupabaseUrl();
  const anonKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!url || !anonKey || !isValidSupabaseUrl(url)) {
    return {
      statusCode: 503,
      headers: HEADERS,
      body: JSON.stringify({ error: 'Supabase browser config not available on this site.' }),
    };
  }

  return {
    statusCode: 200,
    headers: HEADERS,
    body: JSON.stringify({ url, anonKey }),
  };
};

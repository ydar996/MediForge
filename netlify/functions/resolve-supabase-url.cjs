/**
 * Resolve Supabase project URL for Netlify build / functions.
 * SUPABASE_URL is often masked at build time (secret scan); SUPABASE_PROJECT_REF is not.
 */
function isValidSupabaseUrl(url) {
  return (
    typeof url === 'string' &&
    url.startsWith('https://') &&
    !url.includes('*') &&
    url.includes('.supabase.co')
  );
}

function resolveSupabaseUrl(env = process.env) {
  const direct =
    env.SUPABASE_URL ||
    env.VITE_SUPABASE_URL ||
    env.REACT_APP_SUPABASE_URL ||
    env.MEDIFORGE_SUPABASE_URL ||
    '';
  if (isValidSupabaseUrl(direct)) {
    return direct;
  }

  const ref = (env.SUPABASE_PROJECT_REF || '').trim();
  if (/^[a-z0-9]+$/.test(ref)) {
    return `https://${ref}.supabase.co`;
  }

  return '';
}

module.exports = { isValidSupabaseUrl, resolveSupabaseUrl };

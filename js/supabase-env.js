/**
 * MediForge Supabase browser config (publishable key only — safe in the browser).
 *
 * SETUP: Replace the two values below with YOUR Supabase project's values:
 *   url:     Supabase Dashboard -> Project Settings -> API -> Project URL
 *   anonKey: Supabase Dashboard -> Project Settings -> API -> anon / publishable key
 *
 * If you deploy through a Netlify build, scripts/inject-supabase-env.cjs overwrites
 * this file from the SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY environment variables.
 */
(function () {
  if (typeof window === 'undefined') return;
  window.__SUPABASE_CONFIG__ = Object.assign({}, window.__SUPABASE_CONFIG__ || {}, {
    url: "PASTE_YOUR_SUPABASE_URL_HERE",
    anonKey: "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE",
  });
})();

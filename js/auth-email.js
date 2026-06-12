/**
 * Build Supabase Auth email addresses for MediForge staff registration/login.
 * Usernames are for login; Auth requires a unique email per org.
 */
(function () {
  function authEmailDomain() {
    const cfg = typeof window !== 'undefined' ? window.__SUPABASE_CONFIG__ : null;
    return (cfg && cfg.authEmailDomain) || 'mediforge.app';
  }

  function normalizeUsername(value) {
    return String(value || '')
      .normalize('NFKC')
      .trim()
      .replace(/\s+/g, '');
  }

  function normalizeOrgId(value) {
    return String(value || '').replace(/-/g, '').toLowerCase();
  }

  /**
   * @returns {{ ok: true, email: string } | { ok: false, error: string }}
   */
  window.buildMediForgeAuthEmail = function buildMediForgeAuthEmail(username, organizationId) {
    const raw = String(username || '').normalize('NFKC').trim();

    if (!raw) {
      return { ok: false, error: 'Username is required.' };
    }

    if (raw.includes('@')) {
      const email = normalizeUsername(raw).toLowerCase();
      if (!email || /\s/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: 'Enter a valid email address or a username without spaces.' };
      }
      return { ok: true, email };
    }

    const cleanUser = normalizeUsername(raw).toLowerCase();
    if (!cleanUser) {
      return { ok: false, error: 'Username is required.' };
    }
    if (/\s/.test(cleanUser)) {
      return { ok: false, error: 'Username cannot contain spaces. Use letters and numbers only (e.g. ydar102).' };
    }
    if (!/^[a-z0-9._-]+$/i.test(cleanUser)) {
      return {
        ok: false,
        error: 'Username can only contain letters, numbers, dots, underscores, and hyphens.'
      };
    }

    const orgHex = normalizeOrgId(organizationId);
    if (!/^[0-9a-f]{32}$/.test(orgHex)) {
      return { ok: false, error: 'Organization setup failed. Please go back and try again.' };
    }

    const shortOrgId = orgHex.substring(0, 8);
    const email = `${cleanUser}-${shortOrgId}@${authEmailDomain()}`;
    return { ok: true, email };
  };

  window.formatMediForgeAuthError = function formatMediForgeAuthError(message, email) {
    const msg = String(message || '');
    if (/invalid/i.test(msg) && /@mediforge\.app/i.test(email || msg)) {
      return (
        'Registration could not create your login account. Supabase rejected the internal email address. ' +
        'On MediForge Dev: open Supabase → Authentication → Providers → Email → turn OFF "Confirm email", then try again. ' +
        'If it still fails, your admin may need to add Custom SMTP or MX records for mediforge.app.'
      );
    }
    if (/not authorized/i.test(msg)) {
      return (
        'Registration email is not authorized on this Supabase project. ' +
        'Turn off Confirm email in Supabase Auth settings, or configure Custom SMTP for dev.'
      );
    }
    return msg;
  };
})();

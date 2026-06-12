/**
 * Build internal login emails for Supabase Auth. Users only see their username at login.
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
      return { ok: false, error: 'Please enter a username.' };
    }

    if (raw.includes('@')) {
      return {
        ok: false,
        error: 'Please enter a simple username (not an email address). Example: jsmith'
      };
    }

    const cleanUser = normalizeUsername(raw).toLowerCase();
    if (!cleanUser) {
      return { ok: false, error: 'Please enter a username.' };
    }
    if (/\s/.test(cleanUser) || !/^[a-z0-9._-]+$/i.test(cleanUser)) {
      return {
        ok: false,
        error: 'Use a simple username — letters and numbers only, no spaces. Example: jsmith'
      };
    }

    const orgHex = normalizeOrgId(organizationId);
    if (!/^[0-9a-f]{32}$/.test(orgHex)) {
      return { ok: false, error: 'Something went wrong saving your clinic. Please try again.' };
    }

    const shortOrgId = orgHex.substring(0, 8);
    const email = `${cleanUser}-${shortOrgId}@${authEmailDomain()}`;
    return { ok: true, email };
  };

  /** Plain-English errors only — no technical details for clinic staff. */
  window.userFriendlyRegistrationError = function userFriendlyRegistrationError(message) {
    const msg = String(message || '').toLowerCase();

    if (!msg) {
      return 'Please check your details and try again.';
    }
    if (msg.includes('username') && (msg.includes('taken') || msg.includes('already'))) {
      return 'That username is already taken. Please pick another one.';
    }
    if (msg.includes('simple username') || msg.includes('letters and numbers')) {
      return message;
    }
    if (msg.includes('password')) {
      return message;
    }
    if (msg.includes('profile setup failed') || msg.includes('permission denied') || msg.includes('row-level security')) {
      return 'We could not finish setting up your account. Please try registering again in a few minutes. If it keeps failing, contact support.';
    }
    if (msg.includes('invalid') || msg.includes('not authorized') || msg.includes('mediforge.app')) {
      return 'We could not finish creating your login. Please wait a minute and try again. If it still fails, contact support.';
    }
    if (msg.includes('organization') || msg.includes('internet') || msg.includes('connection')) {
      return 'Please check your internet connection and try again.';
    }
    if (msg.length > 120 || msg.includes('@') || msg.includes('supabase')) {
      return 'Registration did not complete. Please try again.';
    }
    return message;
  };

  window.formatMediForgeAuthError = function formatMediForgeAuthError(message) {
    return window.userFriendlyRegistrationError(message);
  };
})();

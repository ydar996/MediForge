/**
 * Staff session guard
 * Patient portal login must never appear as the logged-in identity on staff clinic pages.
 * Portal testing in the same browser backs up the staff session; this restores it on staff pages.
 */
(function staffSessionGuard(global) {
  const USER_KEY = 'user';
  const PATIENT_PORTAL_USER_KEY = 'patient_portal_user';
  const STAFF_USER_BACKUP_KEY = 'staff_user_backup';
  const STAFF_SUPABASE_SESSION_BACKUP_KEY = 'staff_supabase_session_backup';

  function isPatientRole(role) {
    const r = String(role || '').trim().toLowerCase();
    return r === 'patient' || r === 'client' || r === 'client-patient';
  }

  function isStaffLikeUser(user) {
    if (!user || typeof user !== 'object') return false;
    if (!user.username && !user.id && !user.email) return false;
    return !isPatientRole(user.role);
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
      return null;
    }
  }

  function isStaffClinicPath() {
    try {
      const path = String(global.location && global.location.pathname || '').toLowerCase();
      if (!path || path === '/') return true;
      if (
        path.includes('patient-login') ||
        path.includes('patient-portal') ||
        path.includes('patient-dashboard') ||
        path.includes('patient-register') ||
        path.includes('patient-reset') ||
        path.includes('patient-change-password') ||
        path.includes('patient-messages') ||
        path.includes('patient-profile') ||
        path.includes('patient-appointments') ||
        path.includes('patient-medications') ||
        path.includes('patient-results') ||
        path.includes('patient-summary') ||
        path.includes('portal-')
      ) {
        return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  /**
   * Restore staff Supabase JWT from backup (saved before patient portal sign-in).
   * Returns true if a session was applied.
   */
  async function restoreStaffSupabaseSessionFromBackup() {
    const raw = localStorage.getItem(STAFF_SUPABASE_SESSION_BACKUP_KEY);
    if (!raw) return false;
    let stored;
    try {
      stored = JSON.parse(raw);
    } catch (e) {
      return false;
    }
    if (!stored || !stored.access_token || !stored.refresh_token) return false;
    const sb = global.supabaseClient;
    if (!sb || !sb.auth) return false;
    try {
      const { data, error } = await sb.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token
      });
      if (error || !data?.session) {
        console.warn('[staff-session] Could not restore staff Auth session from backup:', error);
        return false;
      }
      localStorage.setItem('supabase_session', JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }));
      console.warn('[staff-session] Restored staff Supabase Auth session after patient portal test.');
      return true;
    } catch (e) {
      console.warn('[staff-session] Auth restore exception:', e);
      return false;
    }
  }

  /**
   * If localStorage.user is a Patient identity on a staff page, restore the staff backup
   * (or clear the patient identity so staff chrome never shows "Patient").
   */
  function restoreStaffSessionIfNeeded() {
    if (!isStaffClinicPath()) return readJson(USER_KEY);

    const current = readJson(USER_KEY) || {};
    if (!isPatientRole(current.role)) {
      return current.username || current.id ? current : null;
    }

    const backup = readJson(STAFF_USER_BACKUP_KEY);
    if (isStaffLikeUser(backup)) {
      localStorage.setItem(USER_KEY, JSON.stringify(backup));
      // Kick off Auth restore (async); billing pages also call ensureStaffSession
      restoreStaffSupabaseSessionFromBackup().catch(() => {});
      console.warn('[staff-session] Restored clinic staff session after patient portal test login.');
      return backup;
    }

    localStorage.removeItem(USER_KEY);
    console.warn('[staff-session] Cleared patient portal identity from staff page session.');
    return null;
  }

  function clearPatientPortalSessionOnStaffLogin() {
    localStorage.removeItem(PATIENT_PORTAL_USER_KEY);
    localStorage.removeItem(STAFF_USER_BACKUP_KEY);
    localStorage.removeItem(STAFF_SUPABASE_SESSION_BACKUP_KEY);
  }

  function formatStaffLoggedInLine(user) {
    if (!user || !isStaffLikeUser(user)) return '';
    const org = user.org || 'Unknown Organization';
    const role = user.role || 'Staff';
    const name = user.username || user.email || 'Staff';
    return `${name} (${role}) from ${org} is logged in`;
  }

  function safeguardLoggedInFooter() {
    if (!isStaffClinicPath()) return;
    const el = document.getElementById('logged-in-info');
    if (!el) return;

    const user = restoreStaffSessionIfNeeded();
    const text = String(el.textContent || el.innerHTML || '');
    const showsPatient = /\(\s*patient\s*\)/i.test(text) || /\bpatient\b.*logged in/i.test(text);

    if (user && isStaffLikeUser(user)) {
      if (showsPatient || !text.trim()) {
        el.textContent = formatStaffLoggedInLine(user);
      }
      return;
    }

    if (showsPatient || (text && /\(.*\) from .* is logged in/i.test(text))) {
      el.textContent = 'Staff login required - please sign in again';
    }
  }

  const restored = restoreStaffSessionIfNeeded();

  global.restoreStaffSessionIfNeeded = restoreStaffSessionIfNeeded;
  global.restoreStaffSupabaseSessionFromBackup = restoreStaffSupabaseSessionFromBackup;
  global.clearPatientPortalSessionOnStaffLogin = clearPatientPortalSessionOnStaffLogin;
  global.isPatientPortalRole = isPatientRole;
  global.getStaffLoggedInDisplayLine = function getStaffLoggedInDisplayLine() {
    const user = restoreStaffSessionIfNeeded();
    return formatStaffLoggedInLine(user);
  };
  global.__staffSessionRestored = restored;

  function runFooterSafeguard() {
    try {
      restoreStaffSessionIfNeeded();
      safeguardLoggedInFooter();
    } catch (e) {
      console.warn('[staff-session] Footer safeguard failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runFooterSafeguard);
  } else {
    runFooterSafeguard();
  }
  setTimeout(runFooterSafeguard, 0);
  setTimeout(runFooterSafeguard, 50);
  setTimeout(runFooterSafeguard, 250);
})(typeof window !== 'undefined' ? window : globalThis);

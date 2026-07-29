/**
 * Staff session guard
 * Patient portal login must never appear as the logged-in identity on staff clinic pages.
 * Portal testing in the same browser backs up the staff session; this restores it on staff pages.
 */
(function staffSessionGuard(global) {
  const USER_KEY = 'user';
  const PATIENT_PORTAL_USER_KEY = 'patient_portal_user';
  const STAFF_USER_BACKUP_KEY = 'staff_user_backup';

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
      // Patient-only surfaces keep the portal session on the shared key
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
      console.warn('[staff-session] Restored clinic staff session after patient portal test login.');
      return backup;
    }

    // No staff backup available — never leave Patient on staff pages
    localStorage.removeItem(USER_KEY);
    console.warn('[staff-session] Cleared patient portal identity from staff page session.');
    return null;
  }

  function clearPatientPortalSessionOnStaffLogin() {
    localStorage.removeItem(PATIENT_PORTAL_USER_KEY);
    localStorage.removeItem(STAFF_USER_BACKUP_KEY);
  }

  function formatStaffLoggedInLine(user) {
    if (!user || !isStaffLikeUser(user)) return '';
    const org = user.org || 'Unknown Organization';
    const role = user.role || 'Staff';
    const name = user.username || user.email || 'Staff';
    return `${name} (${role}) from ${org} is logged in`;
  }

  /**
   * Rewrite #logged-in-info if a page script already painted a Patient role.
   */
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
      el.textContent = 'Staff login required — please sign in again';
    }
  }

  // Run immediately so early inline scripts that re-read localStorage see staff again
  const restored = restoreStaffSessionIfNeeded();

  global.restoreStaffSessionIfNeeded = restoreStaffSessionIfNeeded;
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
  // Catch footers painted by later inline scripts
  setTimeout(runFooterSafeguard, 0);
  setTimeout(runFooterSafeguard, 50);
  setTimeout(runFooterSafeguard, 250);
})(typeof window !== 'undefined' ? window : globalThis);

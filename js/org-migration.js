// Organization Migration Script
// Purpose: Normalize org code property names on localStorage caches.
// Never invent or overwrite codes that already exist under org_code / code / orgCode.
// Supabase organizations.org_code is the source of truth.

(function() {
  'use strict';
  
  const ORG_MIG_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
  const orgMigLog = (...args) => { if (ORG_MIG_VERBOSE) console.log(...args); };

  function resolveOrgCode(orgData) {
    if (!orgData || typeof orgData !== 'object') return '';
    return String(orgData.orgCode || orgData.org_code || orgData.code || '').trim();
  }

  window.resolveOrgCodeFromRecord = resolveOrgCode;

  // Normalize aliases only — do not generate new codes
  function migrateOrganizations() {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    let migrated = false;
    
    for (const [orgName, orgData] of Object.entries(organizations)) {
      if (!orgData || typeof orgData !== 'object') continue;
      const code = resolveOrgCode(orgData);
      if (!code) continue;
      if (orgData.orgCode !== code || orgData.org_code !== code || orgData.code !== code) {
        orgData.orgCode = code;
        orgData.org_code = code;
        orgData.code = code;
        migrated = true;
        orgMigLog(`Normalized org code aliases for "${orgName}": ${code}`);
      }
    }
    
    if (migrated) {
      localStorage.setItem('organizations', JSON.stringify(organizations));
      orgMigLog('Organization code alias normalization completed');
    }
  }
  
  // Display org code on settings/profile pages
  window.displayOrgCode = function(containerId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !user.organization) return;
    
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    const orgData = organizations[user.organization];
    const code = resolveOrgCode(orgData) || String(user.orgCode || '').trim();
    
    if (!code) return;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
      <div style="background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">Organization Code</h3>
        <p style="margin: 0 0 10px 0; color: #666;">Share this code with new staff members:</p>
        <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 3px; color: #155724;">
            ${code}
          </span>
        </div>
        <button onclick="copyOrgCode('${code}')" style="margin-top: 15px; background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
          Copy Code
        </button>
      </div>
    `;
  };
  
  // Copy org code to clipboard
  window.copyOrgCode = function(code) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        alert('Organization code copied to clipboard: ' + code);
      }).catch(() => {
        prompt('Copy this organization code:', code);
      });
    } else {
      prompt('Copy this organization code:', code);
    }
  };
  
  // Run migration on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', migrateOrganizations);
  } else {
    migrateOrganizations();
  }
  
  orgMigLog('Organization migration module loaded');
})();

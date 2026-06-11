// Organization Migration Script
// Purpose: Add organization codes to existing organizations that don't have one

(function() {
  'use strict';
  
  const ORG_MIG_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
  const orgMigLog = (...args) => { if (ORG_MIG_VERBOSE) console.log(...args); };

  // Generate unique organization code
  function generateOrgCode(orgName) {
    const prefix = orgName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X');
    const year = new Date().getFullYear();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${year}-${random}`;
  }
  
  // Check and migrate organizations
  function migrateOrganizations() {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    let migrated = false;
    
    for (const [orgName, orgData] of Object.entries(organizations)) {
      if (!orgData.orgCode) {
        // Generate org code for this organization
        orgData.orgCode = generateOrgCode(orgName);
        orgData.migratedAt = new Date().toISOString();
        migrated = true;
        orgMigLog(`Generated org code for "${orgName}": ${orgData.orgCode}`);
      }
    }
    
    if (migrated) {
      localStorage.setItem('organizations', JSON.stringify(organizations));
      orgMigLog('Organization migration completed');
      
      // Show notification to users about org codes
      showOrgCodeNotification(organizations);
    }
  }
  
  // Show org code to current user if they're the first user of their org
  function showOrgCodeNotification(organizations) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!user || !user.organization) return;
    
    const orgData = organizations[user.organization];
    if (!orgData || !orgData.orgCode) return;
    
    // Check if user has seen the org code notification
    const seenNotifications = JSON.parse(localStorage.getItem('seenOrgCodeNotifications') || '[]');
    if (seenNotifications.includes(user.organization)) return;
    
    // Get all users in this organization
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const orgUsers = users.filter(u => u.organization === user.organization);
    
    // Check if current user is the first/oldest user (likely admin)
    const isFirstUser = orgUsers.length > 0 && orgUsers.sort((a, b) => 
      new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    )[0].username === user.username;
    
    if (isFirstUser || user.role === 'Admin') {
      // Show the org code in a modal or alert
      setTimeout(() => {
        const message = `
📋 ORGANIZATION CODE FOR ${user.organization.toUpperCase()}

Your organization code is: ${orgData.orgCode}

Share this code with new staff members who need to join your organization.
They will need this code when creating their account.

This code has been added to your organization for future user registrations.
        `;
        
        if (confirm(message + '\n\nWould you like to copy this code to clipboard?')) {
          // Copy to clipboard if supported
          if (navigator.clipboard) {
            navigator.clipboard.writeText(orgData.orgCode).then(() => {
              alert('Organization code copied to clipboard!');
            }).catch(() => {
              alert('Code: ' + orgData.orgCode);
            });
          } else {
            alert('Code: ' + orgData.orgCode);
          }
        }
        
        // Mark as seen
        seenNotifications.push(user.organization);
        localStorage.setItem('seenOrgCodeNotifications', JSON.stringify(seenNotifications));
      }, 2000); // Show 2 seconds after page load
    }
  }
  
  // Display org code on settings/profile pages
  window.displayOrgCode = function(containerId) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || !user.organization) return;
    
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    const orgData = organizations[user.organization];
    
    if (!orgData || !orgData.orgCode) return;
    
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
      <div style="background: #e8f5e9; border: 2px solid #4CAF50; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin: 0 0 15px 0; color: #155724;">📋 Organization Code</h3>
        <p style="margin: 0 0 10px 0; color: #666;">Share this code with new staff members:</p>
        <div style="background: white; padding: 15px; border-radius: 6px; text-align: center;">
          <span style="font-size: 28px; font-weight: bold; font-family: monospace; letter-spacing: 3px; color: #155724;">
            ${orgData.orgCode}
          </span>
        </div>
        <button onclick="copyOrgCode('${orgData.orgCode}')" style="margin-top: 15px; background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer;">
          📋 Copy Code
        </button>
      </div>
    `;
  };
  
  // Copy org code to clipboard
  window.copyOrgCode = function(code) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        alert('✅ Organization code copied to clipboard: ' + code);
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



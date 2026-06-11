// Subscription Migration Script
// Purpose: Assign existing organizations to Free Trial plan

(function() {
  'use strict';
  
  const SUB_MIG_VERBOSE = localStorage.getItem('enableVerboseLogs') === 'true';
  const subMigLog = (...args) => { if (SUB_MIG_VERBOSE) console.log(...args); };

  function migrateOrganizationSubscriptions() {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    const plans = JSON.parse(localStorage.getItem('platform_subscription_plans') || '{}');
    let migrated = 0;
    
    for (const [orgName, orgData] of Object.entries(organizations)) {
      if (!orgData.subscription) {
        // Assign Free Trial plan
        const trialDays = plans.free?.trialDays || 30;
        const startDate = new Date(orgData.createdAt || Date.now());
        const expiryDate = new Date(startDate);
        expiryDate.setDate(expiryDate.getDate() + trialDays);
        
        orgData.subscription = {
          currentPlan: 'free',
          planName: 'Free Trial',
          status: 'trial',
          startDate: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          billingCycle: 'monthly',
          autoRenew: false,
          paymentMethod: null,
          lastPayment: null,
          nextBillingDate: null
        };
        
        migrated++;
        subMigLog(`Assigned Free Trial to: ${orgName}, expires: ${expiryDate.toLocaleDateString()}`);
      }
    }
    
    if (migrated > 0) {
      localStorage.setItem('organizations', JSON.stringify(organizations));
      subMigLog(`✅ Migrated ${migrated} organizations to Free Trial plan`);
    }
  }
  
  // Run migration on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(migrateOrganizationSubscriptions, 600);
    });
  } else {
    setTimeout(migrateOrganizationSubscriptions, 600);
  }
  
  subMigLog('Subscription migration module loaded');
})();



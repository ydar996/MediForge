// Subscription Management & Recurring Billing
// Handles automatic invoice generation and subscription enforcement

/**
 * Check all organizations for recurring billing needs
 * Should be called daily (via Supabase Edge Function or scheduled task)
 */
window.checkRecurringBilling = async function() {
  console.log('🔄 [SUBSCRIPTION-MANAGER] Checking for recurring billing...');
  
  const organizations = await window.getAllOrganizations();
  const today = new Date();
  const newInvoices = [];
  
  for (const [orgName, org] of Object.entries(organizations)) {
    if (!org.subscription || !org.subscription.status) continue;
    
    const subscription = org.subscription;
    const nextBillingDate = subscription.nextBillingDate ? new Date(subscription.nextBillingDate) : null;
    const expiryDate = subscription.expiryDate ? new Date(subscription.expiryDate) : null;
    
    // Check if billing date has passed
    if (nextBillingDate && nextBillingDate <= today) {
      console.log(`📅 [SUBSCRIPTION-MANAGER] ${orgName} billing date reached: ${nextBillingDate.toISOString()}`);
      
      // Generate new invoice
      const invoice = await generateRecurringInvoice(orgName, org, subscription);
      if (invoice) {
        newInvoices.push(invoice);
        console.log(`✅ [SUBSCRIPTION-MANAGER] Generated invoice for ${orgName}: ${invoice.id}`);
      }
    }
  }
  
  console.log(`✅ [SUBSCRIPTION-MANAGER] Recurring billing check complete. Generated ${newInvoices.length} invoices.`);
  return newInvoices;
};

/**
 * Generate a recurring invoice for an organization
 */
async function generateRecurringInvoice(orgName, org, subscription) {
  try {
    const plans = JSON.parse(localStorage.getItem('platform_subscription_plans') || '{}');
    const planId = subscription.currentPlan || 'basic';
    const plan = plans[planId];
    
    if (!plan) {
      console.error(`❌ [SUBSCRIPTION-MANAGER] Plan ${planId} not found for ${orgName}`);
      return null;
    }
    
    const billingCycle = subscription.billingCycle || 'monthly';
    const currency = org.currency || org.defaultCurrency || 'CAD';
    const monthlyPrice = plan.prices?.[currency] || 0;
    const amount = billingCycle === 'annual' ? monthlyPrice * 12 * 0.85 : monthlyPrice; // 15% discount for annual
    
    // Generate payment ID
    const generateUUID = () => {
      return 'a' + Date.now().toString(36) + '-' + 
             Math.random().toString(36).substr(2, 4) + '-' + 
             Math.random().toString(36).substr(2, 4) + '-' + 
             Math.random().toString(36).substr(2, 4) + '-' + 
             Math.random().toString(36).substr(2, 12);
    };
    const paymentId = generateUUID();
    
    // Calculate next billing date
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + (billingCycle === 'annual' ? 12 : 1));
    
    // Create payment record
    const payment = {
      id: paymentId,
      date: new Date().toISOString(),
      amount: amount,
      currency: currency,
      method: subscription.paymentMethod || 'bank_transfer',
      status: 'pending',
      billingCycle: billingCycle,
      planName: plan.name,
      isRecurring: true,
      previousPaymentId: subscription.lastPayment?.id
    };
    
    // Update organization subscription
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (organizations[orgName]) {
      organizations[orgName].subscription.lastPayment = payment;
      organizations[orgName].subscription.nextBillingDate = nextBillingDate.toISOString();
      organizations[orgName].subscription.status = 'pending';
      localStorage.setItem('organizations', JSON.stringify(organizations));
    }
    
    // Save to Supabase billing_history
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && org.id) {
      try {
        const { error } = await window.supabaseClient
          .from('billing_history')
          .insert([{
            id: paymentId,
            organization_id: org.id,
            plan_name: plan.name,
            billing_cycle: billingCycle,
            amount: amount,
            currency: currency,
            payment_method: subscription.paymentMethod || 'bank_transfer',
            status: 'pending',
            created_at: new Date().toISOString(),
            invoice_url: null
          }]);
        
        if (error) {
          console.error(`❌ [SUBSCRIPTION-MANAGER] Error saving to billing_history:`, error);
        } else {
          console.log(`✅ [SUBSCRIPTION-MANAGER] Saved invoice to billing_history for ${orgName}`);
        }
      } catch (err) {
        console.error(`❌ [SUBSCRIPTION-MANAGER] Exception saving to Supabase:`, err);
      }
    }
    
    return {
      id: paymentId,
      orgName: orgName,
      amount: amount,
      currency: currency,
      billingCycle: billingCycle,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  } catch (error) {
    console.error(`❌ [SUBSCRIPTION-MANAGER] Error generating invoice for ${orgName}:`, error);
    return null;
  }
}

/**
 * Check all organizations for overdue payments
 * Returns list of organizations that are overdue (for platform admin review)
 * DOES NOT automatically suspend - platform admin must manually suspend
 */
window.checkOverduePayments = async function() {
  console.log('🔒 [SUBSCRIPTION-MANAGER] Checking for overdue payments...');
  
  const organizations = await window.getAllOrganizations();
  const today = new Date();
  const overdueOrgs = [];
  
  for (const [orgName, org] of Object.entries(organizations)) {
    if (!org.subscription || !org.subscription.lastPayment) continue;
    
    const subscription = org.subscription;
    const lastPayment = subscription.lastPayment;
    
    // Only check if payment is pending
    if (lastPayment.status !== 'pending') continue;
    
    // Calculate days overdue
    const paymentDate = new Date(lastPayment.date);
    const daysOverdue = Math.floor((today - paymentDate) / (1000 * 60 * 60 * 24));
    
    // Flag if 15+ days overdue (but don't auto-suspend)
    if (daysOverdue >= 15) {
      overdueOrgs.push({ 
        orgName, 
        org,
        daysOverdue,
        paymentDate: lastPayment.date,
        amount: lastPayment.amount,
        currency: lastPayment.currency
      });
    }
  }
  
  console.log(`✅ [SUBSCRIPTION-MANAGER] Found ${overdueOrgs.length} organizations with overdue payments (15+ days).`);
  return overdueOrgs;
};

/**
 * DEPRECATED: Use checkOverduePayments() instead
 * This function is kept for backward compatibility but does not auto-suspend
 * Platform admin must manually suspend organizations
 */
window.enforceSubscriptionPayments = async function() {
  console.warn('⚠️ [SUBSCRIPTION-MANAGER] enforceSubscriptionPayments() is deprecated. Use checkOverduePayments() and manually suspend via platform admin UI.');
  return await window.checkOverduePayments();
};

/**
 * Suspend an organization for non-payment
 */
async function suspendOrganization(orgName, org, daysOverdue) {
  try {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (!organizations[orgName]) return false;
    
    // Update subscription status
    organizations[orgName].subscription.status = 'suspended';
    organizations[orgName].subscription.suspendedDate = new Date().toISOString();
    organizations[orgName].subscription.suspensionReason = `Payment overdue by ${daysOverdue} days`;
    organizations[orgName].status = 'suspended';
    
    localStorage.setItem('organizations', JSON.stringify(organizations));
    
    // Update Supabase
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && org.id) {
      try {
        // Update organizations table
        const { error: orgError } = await window.supabaseClient
          .from('organizations')
          .update({
            subscription_status: 'suspended',
            status: 'suspended',
            settings: {
              ...(org.settings || {}),
              suspended_date: new Date().toISOString(),
              suspension_reason: `Payment overdue by ${daysOverdue} days`
            }
          })
          .eq('id', org.id);
        
        if (orgError) {
          console.error(`❌ [SUBSCRIPTION-MANAGER] Error updating organization status:`, orgError);
        } else {
          console.log(`✅ [SUBSCRIPTION-MANAGER] Suspended ${orgName} in Supabase`);
        }
        
        // Update subscriptions table if it exists
        const { error: subError } = await window.supabaseClient
          .from('subscriptions')
          .update({
            status: 'suspended'
          })
          .eq('organization_id', org.id);
        
        if (subError && !subError.message.includes('does not exist')) {
          console.error(`❌ [SUBSCRIPTION-MANAGER] Error updating subscription status:`, subError);
        }
      } catch (err) {
        console.error(`❌ [SUBSCRIPTION-MANAGER] Exception updating Supabase:`, err);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ [SUBSCRIPTION-MANAGER] Error suspending ${orgName}:`, error);
    return false;
  }
}

/**
 * Reactivate an organization after payment is approved
 */
window.reactivateOrganization = async function(orgName) {
  try {
    const organizations = JSON.parse(localStorage.getItem('organizations') || '{}');
    if (!organizations[orgName]) return false;
    
    const org = organizations[orgName];
    const subscription = org.subscription;
    
    if (!subscription) return false;
    
    // Calculate new expiry date based on billing cycle
    const billingCycle = subscription.billingCycle || 'monthly';
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + (billingCycle === 'annual' ? 12 : 1));
    
    const nextBillingDate = new Date(expiryDate);
    
    // Update subscription
    subscription.status = 'active';
    subscription.expiryDate = expiryDate.toISOString();
    subscription.nextBillingDate = nextBillingDate.toISOString();
    delete subscription.suspendedDate;
    delete subscription.suspensionReason;
    org.status = 'active';
    
    organizations[orgName] = org;
    localStorage.setItem('organizations', JSON.stringify(organizations));
    
    // Update Supabase
    if (typeof window.supabaseClient !== 'undefined' && window.supabaseClient && org.id) {
      try {
        const { error: orgError } = await window.supabaseClient
          .from('organizations')
          .update({
            subscription_status: 'active',
            status: 'active',
            subscription_expires_at: expiryDate.toISOString()
          })
          .eq('id', org.id);
        
        if (orgError) {
          console.error(`❌ [SUBSCRIPTION-MANAGER] Error reactivating organization:`, orgError);
        } else {
          console.log(`✅ [SUBSCRIPTION-MANAGER] Reactivated ${orgName} in Supabase`);
        }
      } catch (err) {
        console.error(`❌ [SUBSCRIPTION-MANAGER] Exception reactivating:`, err);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`❌ [SUBSCRIPTION-MANAGER] Error reactivating ${orgName}:`, error);
    return false;
  }
};

/**
 * Run subscription checks on page load (for platform admin pages)
 * This is a client-side check - for production, use Supabase Edge Functions or cron jobs
 * NOTE: Does NOT auto-suspend - only checks and reports
 */
window.runSubscriptionChecks = async function() {
  if (typeof window.getAllOrganizations !== 'function') {
    console.warn('⚠️ [SUBSCRIPTION-MANAGER] getAllOrganizations not available');
    return;
  }
  
  // Check for recurring billing
  await window.checkRecurringBilling();
  
  // Check for overdue payments (but don't auto-suspend)
  await window.checkOverduePayments();
};

// Auto-run checks if on platform admin page
if (typeof window !== 'undefined' && window.location.pathname.includes('platform')) {
  window.addEventListener('load', () => {
    // Delay to ensure other scripts are loaded
    setTimeout(() => {
      if (typeof window.getAllOrganizations === 'function') {
        window.runSubscriptionChecks();
      }
    }, 2000);
  });
}

console.log('✅ Subscription Manager loaded');


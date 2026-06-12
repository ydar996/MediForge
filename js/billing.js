// Purpose: Core billing system for MediForge - Cash-first design
// Handles invoices, payments, and cash register management
// Version: v=289 - Refactored to Supabase-first architecture (createInvoice, recordPayment, updateInvoice)

// ==================== DATA MODELS ====================

// Invoice Status: draft, pending, paid, partial, overdue, cancelled
// Payment Method: cash, check, bank_transfer, etransfer, zelle, card, debit, mobile_money, insurance
// Payment Status: completed, pending, failed, refunded

// ==================== STORAGE KEYS ====================

function getBillingKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_${key}`;
}

// ==================== INVOICE MANAGEMENT ====================

// Generate unique invoice number
window.generateInvoiceNumber = async function() {
  try {
    const invoices = await getAllInvoices();
    
    // Force invoices to be an array if it's not
    let safeInvoices = invoices;
    if (!Array.isArray(invoices)) {
      console.warn('⚠️ generateInvoiceNumber: invoices is not an array, converting to empty array');
      safeInvoices = [];
    }
    
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    
    // Find highest number for this year
    let maxNum = 0;
    safeInvoices.forEach(inv => {
      if (inv.invoiceNumber && inv.invoiceNumber.startsWith(prefix)) {
        const num = parseInt(inv.invoiceNumber.split('-')[2]);
        if (num > maxNum) maxNum = num;
      }
    });
    
    const nextNum = (maxNum + 1).toString().padStart(5, '0');
    const invoiceNumber = `${prefix}${nextNum}`;
    return invoiceNumber;
  } catch (error) {
    console.error('❌ Error in generateInvoiceNumber:', error);
    // Fallback invoice number
    const year = new Date().getFullYear();
    const timestamp = Date.now();
    return `INV-${year}-${timestamp}`;
  }
};

// Get all invoices (updated to load from both localStorage and Supabase)
window.getAllInvoices = async function() {
  try {
    const key = getBillingKey('invoices');
    let invoices = [];

    // Load from Supabase FIRST (Supabase is source of truth)
    // Do NOT load from localStorage first - always get fresh data from Supabase
    const supabaseClient = window.supabaseClient;
    if (supabaseClient) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        
        // Resolve organization ID using multiple methods
        let orgId = null;
        
        // Method 1: Try standardized utility
        if (typeof window.resolveOrganizationId === 'function') {
          orgId = await window.resolveOrganizationId();
        }
        
        // Method 2: Try direct user properties
        if (!orgId) {
          orgId = user.organizationId || user.organization_id;
        }
        
        // Method 3: Try to resolve from user.org via organizations object
        if (!orgId && user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = organizations[user.org];
          if (orgData && orgData.id) {
            orgId = orgData.id;
            // Update user object for future use
            user.organizationId = orgId;
            user.organization_id = orgId;
            localStorage.setItem("user", JSON.stringify(user));
          } else if (user.org && user.org.includes('-')) {
            // user.org might already be a UUID
            orgId = user.org;
          }
        }
        
        // Method 4: Query Supabase users table to get organization_id (if username exists)
        if (!orgId && user.username && typeof supabaseClient !== 'undefined' && supabaseClient) {
          try {
            const { data: userData, error: userError } = await supabaseClient
              .from('users')
              .select('organization_id, username, role')
              .eq('username', user.username)
              .limit(1)
              .maybeSingle();
            
            if (!userError && userData && userData.organization_id) {
              orgId = userData.organization_id;
              // Update user object for future use
              user.organizationId = orgId;
              user.organization_id = orgId;
              if (!user.username) user.username = userData.username;
              if (!user.role) user.role = userData.role;
              localStorage.setItem("user", JSON.stringify(user));
            }
          } catch (error) {
            console.error('❌ [BILLING] Error querying Supabase users table:', error);
          }
        }
        
        // Method 5: Get user from Supabase Auth session and query users table
        if (!orgId && typeof supabaseClient !== 'undefined' && supabaseClient) {
          try {
            const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
            
            if (!authError && authUser && authUser.id) {
              // Query users table by auth_user_id
              const { data: userProfile, error: profileError } = await supabaseClient
                .from('users')
                .select('organization_id, username, role, organizations(name)')
                .eq('auth_user_id', authUser.id)
                .limit(1)
                .maybeSingle();
              
              if (!profileError && userProfile) {
                if (userProfile.organization_id) {
                  orgId = userProfile.organization_id;
                  
                  // Reconstruct user object in localStorage
                  const reconstructedUser = {
                    username: userProfile.username,
                    role: userProfile.role,
                    org: userProfile.organizations?.name || null,
                    organizationId: orgId,
                    organization_id: orgId
                  };
                  localStorage.setItem("user", JSON.stringify(reconstructedUser));
                }
              }
            }
          } catch (error) {
            console.error('❌ [BILLING] Error getting user from Supabase Auth:', error);
          }
        }
        
        // If we still don't have orgId, try localStorage fallback
        if (!orgId) {
          const fallback = localStorage.getItem(key);
          if (fallback) {
            invoices = JSON.parse(fallback);
            return invoices;
          } else {
            return [];
          }
        }
        
        if (orgId) {
          // Try 'billing_invoices' table first (where data actually is)
          let supabaseInvoices = null;
          let error = null;
          
          const billingInvoicesResult = await supabaseClient
            .from('billing_invoices')
            .select('*')
            .eq('organization_id', orgId);
          supabaseInvoices = billingInvoicesResult.data;
          error = billingInvoicesResult.error;
          
          // If 'billing_invoices' fails or is empty, try 'invoices' table
          if (error || !supabaseInvoices || supabaseInvoices.length === 0) {
            const invoicesResult = await supabaseClient
              .from('invoices')
              .select('*')
              .eq('organization_id', orgId);
            supabaseInvoices = invoicesResult.data;
            error = invoicesResult.error;
          }
          
          if (error) {
            console.error('❌ [BILLING] Error loading invoices from Supabase:', error);
            // HYBRID ARCHITECTURE: Fall back to localStorage on error
            const fallback = localStorage.getItem(key);
            invoices = fallback ? JSON.parse(fallback) : [];
          } else if (supabaseInvoices && Array.isArray(supabaseInvoices) && supabaseInvoices.length > 0) {
            // Convert Supabase format to localStorage format
            // CRITICAL: Services are stored in billing_invoice_services table, need to fetch separately
            const convertedSupabaseInvoices = await Promise.all(supabaseInvoices.map(async (si) => {
              // CRITICAL: Use invoice_id (client-side ID) as the primary id field
              // This ensures the ID matches what was created (Date.now().toString())
              const clientId = si.invoice_id || si.id;
              
              // Fetch services from billing_invoice_services table
              let services = [];
              if (supabaseClient && si.id) {
                try {
                  const { data: invoiceServices, error: servicesError } = await supabaseClient
                    .from('billing_invoice_services')
                    .select('*')
                    .eq('invoice_id', si.id);
                  
                  if (!servicesError && invoiceServices && Array.isArray(invoiceServices)) {
                    services = invoiceServices.map(svc => ({
                      id: svc.service_id,
                      code: svc.service_code,
                      name: svc.service_name,
                      quantity: svc.quantity || 1,
                      price: parseFloat(svc.price || 0),
                      total: parseFloat(svc.total || 0)
                    }));
                  }
                } catch (e) {
                  console.warn('⚠️ [BILLING] Could not fetch invoice services:', e);
                }
              }
              
              return {
                id: clientId, // Use invoice_id (the client-side ID we created)
                invoice_id: si.invoice_id, // Also keep for reference
                invoiceNumber: si.invoice_number,
                patientId: si.patient_id,
                patientName: si.patient_name || 'Unknown Patient',
                date: si.invoice_date,
                dueDate: si.due_date,
                services: services,
                subtotal: parseFloat(si.subtotal || 0),
                tax: parseFloat(si.tax || si.tax_amount || 0),
                discount: parseFloat(si.discount || si.discount_amount || 0),
                total: parseFloat(si.total || 0),
                amountPaid: parseFloat(si.amount_paid || 0),
                amountDue: parseFloat(si.amount_due || 0),
                status: si.status || 'pending',
                currency: si.currency || 'CAD',
                notes: si.notes || '',
                encounterId: si.encounter_id || null,
                organizationId: si.organization_id
              };
            }));
            
            // HYBRID ARCHITECTURE: Supabase is source of truth - replace localStorage with Supabase data
            invoices = convertedSupabaseInvoices;
            localStorage.setItem(key, JSON.stringify(invoices));
          } else {
            // Supabase query succeeded but returned empty - this is valid (no invoices exist)
            // HYBRID ARCHITECTURE: Only clear localStorage if Supabase explicitly says no data
            // But first check if localStorage has data that might not have synced yet
            const fallback = localStorage.getItem(key);
            const localInvoices = fallback ? JSON.parse(fallback) : [];
            
            if (localInvoices.length > 0) {
              // localStorage has data but Supabase doesn't - keep localStorage as fallback
              invoices = localInvoices;
            } else {
              // Both are empty - this is valid
              invoices = [];
              localStorage.setItem(key, JSON.stringify([]));
            }
          }
        }
      } catch (error) {
        console.error('❌ [BILLING] Exception loading invoices from Supabase:', error);
        // Fallback to localStorage only if Supabase is completely unavailable
        const fallback = localStorage.getItem(key);
        invoices = fallback ? JSON.parse(fallback) : [];
      }
    } else {
      // No Supabase client available - use localStorage as fallback
      const fallback = localStorage.getItem(key);
      invoices = fallback ? JSON.parse(fallback) : [];
    }

    // Final safety check - ensure we always return an array
    if (!Array.isArray(invoices)) {
      console.error('❌ [BILLING] Final invoices is not an array, returning empty array');
      invoices = [];
    }
    return invoices;
  } catch (error) {
    console.error('❌ Critical error in getAllInvoices:', error);
    return []; // Return empty array as fallback
  }
};

// Save invoices
function saveInvoices(invoices) {
  const key = getBillingKey('invoices');
  localStorage.setItem(key, JSON.stringify(invoices));
  
  // Update last modified timestamp
  const metaKey = getBillingKey('meta');
  const meta = JSON.parse(localStorage.getItem(metaKey) || '{}');
  meta.lastModified = new Date().toISOString();
  localStorage.setItem(metaKey, JSON.stringify(meta));
}

// Create new invoice
window.createInvoice = async function(invoiceData) {
  try {
    const invoices = await getAllInvoices();
    
    const invoiceNumber = await generateInvoiceNumber();
    
    const invoice = {
      id: Date.now().toString(),
      invoiceNumber: invoiceNumber,
      patientId: invoiceData.patientId,
      patientName: invoiceData.patientName,
      date: invoiceData.date || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || null,
      services: invoiceData.services || [],
      currency: invoiceData.currency || 'USD',
      subtotal: 0,
      taxRate: invoiceData.taxRate || 0,
      taxAmount: 0,
      discountAmount: invoiceData.discountAmount || 0,
      discountReason: invoiceData.discountReason || '',
      total: 0,
      amountPaid: 0,
      amountDue: 0,
      status: 'pending', // pending, paid, partial, overdue, cancelled
      paymentMethod: invoiceData.paymentMethod || '',
      notes: invoiceData.notes || '',
      encounterId: invoiceData.encounterId || null,
      labOrderId: invoiceData.labOrderId || null, // Link to lab order if applicable
      createdBy: getCurrentUsername(),
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      payments: [] // Array of payment references
    };
    
    // Calculate totals
    invoice.subtotal = calculateSubtotal(invoice.services);
    invoice.taxAmount = invoice.subtotal * (invoice.taxRate / 100);
    invoice.total = invoice.subtotal + invoice.taxAmount - invoice.discountAmount;
    invoice.amountDue = invoice.total;
    
    if (Array.isArray(invoices)) {
      invoices.push(invoice);
      saveInvoices(invoices);
    } else {
      console.error('❌ Invoices is not an array:', invoices);
      throw new Error('Failed to load invoices properly');
    }
    
    // HYBRID ARCHITECTURE: Save to Supabase immediately
    const supabaseClient = window.supabaseClient;
    let orgId = null;
    
    if (typeof window.resolveOrganizationId === 'function') {
      orgId = await window.resolveOrganizationId();
    } else {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      orgId = user.organizationId || user.organization_id;
    }
    
    if (supabaseClient && orgId) {
      try {
        // CRITICAL: billing_invoices table does NOT have a services column
        // Services are stored in billing_invoice_services table separately
        const supabaseInvoice = {
          invoice_id: String(invoice.id), // CRITICAL: Ensure invoice_id is a string to match query
          invoice_number: invoice.invoiceNumber,
          patient_id: invoice.patientId,
          patient_name: invoice.patientName,
          invoice_date: invoice.date,
          due_date: invoice.dueDate,
          // REMOVED: services - not a column in billing_invoices table
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          tax_rate: invoice.taxRate,
          tax_amount: invoice.taxAmount,
          discount_amount: invoice.discountAmount,
          discount_reason: invoice.discountReason,
          total: invoice.total,
          amount_paid: invoice.amountPaid,
          amount_due: invoice.amountDue,
          status: invoice.status,
          payment_method: invoice.paymentMethod || null,
          notes: invoice.notes || null,
          encounter_id: invoice.encounterId || null,
          organization_id: orgId,
          created_by: invoice.createdBy || null
        };
        
        console.log('💾 [BILLING] Saving invoice to Supabase:', {
          invoice_id: supabaseInvoice.invoice_id,
          invoice_number: supabaseInvoice.invoice_number,
          organization_id: orgId
        });
        
        // CRITICAL: Check if invoice number already exists in Supabase before inserting
        // This prevents duplicate key errors on slow connections (race condition fix for tablets/Africa)
        const { data: existingInvoice, error: checkError } = await supabaseClient
          .from('billing_invoices')
          .select('invoice_number, id')
          .eq('invoice_number', supabaseInvoice.invoice_number)
          .eq('organization_id', orgId)
          .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') {
          console.warn('⚠️ [BILLING] Error checking existing invoice number:', checkError);
        }
        
        // If invoice number exists, regenerate a new one
        if (existingInvoice) {
          console.warn('⚠️ [BILLING] Invoice number already exists:', supabaseInvoice.invoice_number, '- regenerating...');
          // Regenerate invoice number with timestamp suffix to ensure uniqueness
          const year = new Date().getFullYear();
          const timestamp = Date.now();
          supabaseInvoice.invoice_number = `INV-${year}-${timestamp}`;
          invoice.invoiceNumber = supabaseInvoice.invoice_number;
          console.log('✅ [BILLING] Generated new unique invoice number:', supabaseInvoice.invoice_number);
        }
        
        const { data: insertedData, error: supabaseError } = await supabaseClient
          .from('billing_invoices')
          .insert(supabaseInvoice)
          .select();
        
        if (supabaseError) {
          // CRITICAL: Handle duplicate key error with retry logic (fixes race condition on slow connections)
          if (supabaseError.message && (
            supabaseError.message.includes('duplicate key') ||
            supabaseError.message.includes('violates unique constraint') ||
            supabaseError.message.includes('invoice_number_key') ||
            supabaseError.code === '23505'
          )) {
            console.warn('⚠️ [BILLING] Duplicate key error detected, retrying with new invoice number...');
            
            // Retry with a new unique invoice number
            const year = new Date().getFullYear();
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substr(2, 6);
            supabaseInvoice.invoice_number = `INV-${year}-${timestamp}-${randomSuffix}`;
            invoice.invoiceNumber = supabaseInvoice.invoice_number;
            
            console.log('🔄 [BILLING] Retrying with new invoice number:', supabaseInvoice.invoice_number);
            
            // Retry insert
            const { data: retryData, error: retryError } = await supabaseClient
              .from('billing_invoices')
              .insert(supabaseInvoice)
              .select();
            
            if (retryError) {
              console.error('❌ [BILLING] Error saving invoice to Supabase after retry:', retryError);
              throw new Error(`Failed to save invoice to Supabase: ${retryError.message}`);
            }
            
            // Update insertedData with retry data
            if (retryData && retryData.length > 0) {
              // Continue with normal flow using retry data
              const insertedInvoice = retryData[0];
              console.log('✅ [BILLING] Invoice saved to Supabase successfully after retry:', {
                invoice_id: insertedInvoice.invoice_id,
                invoice_number: insertedInvoice.invoice_number,
                id: insertedInvoice.id
              });
              
              // Continue with service inserts using retry data
              if (invoice.services && Array.isArray(invoice.services) && invoice.services.length > 0) {
                const serviceInserts = invoice.services.map(service => ({
                  invoice_id: insertedInvoice.id,
                  service_id: service.id || null,
                  service_code: service.code || null,
                  service_name: service.name,
                  quantity: service.quantity || 1,
                  price: service.price,
                  total: service.total || (service.price * (service.quantity || 1))
                }));
                
                const { error: servicesError } = await supabaseClient
                  .from('billing_invoice_services')
                  .insert(serviceInserts);
                
                if (servicesError) {
                  console.error('❌ [BILLING] Error saving invoice services:', servicesError);
                } else {
                  console.log('✅ [BILLING] Invoice services saved successfully');
                }
              }
              
              // Update invoice object with new invoice number
              invoice.invoiceNumber = insertedInvoice.invoice_number;
              return invoice;
            }
          }
          
          console.error('❌ [BILLING] Error saving invoice to Supabase:', supabaseError);
          throw new Error(`Failed to save invoice to Supabase: ${supabaseError.message}`);
        }
        
        if (!insertedData || insertedData.length === 0) {
          console.error('❌ [BILLING] Supabase insert returned no data');
          throw new Error('Invoice insert returned no data from Supabase');
        }
        
        const insertedInvoice = insertedData[0];
        console.log('✅ [BILLING] Invoice saved to Supabase successfully:', {
          invoice_id: insertedInvoice.invoice_id,
          invoice_number: insertedInvoice.invoice_number,
          id: insertedInvoice.id
        });
        
        // CRITICAL: Now save services to billing_invoice_services table
        if (invoice.services && Array.isArray(invoice.services) && invoice.services.length > 0) {
          const serviceInserts = invoice.services.map(service => ({
            invoice_id: insertedInvoice.id, // Use the UUID id from billing_invoices, not invoice_id
            service_id: service.id || null,
            service_code: service.code || null,
            service_name: service.name,
            quantity: service.quantity || 1,
            price: service.price,
            total: service.total || (service.price * (service.quantity || 1))
          }));
          
          const { error: servicesError } = await supabaseClient
            .from('billing_invoice_services')
            .insert(serviceInserts);
          
          if (servicesError) {
            console.error('❌ [BILLING] Error saving invoice services to Supabase:', servicesError);
            // Don't throw - invoice is saved, services can be synced later
          } else {
            console.log('✅ [BILLING] Invoice services saved to Supabase successfully');
          }
        }
      } catch (supabaseErr) {
        console.error('❌ [BILLING] Exception saving invoice to Supabase:', supabaseErr);
        throw supabaseErr; // Re-throw to prevent silent failures
      }
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('invoice_created', `Invoice ${invoice.invoiceNumber} created for patient ${invoice.patientName}`, {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        total: invoice.total
      });
    }
    
    console.log('✅ [BILLING] Invoice created successfully:', {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientName: invoice.patientName,
      total: invoice.total,
      encounterId: invoice.encounterId
    });
    
    // CRITICAL: Ensure invoice is immediately available by refreshing localStorage
    // This helps with immediate lookups after creation
    const refreshedInvoices = await getAllInvoices();
    if (Array.isArray(refreshedInvoices)) {
      const foundInvoice = refreshedInvoices.find(inv => inv.id === invoice.id || inv.invoice_id === invoice.id);
      if (foundInvoice) {
        console.log('✅ [BILLING] Invoice confirmed in refreshed list:', foundInvoice.invoiceNumber);
      } else {
        console.warn('⚠️ [BILLING] Invoice not found in refreshed list immediately after creation');
      }
    }
    
    return invoice;
  } catch (error) {
    console.error('❌ Error creating invoice:', error);
    throw error; // Re-throw to be caught by the calling function
  }
};

// Calculate subtotal from services
function calculateSubtotal(services) {
  return services.reduce((sum, service) => {
    const quantity = parseFloat(service.quantity) || 1;
    const price = parseFloat(service.price) || 0;
    return sum + (quantity * price);
  }, 0);
}

// Convert a single Supabase billing_invoices row (+ services) to client invoice shape
async function convertSupabaseInvoiceToClient(supabaseInvoice, supabaseClient) {
  let services = [];
  if (supabaseClient && supabaseInvoice.id) {
    try {
      const { data: invoiceServices, error: servicesError } = await supabaseClient
        .from('billing_invoice_services')
        .select('*')
        .eq('invoice_id', supabaseInvoice.id);
      if (!servicesError && invoiceServices && Array.isArray(invoiceServices)) {
        services = invoiceServices.map(svc => ({
          id: svc.service_id,
          code: svc.service_code,
          name: svc.service_name,
          quantity: svc.quantity || 1,
          price: parseFloat(svc.price || 0),
          total: parseFloat(svc.total || 0)
        }));
      }
    } catch (e) {
      console.warn('⚠️ [BILLING] Could not fetch invoice services:', e);
    }
  }
  return {
    id: supabaseInvoice.invoice_id || supabaseInvoice.id,
    invoice_id: supabaseInvoice.invoice_id,
    invoiceNumber: supabaseInvoice.invoice_number,
    patientId: supabaseInvoice.patient_id,
    patientName: supabaseInvoice.patient_name || 'Unknown Patient',
    date: supabaseInvoice.invoice_date,
    dueDate: supabaseInvoice.due_date,
    services: services,
    subtotal: parseFloat(supabaseInvoice.subtotal || 0),
    tax: parseFloat(supabaseInvoice.tax_amount || 0),
    taxRate: parseFloat(supabaseInvoice.tax_rate || 0),
    discount: parseFloat(supabaseInvoice.discount_amount || 0),
    discountReason: supabaseInvoice.discount_reason,
    total: parseFloat(supabaseInvoice.total || 0),
    amountPaid: parseFloat(supabaseInvoice.amount_paid || 0),
    amountDue: parseFloat(supabaseInvoice.amount_due || 0),
    status: supabaseInvoice.status || 'pending',
    currency: supabaseInvoice.currency || 'CAD',
    notes: supabaseInvoice.notes || '',
    encounterId: supabaseInvoice.encounter_id || null,
    organizationId: supabaseInvoice.organization_id
  };
}

// Get invoice by ID
window.getInvoiceById = async function(invoiceId) {
  try {
    if (!invoiceId) {
      console.warn('⚠️ [BILLING] getInvoiceById: invoiceId is null or undefined');
      return null;
    }
    
    console.log('🔍 [BILLING] getInvoiceById called with ID:', invoiceId, 'Type:', typeof invoiceId);
    
    // CRITICAL: Try direct Supabase query first (most reliable, especially for newly created invoices)
    const supabaseClient = window.supabaseClient;
    if (supabaseClient) {
      try {
        let orgId = null;
        if (typeof window.resolveOrganizationId === 'function') {
          orgId = await window.resolveOrganizationId();
        } else {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          orgId = user.organizationId || user.organization_id;
        }
        
        if (orgId) {
          // Query Supabase directly by invoice_id (the client-side ID)
          const { data: supabaseInvoice, error: queryError } = await supabaseClient
            .from('billing_invoices')
            .select('*')
            .eq('invoice_id', String(invoiceId))
            .eq('organization_id', orgId)
            .maybeSingle();
          
          if (!queryError && supabaseInvoice) {
            console.log('✅ [BILLING] Found invoice directly in Supabase:', supabaseInvoice.invoice_number);
            return convertSupabaseInvoiceToClient(supabaseInvoice, supabaseClient);
          } else if (queryError) {
            console.warn('⚠️ [BILLING] Supabase query error:', queryError);
          }
        }
        // Fallback: try without org filter (lab scientist org resolution mismatch or empty org)
        const { data: fallbackRow, error: fallbackError } = await supabaseClient
          .from('billing_invoices')
          .select('*')
          .eq('invoice_id', String(invoiceId))
          .maybeSingle();
        if (!fallbackError && fallbackRow) {
          console.log('✅ [BILLING] Found invoice via fallback (by invoice_id only):', fallbackRow.invoice_number);
          return convertSupabaseInvoiceToClient(fallbackRow, supabaseClient);
        }
      } catch (supabaseErr) {
        console.warn('⚠️ [BILLING] Exception querying Supabase directly:', supabaseErr);
      }
    }
    
    // Fallback 1: Try localStorage (might be faster for recently created invoices)
    const key = getBillingKey('invoices');
    const localInvoices = JSON.parse(localStorage.getItem(key) || "[]");
    if (Array.isArray(localInvoices)) {
      const localInvoice = localInvoices.find(inv => 
        String(inv.id) === String(invoiceId) || 
        String(inv.invoice_id) === String(invoiceId) ||
        inv.id === invoiceId ||
        inv.invoice_id === invoiceId
      );
      if (localInvoice) {
        console.log('✅ [BILLING] Found invoice in localStorage:', localInvoice.invoiceNumber);
        return localInvoice;
      }
    }
    
    // Fallback 2: Try getAllInvoices (loads from Supabase and converts)
    const invoices = await getAllInvoices();
    
    if (!Array.isArray(invoices)) {
      console.warn('⚠️ [BILLING] getInvoiceById: invoices is not an array, returning null');
      return null;
    }
    
    console.log('🔍 [BILLING] Searching through', invoices.length, 'invoices. Sample IDs:', invoices.slice(0, 3).map(inv => ({ id: inv.id, invoice_id: inv.invoice_id, invoiceNumber: inv.invoiceNumber })));
    
    // Try multiple ID formats for matching (handle string/number conversion)
    const invoice = invoices.find(inv => {
      const matches = String(inv.id) === String(invoiceId) || 
                      String(inv.invoice_id) === String(invoiceId) ||
                      inv.id === invoiceId ||
                      inv.invoice_id === invoiceId;
      if (matches) {
        console.log('✅ [BILLING] Found matching invoice:', { searched: invoiceId, found: inv.id || inv.invoice_id, invoiceNumber: inv.invoiceNumber });
      }
      return matches;
    });
    
    if (!invoice) {
      console.error('❌ [BILLING] Invoice not found after all attempts!');
      console.error('   Searched ID:', invoiceId, 'Type:', typeof invoiceId);
      console.error('   Available IDs (first 10):', invoices.slice(0, 10).map(inv => ({ id: inv.id, invoice_id: inv.invoice_id, invoiceNumber: inv.invoiceNumber })));
    }
    
    return invoice;
  } catch (error) {
    console.error('❌ [BILLING] Error in getInvoiceById:', error);
    return null;
  }
};

// Get invoice by number
window.getInvoiceByNumber = async function(invoiceNumber) {
  try {
    const invoices = await getAllInvoices();
    
    if (!Array.isArray(invoices)) {
      console.warn('⚠️ getInvoiceByNumber: invoices is not an array, returning null');
      return null;
    }
    
    const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
    return invoice;
  } catch (error) {
    console.error('❌ Error in getInvoiceByNumber:', error);
    return null;
  }
};

// Get invoices by patient ID
window.getInvoicesByPatient = function(patientId) {
  const invoices = getAllInvoices();
  return invoices.filter(inv => inv.patientId === patientId);
};

// Update invoice - HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
window.updateInvoice = async function(invoiceId, updates) {
  try {
    const invoices = await getAllInvoices();
    
    if (!Array.isArray(invoices)) {
      console.error('❌ updateInvoice: invoices is not an array');
      return null;
    }
    
    const index = invoices.findIndex(inv => inv.id === invoiceId);
    
    if (index === -1) {
      console.error('❌ Invoice not found:', invoiceId);
      return null;
    }
    
    const invoice = invoices[index];
    Object.assign(invoice, updates);
    invoice.lastModified = new Date().toISOString();
    
    // Recalculate if services changed
    if (updates.services || updates.taxRate !== undefined || updates.discountAmount !== undefined) {
      invoice.subtotal = calculateSubtotal(invoice.services);
      invoice.taxAmount = invoice.subtotal * (invoice.taxRate / 100);
      invoice.total = invoice.subtotal + invoice.taxAmount - invoice.discountAmount;
      invoice.amountDue = invoice.total - invoice.amountPaid;
    }
    
    // Update status based on payment
    if (invoice.amountPaid >= invoice.total) {
      invoice.status = 'paid';
    } else if (invoice.amountPaid > 0) {
      invoice.status = 'partial';
    } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
      invoice.status = 'overdue';
    }
    
    // HYBRID ARCHITECTURE: Try Supabase FIRST
    const supabaseClient = window.supabaseClient;
    let orgId = null;
    
    if (typeof window.resolveOrganizationId === 'function') {
      orgId = await window.resolveOrganizationId();
    } else {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      orgId = user.organizationId || user.organization_id;
    }
    
    if (supabaseClient && orgId) {
      try {
        // CRITICAL: billing_invoices table does NOT have a services column
        const supabaseUpdates = {
          invoice_number: invoice.invoiceNumber,
          patient_id: invoice.patientId,
          patient_name: invoice.patientName,
          invoice_date: invoice.date,
          due_date: invoice.dueDate,
          // REMOVED: services - not a column in billing_invoices table
          currency: invoice.currency,
          subtotal: invoice.subtotal,
          tax_rate: invoice.taxRate,
          tax_amount: invoice.taxAmount,
          discount_amount: invoice.discountAmount,
          discount_reason: invoice.discountReason,
          total: invoice.total,
          amount_paid: invoice.amountPaid,
          amount_due: invoice.amountDue,
          status: invoice.status,
          payment_method: invoice.paymentMethod || null,
          notes: invoice.notes || null,
          encounter_id: invoice.encounterId
        };
        
        const { data, error } = await supabaseClient
          .from('billing_invoices')
          .update(supabaseUpdates)
          .eq('invoice_id', invoiceId)
          .eq('organization_id', orgId)
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          throw new Error('Invoice update returned no data from Supabase');
        }
        
        const updatedInvoice = data;
        console.log('✅ Invoice updated in Supabase:', updatedInvoice.invoice_id);
        
        // CRITICAL: Update services in billing_invoice_services table
        if (invoice.services && Array.isArray(invoice.services)) {
          // First, delete existing services
          const { error: deleteError } = await supabaseClient
            .from('billing_invoice_services')
            .delete()
            .eq('invoice_id', updatedInvoice.id);
          
          if (deleteError) {
            console.warn('⚠️ [BILLING] Error deleting old invoice services:', deleteError);
          }
          
          // Then insert new services
          if (invoice.services.length > 0) {
            const serviceInserts = invoice.services.map(service => ({
              invoice_id: updatedInvoice.id, // Use the UUID id from billing_invoices
              service_id: service.id || null,
              service_code: service.code || null,
              service_name: service.name,
              quantity: service.quantity || 1,
              price: service.price,
              total: service.total || (service.price * (service.quantity || 1))
            }));
            
            const { error: servicesError } = await supabaseClient
              .from('billing_invoice_services')
              .insert(serviceInserts);
            
            if (servicesError) {
              console.error('❌ [BILLING] Error updating invoice services:', servicesError);
              // Don't throw - invoice is updated, services can be synced later
            } else {
              console.log('✅ [BILLING] Invoice services updated in Supabase');
            }
          }
        }
        
        // Success - cache to localStorage
        invoices[index] = invoice;
        saveInvoices(invoices);
        
        if (typeof window.showSuccessNotification === 'function') {
          window.showSuccessNotification('Invoice updated successfully');
        }
      } catch (err) {
        console.error('❌ Supabase invoice update failed:', err);
        
        // Fallback: Save to localStorage and queue for sync
        invoices[index] = invoice;
        saveInvoices(invoices);
        
        // Queue for sync
        if (typeof window.queueForSync === 'function' && orgId) {
          const supabaseUpdates = {
            invoice_id: invoiceId,
            invoice_number: invoice.invoiceNumber,
            patient_id: invoice.patientId,
            patient_name: invoice.patientName,
            invoice_date: invoice.date,
            due_date: invoice.dueDate,
            services: JSON.stringify(invoice.services),
            currency: invoice.currency,
            subtotal: invoice.subtotal,
            tax_rate: invoice.taxRate,
            tax_amount: invoice.taxAmount,
            discount_amount: invoice.discountAmount,
            discount_reason: invoice.discountReason,
            total: invoice.total,
            amount_paid: invoice.amountPaid,
            amount_due: invoice.amountDue,
            status: invoice.status,
            payment_method: invoice.paymentMethod || null,
            notes: invoice.notes || null,
            encounter_id: invoice.encounterId,
            organization_id: orgId
          };
          window.queueForSync('billing_invoices', supabaseUpdates, 'update');
        }
        
        if (typeof window.showWarningNotification === 'function') {
          window.showWarningNotification('Invoice updated locally. Will sync when online.');
        }
      }
    } else {
      // Supabase not available - save locally
      invoices[index] = invoice;
      saveInvoices(invoices);
    }
    
    return invoice;
  } catch (error) {
    console.error('❌ Error in updateInvoice:', error);
    return null;
  }
};

// Cancel invoice
window.cancelInvoice = function(invoiceId, reason) {
  return updateInvoice(invoiceId, {
    status: 'cancelled',
    notes: (reason ? `Cancelled: ${reason}` : 'Cancelled')
  });
};

// Delete invoice (only for unpaid invoices)
window.deleteInvoice = async function(invoiceId) {
  try {
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      console.error('❌ Invoice not found:', invoiceId);
      return false;
    }
    
    // Only allow deletion of unpaid invoices
    if (invoice.status === 'paid') {
      alert('Cannot delete paid invoices. Please contact an administrator if this is an error.');
      return false;
    }
    
    // Confirm deletion
    const confirmMessage = `Are you sure you want to delete invoice ${invoice.invoiceNumber} for ${invoice.patientName}?\n\nThis action cannot be undone.`;
    if (!confirm(confirmMessage)) {
      return false;
    }
    
    const invoices = await getAllInvoices();
    if (!Array.isArray(invoices)) {
      console.error('❌ deleteInvoice: invoices is not an array');
      return false;
    }
    
    // Remove the invoice locally
    const filteredInvoices = invoices.filter(inv => inv.id !== invoiceId);
    saveInvoices(filteredInvoices);
    
    // CRITICAL: Delete from Supabase (billing_invoices is source of truth - otherwise invoice reappears on reload)
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        let orgId = null;
        if (typeof window.resolveOrganizationId === 'function') {
          orgId = await window.resolveOrganizationId();
        } else {
          const user = JSON.parse(localStorage.getItem("user") || "{}");
          orgId = user.organizationId || user.organization_id;
        }
        if (orgId) {
          const { data: invRow, error: findErr } = await supabase
            .from('billing_invoices')
            .select('id')
            .eq('invoice_id', String(invoiceId))
            .eq('organization_id', orgId)
            .maybeSingle();
          if (!findErr && invRow && invRow.id) {
            const supabaseId = invRow.id;
            await supabase.from('billing_invoice_services').delete().eq('invoice_id', supabaseId);
            const { error: delErr } = await supabase.from('billing_invoices').delete().eq('id', supabaseId);
            if (delErr) {
              console.error('❌ Error deleting invoice from Supabase:', delErr);
            } else {
              console.log('✅ Invoice deleted from Supabase');
            }
          }
        }
      }
    } catch (supabaseDelErr) {
      console.error('Error deleting invoice from Supabase:', supabaseDelErr);
    }
    
    // If this invoice is linked to a lab order, unlink it
    if (invoice.labOrderId) {
      try {
        const supabase = window.supabaseClient;
        if (supabase) {
          await supabase
            .from('orders')
            .update({
              invoice_id: null,
              payment_status: 'unpaid',
              updated_at: new Date().toISOString()
            })
            .eq('id', invoice.labOrderId)
            .eq('type', 'lab');
          
          console.log('✅ Unlinked invoice from lab order:', invoice.labOrderId);
        }
      } catch (labError) {
        console.error('Error unlinking invoice from lab order:', labError);
        // Continue anyway - invoice is deleted
      }
    }
    
    // If this invoice is linked to prescription(s), unlink them so they can be re-invoiced
    try {
      const supabase = window.supabaseClient;
      if (supabase) {
        const { data: unlinked, error: rxError } = await supabase
          .from('prescriptions')
          .update({ invoice_id: null, updated_at: new Date().toISOString() })
          .eq('invoice_id', String(invoiceId))
          .select('id');
        if (!rxError && unlinked && unlinked.length > 0) {
          console.log('✅ Unlinked invoice from prescription(s):', unlinked.length);
        }
      }
    } catch (rxErr) {
      console.error('Error unlinking invoice from prescription(s):', rxErr);
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('invoice_deleted', `Invoice ${invoice.invoiceNumber} deleted for patient ${invoice.patientName}`, {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        amount: invoice.total,
        labOrderId: invoice.labOrderId
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error in deleteInvoice:', error);
    alert('Error deleting invoice. Please try again.');
    return false;
  }
};


// ==================== PAYMENT MANAGEMENT ====================

// Get all payments
window.getAllPayments = async function() {
  const key = getBillingKey('payments');
  let payments = [];
  
  // Check Supabase FIRST (Supabase is source of truth)
  // Do NOT load from localStorage first - always get fresh data from Supabase
  if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        
        // Resolve organization ID using multiple methods (same as getAllInvoices)
        let orgId = null;
        
        // Method 1: Try standardized utility
        if (typeof window.resolveOrganizationId === 'function') {
          orgId = await window.resolveOrganizationId();
        }
        
        // Method 2: Try direct user properties
        if (!orgId) {
          orgId = user.organizationId || user.organization_id;
        }
        
        // Method 3: Try to resolve from user.org via organizations object
        if (!orgId && user.org) {
          const organizations = JSON.parse(localStorage.getItem("organizations") || "{}");
          const orgData = organizations[user.org];
          if (orgData && orgData.id) {
            orgId = orgData.id;
            // Update user object for future use
            user.organizationId = orgId;
            user.organization_id = orgId;
            localStorage.setItem("user", JSON.stringify(user));
          } else if (user.org && user.org.includes('-')) {
            // user.org might already be a UUID
            orgId = user.org;
          }
        }
        
        // Method 4: Query Supabase users table to get organization_id (if username exists)
        if (!orgId && user.username && typeof supabaseClient !== 'undefined' && supabaseClient) {
          try {
            const { data: userData, error: userError } = await supabaseClient
              .from('users')
              .select('organization_id, username, role')
              .eq('username', user.username)
              .limit(1)
              .maybeSingle();
            
            if (!userError && userData && userData.organization_id) {
              orgId = userData.organization_id;
              // Update user object for future use
              user.organizationId = orgId;
              user.organization_id = orgId;
              if (!user.username) user.username = userData.username;
              if (!user.role) user.role = userData.role;
              localStorage.setItem("user", JSON.stringify(user));
            }
          } catch (error) {
            console.error('❌ [BILLING] Error querying Supabase users table for payments:', error);
          }
        }
        
        // Method 5: Get user from Supabase Auth session and query users table
        if (!orgId && typeof supabaseClient !== 'undefined' && supabaseClient) {
          try {
            const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
            
            if (!authError && authUser && authUser.id) {
              // Query users table by auth_user_id
              const { data: userProfile, error: profileError } = await supabaseClient
                .from('users')
                .select('organization_id, username, role, organizations(name)')
                .eq('auth_user_id', authUser.id)
                .limit(1)
                .maybeSingle();
              
              if (!profileError && userProfile && userProfile.organization_id) {
                orgId = userProfile.organization_id;
                
                // Reconstruct user object in localStorage
                const reconstructedUser = {
                  username: userProfile.username,
                  role: userProfile.role,
                  org: userProfile.organizations?.name || null,
                  organizationId: orgId,
                  organization_id: orgId
                };
                localStorage.setItem("user", JSON.stringify(reconstructedUser));
              }
            }
          } catch (error) {
            console.error('❌ [BILLING] Error getting user from Supabase Auth for payments:', error);
          }
        }
        
        // If we still don't have orgId, try org-specific cache (from prior billing/GL load)
        if (!orgId) {
          const orgKey = getBillingKey('payments');
          let fallback = localStorage.getItem(orgKey);
          if (!fallback) fallback = localStorage.getItem('_billing_payments');
          if (fallback) {
            try {
              const payments = JSON.parse(fallback);
              return Array.isArray(payments) ? payments : [];
            } catch (_) {}
          }
          return [];
        }
        
        if (orgId) {
          // Try 'billing_payments' table first (where data actually is)
        let supabasePayments = null;
        let error = null;
        
        const billingPaymentsResult = await supabaseClient
          .from('billing_payments')
          .select('*')
          .eq('organization_id', orgId);
        supabasePayments = billingPaymentsResult.data;
        error = billingPaymentsResult.error;
        
        // If 'billing_payments' fails or is empty, try 'payments' table
        if (error || !supabasePayments || supabasePayments.length === 0) {
          const paymentsResult = await supabaseClient
            .from('payments')
            .select('*')
            .eq('organization_id', orgId);
          supabasePayments = paymentsResult.data;
          error = paymentsResult.error;
        }
        
        if (error) {
          console.error('❌ [BILLING] Error loading payments from Supabase:', error);
          // HYBRID ARCHITECTURE: Fall back to localStorage on error
          const fallback = localStorage.getItem(key);
          payments = fallback ? JSON.parse(fallback) : [];
        } else if (supabasePayments && Array.isArray(supabasePayments) && supabasePayments.length > 0) {
          // Convert Supabase format to localStorage format
          const convertedPayments = supabasePayments.map(sp => {
            // Parse proof of payment if it exists
            let proofOfPayment = null;
            let proofOfPaymentFileName = null;
            let proofOfPaymentType = null;
            if (sp.proof_of_payment) {
              try {
                const proof = JSON.parse(sp.proof_of_payment);
                proofOfPayment = proof.data;
                proofOfPaymentFileName = proof.fileName;
                proofOfPaymentType = proof.type;
              } catch (e) {
                console.warn('Could not parse proof of payment:', e);
              }
            }
            
            return {
              id: sp.payment_id || sp.id,
              invoiceId: sp.invoice_id,
              patientId: sp.patient_id,
              patientName: sp.patient_name || 'Unknown Patient',
              amount: parseFloat(sp.amount || 0),
              paymentMethod: sp.payment_method || 'cash',
              method: sp.payment_method || 'cash', // Alias for compatibility
              date: sp.payment_date,
              paymentDate: sp.payment_date, // Alias
              reference: sp.reference || '',
              notes: sp.notes || '',
              status: sp.status || 'completed',
              currency: sp.currency || 'CAD',
              organizationId: sp.organization_id,
              proofOfPayment: proofOfPayment,
              proofOfPaymentFileName: proofOfPaymentFileName,
              proofOfPaymentType: proofOfPaymentType
            };
          });
          
          // HYBRID ARCHITECTURE: Supabase is source of truth - replace localStorage with Supabase data
          payments = convertedPayments;
          localStorage.setItem(key, JSON.stringify(payments));
        } else {
          // Supabase query succeeded but returned empty - check localStorage fallback
          const fallback = localStorage.getItem(key);
          const localPayments = fallback ? JSON.parse(fallback) : [];
          
          if (localPayments.length > 0) {
            // localStorage has data but Supabase doesn't - keep localStorage as fallback
            payments = localPayments;
          } else {
            // Both are empty - this is valid
            payments = [];
            localStorage.setItem(key, JSON.stringify([]));
          }
        }
      }
    } catch (error) {
      console.error('❌ Exception loading payments from Supabase:', error);
      // Fallback to localStorage only if Supabase is completely unavailable
      const fallback = localStorage.getItem(key);
      payments = fallback ? JSON.parse(fallback) : [];
    }
  } else {
    // No Supabase client available - use localStorage as fallback
    const fallback = localStorage.getItem(key);
    payments = fallback ? JSON.parse(fallback) : [];
  }
  
  return payments;
};

// Save payments
function savePayments(payments) {
  const key = getBillingKey('payments');
  localStorage.setItem(key, JSON.stringify(payments));
}

// Generate payment reference
window.generatePaymentReference = async function() {
  const payments = await getAllPayments();
  const year = new Date().getFullYear();
  const prefix = `PAY-${year}-`;
  
  let maxNum = 0;
  payments.forEach(pay => {
    if (pay.reference && pay.reference.startsWith(prefix)) {
      const num = parseInt(pay.reference.split('-')[2]);
      if (num > maxNum) maxNum = num;
    }
  });
  
  const nextNum = (maxNum + 1).toString().padStart(5, '0');
  return `${prefix}${nextNum}`;
};

// Record payment - HYBRID ARCHITECTURE: Supabase-first, localStorage fallback
window.recordPayment = async function(paymentData) {
  try {
    const payments = await getAllPayments();
    
    // Ensure payments is an array
    let safePayments = payments;
    if (!Array.isArray(payments)) {
      console.warn('⚠️ recordPayment: payments is not an array, converting to empty array');
      safePayments = [];
    }
    
    const payment = {
      id: Date.now().toString(),
      reference: await generatePaymentReference(),
      invoiceId: paymentData.invoiceId,
      patientId: paymentData.patientId,
      patientName: paymentData.patientName,
      amount: parseFloat(paymentData.amount) || 0,
      currency: paymentData.currency || 'USD',
      method: paymentData.method || 'cash', // cash, mobile_money, card, bank_transfer, check
      methodDetails: paymentData.methodDetails || '', // M-Pesa code, check number, etc.
      date: paymentData.date || new Date().toISOString().split('T')[0],
      status: paymentData.status || 'completed', // completed, pending, failed, refunded
      notes: paymentData.notes || '',
      receivedBy: getCurrentUsername(),
      createdAt: new Date().toISOString(),
      // Bank transfer proof of payment
      proofOfPayment: paymentData.proofOfPayment || null,
      proofOfPaymentFileName: paymentData.proofOfPaymentFileName || null,
      proofOfPaymentType: paymentData.proofOfPaymentType || null
    };
    
    // Expose last recorded payment for immediate receipt printing fallback
    window.__lastRecordedPayment = payment;
    
    // HYBRID ARCHITECTURE: Try Supabase FIRST
    const supabaseClient = window.supabaseClient;
    let savedToSupabase = false;
    let orgId = null;
    
    // Resolve organization ID using standardized utility
    if (typeof window.resolveOrganizationId === 'function') {
      orgId = await window.resolveOrganizationId();
    } else {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      orgId = user.organizationId || user.organization_id;
    }
    
    if (supabaseClient && orgId) {
      try {
        const supabasePayment = {
          payment_id: payment.id,
          reference: payment.reference,
          invoice_id: payment.invoiceId || null,
          patient_id: payment.patientId,
          patient_name: payment.patientName,
          amount: payment.amount,
          currency: payment.currency,
          payment_method: payment.method,
          method_details: payment.methodDetails || null,
          payment_date: payment.date,
          status: payment.status,
          notes: payment.notes || null,
          received_by: payment.receivedBy,
          organization_id: orgId,
          // Bank transfer proof of payment (stored as JSONB or TEXT)
          proof_of_payment: payment.proofOfPayment ? JSON.stringify({
            data: payment.proofOfPayment,
            fileName: payment.proofOfPaymentFileName,
            type: payment.proofOfPaymentType,
            uploadedAt: new Date().toISOString()
          }) : null
        };
        
        const { data, error } = await supabaseClient
          .from('billing_payments')
          .insert(supabasePayment)
          .select()
          .single();
        
        if (error) {
          throw error;
        }
        
        // Success - cache to localStorage
        savedToSupabase = true;
        safePayments.push(payment);
        savePayments(safePayments);
        
        if (typeof window.showSuccessNotification === 'function') {
          window.showSuccessNotification('Payment recorded successfully');
        }
      } catch (err) {
        console.error('❌ Supabase payment save failed:', err);
        
        // Fallback: Save to localStorage and queue for sync
        safePayments.push(payment);
        savePayments(safePayments);
        
        // Queue for sync
        if (typeof window.queueForSync === 'function' && orgId) {
          const supabasePayment = {
            payment_id: payment.id,
            reference: payment.reference,
            invoice_id: payment.invoiceId || null,
            patient_id: payment.patientId,
            patient_name: payment.patientName,
            amount: payment.amount,
            currency: payment.currency,
            payment_method: payment.method,
            method_details: payment.methodDetails || null,
            payment_date: payment.date,
            status: payment.status,
            notes: payment.notes || null,
            received_by: payment.receivedBy,
            organization_id: orgId,
            // Bank transfer proof of payment
            proof_of_payment: payment.proofOfPayment ? JSON.stringify({
              data: payment.proofOfPayment,
              fileName: payment.proofOfPaymentFileName,
              type: payment.proofOfPaymentType,
              uploadedAt: new Date().toISOString()
            }) : null
          };
          window.queueForSync('billing_payments', supabasePayment);
        }
        
        if (typeof window.showWarningNotification === 'function') {
          window.showWarningNotification('Payment saved locally. Will sync when online.');
        }
      }
    } else {
      // Supabase not available - save locally
      safePayments.push(payment);
      savePayments(safePayments);
      
      if (typeof window.showWarningNotification === 'function') {
        window.showWarningNotification('Database not available. Payment saved locally and will sync automatically.');
      }
    }
    
    // Update invoice if provided
    if (payment.invoiceId) {
      const invoice = await getInvoiceById(payment.invoiceId);
      if (invoice) {
        if (!invoice.payments) {
          invoice.payments = [];
        }
        invoice.payments.push(payment.id);
        invoice.amountPaid += payment.amount;
        invoice.amountDue = invoice.total - invoice.amountPaid;
        
        // Update status
        if (invoice.amountPaid >= invoice.total) {
          invoice.status = 'paid';
        } else if (invoice.amountPaid > 0) {
          invoice.status = 'partial';
        }
        
        await updateInvoice(invoice.id, invoice);
        if (invoice.status === 'paid' && typeof window.markPrescriptionPaidByInvoiceId === 'function') {
          var prescriptionInvoiceId = invoice.invoice_id || invoice.id;
          await window.markPrescriptionPaidByInvoiceId(prescriptionInvoiceId);
        }
        if (payment.status === 'completed' && typeof window.postPaymentToGL === 'function') {
          window.postPaymentToGL(payment, invoice).catch(function() {});
        }
      }
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('payment_recorded', `Payment ${payment.reference} of ${payment.currency} ${payment.amount} recorded`, {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        method: payment.method
      });
    }
    return payment;
  } catch (error) {
    console.error('❌ Error in recordPayment:', error);
    throw error;
  }
};

// Get payments by invoice
window.getPaymentsByInvoice = async function(invoiceId) {
  const payments = await getAllPayments();
  return payments.filter(pay => pay.invoiceId === invoiceId);
};

// Get payments by patient
window.getPaymentsByPatient = async function(patientId) {
  const payments = await getAllPayments();
  return payments.filter(pay => pay.patientId === patientId);
};

// Update payment
window.updatePayment = async function(paymentId, updates) {
  try {
    const payments = await getAllPayments();
    
    if (!Array.isArray(payments)) {
      console.error('❌ Error: getAllPayments() did not return an array:', payments);
      return false;
    }
    
    const index = payments.findIndex(pay => pay.id === paymentId);
    
    if (index === -1) {
      console.error('Payment not found:', paymentId);
      return false;
    }
    
    const oldPayment = payments[index];
    const invoice = oldPayment.invoiceId ? await getInvoiceById(oldPayment.invoiceId) : null;
    
    // Reverse old payment on invoice if it was completed
    if (invoice && oldPayment.status === 'completed') {
      invoice.amountPaid -= oldPayment.amount;
      invoice.amountDue = invoice.total - invoice.amountPaid;
      
      if (invoice.amountPaid === 0) {
        invoice.status = 'pending';
      } else if (invoice.amountPaid < invoice.total) {
        invoice.status = 'partial';
      }
    }
    
    // Update payment
    const updatedPayment = {
      ...oldPayment,
      ...updates,
      amount: parseFloat(updates.amount) || oldPayment.amount,
      lastModified: new Date().toISOString()
    };
    
    payments[index] = updatedPayment;
    savePayments(payments);
    
    // Apply new payment to invoice if it's completed
    if (invoice && updatedPayment.status === 'completed') {
      invoice.amountPaid += updatedPayment.amount;
      invoice.amountDue = invoice.total - invoice.amountPaid;
      
      if (invoice.amountPaid >= invoice.total) {
        invoice.status = 'paid';
      } else if (invoice.amountPaid > 0) {
        invoice.status = 'partial';
      }
      
      await updateInvoice(invoice.id, invoice);
    }
    
    // Log audit event
    if (typeof logAuditEvent === 'function') {
      logAuditEvent('payment_updated', `Payment ${updatedPayment.reference} updated`, {
        paymentId: updatedPayment.id,
        changes: updates,
        oldAmount: oldPayment.amount,
        newAmount: updatedPayment.amount
      });
    }
    
    console.log('✅ Payment updated:', updatedPayment.reference);
    return updatedPayment;
    
  } catch (error) {
    console.error('❌ Error in updatePayment:', error);
    return false;
  }
};

// Get payment by ID
window.getPaymentById = async function(paymentId) {
  const payments = await getAllPayments();
  return payments.find(pay => pay.id === paymentId) || null;
};

// Delete payment (permanent removal)
window.deletePayment = async function(paymentId) {
  try {
    const payments = await getAllPayments();
    
    if (!Array.isArray(payments)) {
      console.error('❌ Error: getAllPayments() did not return an array:', payments);
      return false;
    }
    
    const index = payments.findIndex(pay => pay.id === paymentId);
    
    if (index === -1) {
      console.error('Payment not found:', paymentId);
      return false;
    }
  
  const payment = payments[index];
  
  // If it's a cash payment, remove it from cash register
  if (payment.method === 'cash') {
    const getAllCashSessionsFn = window.getAllCashSessions || function() { return []; };
    const deleteCashTransactionFn = window.deleteCashTransaction || function() { return false; };
    
    const sessions = getAllCashSessionsFn();
    let transactionFound = false;
    
    // Search through ALL sessions (open and closed) to find matching transactions
    for (const session of sessions) {
      if (session.transactions && Array.isArray(session.transactions)) {
        // Find all transactions that match this payment (by reference, description, or amount)
        const matchingTransactions = session.transactions.filter(tx => {
          // Match by exact reference
          if (tx.reference === payment.reference) return true;
          
          // Match by description containing the payment reference
          if (tx.description && typeof tx.description === 'string' && tx.description.includes(payment.reference)) return true;
          
          // Match by amount and date if reference doesn't match (for retroactive entries)
          if (Math.abs(parseFloat(tx.amount) - parseFloat(payment.amount)) < 0.01) {
            // Check if the transaction date matches the payment date
            const txDate = tx.timestamp ? new Date(tx.timestamp).toISOString().split('T')[0] : null;
            const paymentDate = payment.date || (payment.createdAt ? new Date(payment.createdAt).toISOString().split('T')[0] : null);
            if (txDate === paymentDate && tx.type === 'in') {
              return true;
            }
          }
          
          return false;
        });
        
        // Delete all matching transactions
        if (matchingTransactions.length > 0) {
          console.log(`Found ${matchingTransactions.length} matching transaction(s) for payment ${payment.reference}`);
          matchingTransactions.forEach(tx => {
            console.log('Removing cash transaction from register:', {
              sessionId: session.id,
              transactionId: tx.id,
              reference: tx.reference,
              amount: tx.amount
            });
            const deleted = deleteCashTransactionFn(session.id, tx.id);
            if (deleted) {
              transactionFound = true;
              console.log('✅ Cash transaction removed from register');
            } else {
              console.warn('⚠️ Failed to remove cash transaction:', tx.id);
            }
          });
        }
      }
    }
    
    if (!transactionFound && payment.status === 'completed') {
      console.warn('⚠️ Payment deleted but no matching cash register transaction found:', {
        paymentId: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        date: payment.date
      });
    }
  }
  
  // Update associated invoice
  if (payment.invoiceId && payment.status === 'completed') {
    const invoice = getInvoiceById(payment.invoiceId);
    if (invoice) {
      // Reverse the payment
      invoice.amountPaid -= payment.amount;
      invoice.amountDue = invoice.total - invoice.amountPaid;
      
      // Update status
      if (invoice.amountPaid === 0) {
        invoice.status = 'pending';
      } else if (invoice.amountPaid < invoice.total) {
        invoice.status = 'partial';
      }
      
      // Remove payment reference
      if (invoice.payments && Array.isArray(invoice.payments)) {
        invoice.payments = invoice.payments.filter(pId => pId !== paymentId);
      } else {
        invoice.payments = [];
      }
      
      updateInvoice(invoice.id, invoice);
    }
  }
  
  // Remove payment
  payments.splice(index, 1);
  savePayments(payments);
  
  // Log audit event
  if (typeof logAuditEvent === 'function') {
    logAuditEvent('payment_deleted', `Payment ${payment.reference} permanently deleted`, {
      paymentId: payment.id,
      amount: payment.amount,
      method: payment.method
    });
  }
  
    console.log('Payment deleted:', payment.reference);
    return true;
    
  } catch (error) {
    console.error('❌ Error in deletePayment:', error);
    return false;
  }
};

// ==================== HELPER FUNCTIONS ====================

// Get current username
function getCurrentUsername() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return user.username || 'Unknown';
}

// Get default currency
window.getDefaultCurrency = function() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  const saved = localStorage.getItem(`${org}_billing_default_currency`);
  if (saved) return saved;
  
  // For Mecure Clinics, default to NGN if not set
  if (org && org.toLowerCase().includes('mecure')) {
    return 'NGN';
  }
  
  return 'CAD'; // Fallback to Canadian Dollar (platform default)
};

// Get default tax rate
window.getDefaultTaxRate = function() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  const saved = localStorage.getItem(`${org}_billing_default_tax_rate`);
  return parseFloat(saved) || 0;
};

// Format currency (handles null, undefined, NaN, empty string)
window.formatCurrency = function(amount, currency) {
  const symbols = {
    'CAD': 'CA$', 'USD': '$', 'KES': 'KSh', 'NGN': '₦', 'ZAR': 'R', 'GHS': 'GH₵',
    'TZS': 'TSh', 'UGX': 'USh', 'RWF': 'RF', 'EGP': 'E£', 'MAD': 'MAD',
    'BWP': 'P', 'MWK': 'MK', 'XOF': 'CFA', 'XAF': 'FCFA'
  };
  const symbol = symbols[currency] || currency;
  const num = parseFloat(amount);
  if (amount == null || amount === '' || isNaN(num)) return `${symbol} 0.00`;
  const formatted = num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol} ${formatted}`;
};

// Get patient name by ID (now uses Supabase priority)
window.getPatientNameByIdBilling = async function(patientId) {
  return await window.getPatientNameById(patientId);
};

// Get outstanding balance for patient
window.getPatientOutstandingBalance = function(patientId) {
  const invoices = getInvoicesByPatient(patientId);
  return invoices.reduce((sum, inv) => {
    if (inv.status !== 'paid' && inv.status !== 'cancelled') {
      return sum + (inv.total - inv.amountPaid);
    }
    return sum;
  }, 0);
};

// Get data key (from main.js)
function getDataKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_${key}`;
}

// ==================== BILLING STATISTICS ====================

// Get billing stats (updated to be async)
window.getBillingStats = async function(startDate, endDate) {
  const invoices = await getAllInvoices();
  const payments = await getAllPayments();
  
  // Filter by date range if provided (handle both 'date' and 'paymentDate' fields)
  let filteredInvoices = invoices;
  let filteredPayments = payments;
  
  if (startDate) {
    filteredInvoices = filteredInvoices.filter(inv => inv.date && inv.date >= startDate);
    filteredPayments = filteredPayments.filter(pay => {
      const payDate = pay.date || pay.paymentDate;
      return payDate && payDate >= startDate;
    });
  }
  
  if (endDate) {
    filteredInvoices = filteredInvoices.filter(inv => inv.date && inv.date <= endDate);
    filteredPayments = filteredPayments.filter(pay => {
      const payDate = pay.date || pay.paymentDate;
      return payDate && payDate <= endDate;
    });
  }
  
  // Helper to get payment method (handle both 'method' and 'paymentMethod')
  const getPaymentMethod = (pay) => pay.method || pay.paymentMethod || 'cash';
  
  // Calculate stats
  const stats = {
    totalInvoices: filteredInvoices.length,
    totalRevenue: filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
    totalPaid: filteredPayments.reduce((sum, pay) => pay.status === 'completed' ? sum + parseFloat(pay.amount || 0) : sum, 0),
    totalOutstanding: filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.amountDue || 0), 0),
    paidInvoices: filteredInvoices.filter(inv => inv.status === 'paid').length,
    pendingInvoices: filteredInvoices.filter(inv => inv.status === 'pending').length,
    overdueInvoices: filteredInvoices.filter(inv => inv.status === 'overdue').length,
    partialInvoices: filteredInvoices.filter(inv => inv.status === 'partial').length,
    cashPayments: filteredPayments.filter(pay => getPaymentMethod(pay) === 'cash' && pay.status === 'completed').length,
    cashAmount: filteredPayments.filter(pay => getPaymentMethod(pay) === 'cash' && pay.status === 'completed').reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0),
    mobilePayments: filteredPayments.filter(pay => getPaymentMethod(pay) === 'mobile_money' && pay.status === 'completed').length,
    mobileAmount: filteredPayments.filter(pay => getPaymentMethod(pay) === 'mobile_money' && pay.status === 'completed').reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0),
    cardPayments: filteredPayments.filter(pay => getPaymentMethod(pay) === 'card' && pay.status === 'completed').length,
    cardAmount: filteredPayments.filter(pay => getPaymentMethod(pay) === 'card' && pay.status === 'completed').reduce((sum, pay) => sum + parseFloat(pay.amount || 0), 0)
  };
  
  return stats;
};

// Get outstanding invoices (updated to be async)
window.getOutstandingInvoices = async function() {
  const invoices = await getAllInvoices();
  return invoices.filter(inv => 
    (inv.status === 'pending' || inv.status === 'partial' || inv.status === 'overdue') &&
    inv.amountDue > 0
  ).sort((a, b) => {
    // Sort by due date, oldest first
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
};

// Get overdue invoices
window.getOverdueInvoices = async function() {
  const today = new Date().toISOString().split('T')[0];
  const invoices = await getAllInvoices();
  return invoices.filter(inv => 
    inv.dueDate &&
    inv.dueDate < today &&
    inv.status !== 'paid' &&
    inv.status !== 'cancelled' &&
    inv.amountDue > 0
  );
};

// ==================== INITIALIZATION ====================

console.log('Billing module loaded successfully');

// Initialize billing system
window.initializeBillingSystem = function() {
  console.log('Initializing billing system...');
  
  // Check if pricing catalog exists, create default if not
  const pricingKey = getBillingKey('pricing_catalog');
  if (!localStorage.getItem(pricingKey)) {
    console.log('Creating default pricing catalog...');
    // Will be created in pricing.js
  }
  
  console.log('Billing system initialized');
};

// Auto-initialize on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', function() {
    setTimeout(initializeBillingSystem, 100);
  });
}


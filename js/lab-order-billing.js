/**
 * Lab Order Billing System
 * Handles invoice generation and payment processing for lab orders
 * Ensures payment confirmation before lab test processing
 */

console.log('✅ [LAB-BILLING] lab-order-billing.js file loaded - START');

// Check if user has permission to invoice/pay for lab orders
window.canInvoiceLabOrders = function() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = (user.role || '').toLowerCase();
  
  // Medical Lab Scientist, Biller/Accountant, Administrator can invoice/pay
  const allowedRoles = ['medical lab scientist', 'lab scientist', 'biller/accountant', 'administrator', 'admin'];
  const canInvoice = allowedRoles.some(allowed => role.includes(allowed));
  
  console.log('🔍 [LAB-BILLING] Checking permissions:', {
    role: role,
    canInvoice: canInvoice
  });
  
  return canInvoice;
};

// Panels that must be billed as one line (same as display collapse). Used for existing orders stored with expanded sub-tests.
var BILLING_PANELS = {
  'Hormonal Profile (Panel)': {
    cpt: '84146/84403/83001/83002/82670/84144',
    subTests: ['Prolactin', 'Testosterone (Total)', 'Follicle Stimulating Hormone (FSH)', 'Luteinizing Hormone (LH)', 'Estrogen (E2)', 'Progesterone']
  },
  'Hepatitis B Profile': {
    cpt: '87340/86706/87350/86707/86704',
    subTests: [
      'HBsAg (Hepatitis B Surface Antigen)',
      'HBsAb (Hepatitis B Surface Antibody)',
      'HBeAg (Hepatitis B e Antigen)',
      'HBeAb (Hepatitis B e Antibody)',
      'HBcAb (Hepatitis B Core Antibody)'
    ]
  }
};

// Normalize name for consistent matching (trim; no case change so "Hormonal Profile (Panel)" matches).
function _normName(t) {
  return String(typeof t === 'object' && t != null ? (t.name || t.testName || '') : t || '').trim();
}

// Collapse expanded panel sub-tests to one item per panel so existing orders bill as one line at panel price.
// Ensures every selected item is represented: panel names added as one line each; expanded sub-tests collapsed to one line per panel; other tests added as-is.
function collapseSelectedItemsForBilling(selectedItems) {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) return selectedItems;
  const out = [];
  const panelsAdded = new Set();
  // Pass 1: items that are already panel names (exact match to BILLING_PANELS) -> one line each, preserve order
  const remaining = [];
  for (const item of selectedItems) {
    const rawName = typeof item === 'object' && item != null ? (item.name || item.testName) : item;
    const name = _normName(rawName);
    if (!name) continue;
    const isPanelName = Object.keys(BILLING_PANELS).some(function (k) { return _normName(k) === name; });
    const panelKey = isPanelName ? (Object.keys(BILLING_PANELS).find(function (k) { return _normName(k) === name; }) || null) : null;
    if (panelKey && BILLING_PANELS[panelKey]) {
      if (!panelsAdded.has(panelKey)) {
        panelsAdded.add(panelKey);
        out.push({ name: panelKey, cpt: BILLING_PANELS[panelKey].cpt });
      }
      continue;
    }
    remaining.push({ item: item, name: name });
  }
  // Pass 2: remaining names that form a full expanded panel -> one line per panel
  const nameSet = new Set(remaining.map(function (r) { return r.name; }));
  const used = new Set();
  for (const panelName of Object.keys(BILLING_PANELS)) {
    if (panelsAdded.has(panelName)) continue;
    const panel = BILLING_PANELS[panelName];
    const allPresent = panel.subTests.every(function (t) { return nameSet.has(t); });
    const noneUsed = panel.subTests.every(function (t) { return !used.has(t); });
    if (allPresent && noneUsed) {
      out.push({ name: panelName, cpt: panel.cpt });
      panel.subTests.forEach(function (t) { used.add(t); });
    }
  }
  // Pass 3: any remaining item not part of a collapsed panel -> add as individual (preserve original item for cpt)
  for (const r of remaining) {
    if (used.has(r.name)) continue;
    const it = r.item;
    const obj = typeof it === 'object' && it != null ? it : { name: r.name };
    out.push({ name: obj.name || r.name, cpt: obj.cpt || obj.code });
  }
  return out.length ? out : selectedItems;
}

// Map CPT code to service code (LAB - <CPT Code>)
function mapCptToServiceCode(cptCode) {
  if (!cptCode) return null;
  // Remove any spaces and ensure format is correct
  const cleanCpt = String(cptCode).trim().replace(/\s+/g, '');
  return `LAB - ${cleanCpt}`;
}

// Get service price from pricing catalog by CPT code
function getServicePriceByCpt(cptCode) {
  if (!cptCode || typeof window.getPricingCatalog !== 'function') {
    return null;
  }
  
  const serviceCode = mapCptToServiceCode(cptCode);
  const catalog = window.getPricingCatalog();
  
  // Find service by code
  const service = catalog.find(s => {
    const catalogCode = (s.code || '').toUpperCase().trim();
    const searchCode = serviceCode.toUpperCase().trim();
    return catalogCode === searchCode;
  });
  
  return service ? {
    id: service.id,
    code: service.code,
    name: service.name,
    price: service.price,
    currency: service.currency || 'USD',
    taxable: service.taxable !== false
  } : null;
}

// Generate invoice from lab order
// CRITICAL: Add lock to prevent race conditions on slow connections (tablets, Africa)
window._invoiceGenerationLock = window._invoiceGenerationLock || new Map();

function showGeneratingInvoiceOverlay() {
  const existing = document.getElementById('lab-invoice-generating-overlay');
  if (existing) return;
  const overlay = document.createElement('div');
  overlay.id = 'lab-invoice-generating-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
  overlay.innerHTML = '<div style="background:white;padding:24px 32px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);text-align:center;"><p style="margin:0 0 12px 0;font-size:18px;font-weight:600;color:#333;">Generating invoice....</p><div style="width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#4CAF50;border-radius:50%;animation:lab-invoice-spin 0.8s linear infinite;"></div></div>';
  const style = document.createElement('style');
  style.textContent = '@keyframes lab-invoice-spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  document.body.appendChild(overlay);
}
function hideGeneratingInvoiceOverlay() {
  const overlay = document.getElementById('lab-invoice-generating-overlay');
  if (overlay) overlay.remove();
}

window.generateInvoiceFromLabOrder = async function(orderId, selectedItemsOverride) {
  console.log('[LAB-BILLING] *** Generate Invoice called *** orderId=', orderId, 'override=', selectedItemsOverride ? selectedItemsOverride.length + ' items' : 'none');
  showGeneratingInvoiceOverlay();
  const orderIds = typeof orderId === 'string' && orderId.includes(',') ? orderId.split(',').map(id => id.trim()).filter(Boolean) : [orderId];
  const isGroup = orderIds.length > 1;
  const lockKey = orderIds[0];
  console.log('🔍 [LAB-BILLING] generateInvoiceFromLabOrder for', isGroup ? 'group' : 'order', orderIds.length, selectedItemsOverride ? `(${selectedItemsOverride.length} tests selected)` : '(all tests)');
  
  if (window._invoiceGenerationLock.has(lockKey)) {
    const lockInfo = window._invoiceGenerationLock.get(lockKey);
    if (Date.now() - lockInfo.timestamp < 10000) {
      hideGeneratingInvoiceOverlay();
      alert('Invoice generation is already in progress for this order. Please wait...');
      return null;
    }
    window._invoiceGenerationLock.delete(lockKey);
  }
  window._invoiceGenerationLock.set(lockKey, { timestamp: Date.now() });
  const cleanupLock = () => {
    setTimeout(() => { window._invoiceGenerationLock.delete(lockKey); }, 5000);
  };
  
  if (!window.canInvoiceLabOrders()) {
    window._invoiceGenerationLock.delete(lockKey);
    hideGeneratingInvoiceOverlay();
    alert('Access denied. Only Medical Lab Scientists, Biller/Accountant, and Administrators can generate invoices for lab orders.');
    return null;
  }
  
  try {
    const supabase = await window.getLabSupabaseClient();
    let order;
    if (isGroup) {
      const { data: orders, error } = await supabase.from('orders').select('*').eq('type', 'lab').in('id', orderIds);
      if (error || !orders || orders.length === 0) {
        hideGeneratingInvoiceOverlay();
        alert('Lab order(s) not found.');
        return null;
      }
      order = orders[0];
      for (const o of orders) {
        if (o.invoice_id) {
          const existingInvoice = await window.getInvoiceById(o.invoice_id);
          if (existingInvoice) {
            if (confirm(`Invoice ${existingInvoice.invoiceNumber} already exists for this order. View it now?`)) {
              window.location.href = `/invoice-details?id=${existingInvoice.id}`;
            }
            cleanupLock();
            return existingInvoice;
          }
        }
      }
    } else {
      const { data: single, error: orderError } = await supabase.from('orders').select('*').eq('id', orderId).eq('type', 'lab').single();
      if (orderError || !single) {
        hideGeneratingInvoiceOverlay();
        alert('Lab order not found.');
        return null;
      }
      order = single;
      console.log('[LAB-BILLING-TRACE] Order loaded (initial)', {
        orderId: order.id,
        selected_itemsType: order.selected_items == null ? 'null' : typeof order.selected_items,
        selected_itemsIsArray: Array.isArray(order.selected_items),
        selected_itemsLength: Array.isArray(order.selected_items) ? order.selected_items.length : (order.selected_items && typeof order.selected_items === 'object' ? Object.keys(order.selected_items).length : 'n/a'),
        selected_itemsPreview: order.selected_items == null ? null : JSON.stringify(order.selected_items).substring(0, 400)
      });
    }
    
    if (!isGroup && order.invoice_id) {
      const existingInvoice = await window.getInvoiceById(order.invoice_id);
      if (existingInvoice) {
        console.log('[LAB-BILLING-TRACE] Order already has invoice – no new invoice created.', { orderId: order.id, invoiceId: order.invoice_id, invoiceNumber: existingInvoice.invoiceNumber });
        hideGeneratingInvoiceOverlay();
        if (confirm('This order already has an invoice (' + existingInvoice.invoiceNumber + ').\n\nTo get an invoice with BOTH tests (Hepatitis B + Hormonal Profile): cancel that invoice, then create a NEW lab order in Select Lab Orders with both tests, Send to Lab Scientist, then Generate Invoice for the new order.\n\nView the existing invoice now?')) {
          window.location.href = `/invoice-details?id=${existingInvoice.id}`;
        }
        cleanupLock();
        return existingInvoice;
      }
    }
    
    // Get patient - handle legacy orders created before billing system
    let patient = null;
    
    if (typeof window.resolvePatientByIdentifier === 'function') {
      patient = await window.resolvePatientByIdentifier(order.patient_id);
    }
    
    // If patient not found, try alternative lookup methods for legacy orders
    if (!patient) {
      console.warn('⚠️ [LAB-BILLING] Patient not found via resolvePatientByIdentifier, trying alternative methods...');
      
      // Try loading all patients and searching manually
      try {
        let allPatients = [];
        
        // Try Supabase-first loader
        if (typeof window.loadPatientsWithSupabasePriority === 'function') {
          allPatients = await window.loadPatientsWithSupabasePriority();
        } else {
          // Fallback to localStorage
          const user = JSON.parse(localStorage.getItem('user') || '{}');
          const getDataKey = (key) => {
            const orgId = user.organizationId || user.organization_id || 'default';
            return `${orgId}_${key}`;
          };
          allPatients = JSON.parse(localStorage.getItem(getDataKey('patients')) || '[]');
        }
        
        // Search for patient by various ID fields
        patient = allPatients.find(p => 
          p.id === order.patient_id ||
          p.patient_id === order.patient_id ||
          p.patientNumber === order.patient_id ||
          p._supabaseUuid === order.patient_id ||
          (p.patient_id && p.patient_id.toString() === order.patient_id.toString())
        );
        
        if (patient) {
          console.log('✅ [LAB-BILLING] Found patient via alternative lookup:', patient.id || patient.patient_id);
        }
      } catch (error) {
        console.error('❌ [LAB-BILLING] Error in alternative patient lookup:', error);
      }
    }
    
    // If still not found, try comprehensive lookup including visits table
    if (!patient) {
      console.warn('⚠️ [LAB-BILLING] Patient not found via standard methods, trying comprehensive lookup...');
      
      try {
        const supabase = await window.getLabSupabaseClient();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const orgId = user.organizationId || user.organization_id;
        
        if (orgId && supabase) {
          // Method 1: Try exact match on patient_id
          let { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .eq('patient_id', order.patient_id)
            .eq('organization_id', orgId)
            .maybeSingle();
          
          // Method 2: If not found and order has visit_date, try finding via visits table
          if (!patientData && order.visit_date) {
            console.log('🔍 [LAB-BILLING] Checking visits table for patient info...');
            const { data: visitData, error: visitError } = await supabase
              .from('visits')
              .select('patient_id, patient_name')
              .eq('organization_id', orgId)
              .eq('visit_date', order.visit_date)
              .eq('patient_id', order.patient_id)
              .maybeSingle();
            
            if (visitData && visitData.patient_id) {
              const visitPatientId = visitData.patient_id;
              
              // Try UUID first
              if (visitPatientId.includes('-') && visitPatientId.length === 36) {
                const { data: uuidPatient, error: uuidError } = await supabase
                  .from('patients')
                  .select('*')
                  .eq('id', visitPatientId)
                  .eq('organization_id', orgId)
                  .maybeSingle();
                
                if (uuidPatient && !uuidError) {
                  patientData = uuidPatient;
                  console.log('✅ [LAB-BILLING] Found patient via visit UUID lookup');
                }
              } else {
                // Try legacy ID from visit
                const { data: legacyPatient, error: legacyError } = await supabase
                  .from('patients')
                  .select('*')
                  .eq('patient_id', visitPatientId)
                  .eq('organization_id', orgId)
                  .maybeSingle();
                
                if (legacyPatient && !legacyError) {
                  patientData = legacyPatient;
                  console.log('✅ [LAB-BILLING] Found patient via visit legacy ID lookup');
                }
              }
            }
          }
          
          // Method 3: Try case-insensitive partial match
          if (!patientData) {
            const { data: patientList, error: listError } = await supabase
              .from('patients')
              .select('*')
              .eq('organization_id', orgId)
              .ilike('patient_id', `%${order.patient_id}%`)
              .limit(5);
            
            if (patientList && patientList.length > 0) {
              patientData = patientList[0];
              console.log('✅ [LAB-BILLING] Found patient via partial match');
            }
          }
          
          // Convert Supabase patient format to our format
          if (patientData) {
            patient = {
              id: patientData.patient_id || patientData.id,
              patient_id: patientData.patient_id || patientData.id,
              _supabaseUuid: patientData.id,
              firstName: patientData.first_name || '',
              lastName: patientData.last_name || '',
              first_name: patientData.first_name || '',
              last_name: patientData.last_name || '',
              dob: patientData.date_of_birth,
              gender: patientData.gender,
              phone: patientData.phone,
              email: patientData.email
            };
            console.log('✅ [LAB-BILLING] Found patient via comprehensive lookup:', patient.patient_id);
          }
        }
      } catch (error) {
        console.error('❌ [LAB-BILLING] Comprehensive lookup failed:', error);
      }
    }
    
    // Final check: If patient still not found, show error - don't create invoice with wrong patient
    if (!patient) {
      alert(`Patient "${order.patient_id}" not found in database. Please ensure the patient exists before generating an invoice.\n\nYou may need to:\n1. Check if the patient ID is correct\n2. Sync patient data from localStorage to Supabase\n3. Verify the patient exists in the patients list`);
      return null;
    }
    
    
    // Parse selected items: use override, or combine from group, or single order.
    // Normalize to array (Supabase JSONB can sometimes be object; ensure we never drop items).
    function toItemArray(raw) {
      if (raw == null) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (e) { return []; }
      }
      if (typeof raw === 'object' && !Array.isArray(raw)) return Object.values(raw);
      return [];
    }
    let selectedItems = [];
    if (Array.isArray(selectedItemsOverride) && selectedItemsOverride.length > 0) {
      selectedItems = toItemArray(selectedItemsOverride);
    } else if (isGroup) {
      const { data: groupOrders } = await supabase.from('orders').select('selected_items').eq('type', 'lab').in('id', orderIds);
      for (const o of (groupOrders || [])) {
        const items = toItemArray(o.selected_items);
        selectedItems.push(...items);
      }
    } else {
      // Single order: re-fetch selected_items from DB so we never use a stale/cached list and never drop items
      const orderIdForFetch = orderIds[0];
      const { data: orderRow, error: fetchErr } = await supabase.from('orders').select('selected_items').eq('id', orderIdForFetch).single();
      const raw = (orderRow && orderRow.selected_items != null) ? orderRow.selected_items : order.selected_items;
      selectedItems = toItemArray(raw);
      console.log('[LAB-BILLING-TRACE] Single order fetch', {
        orderIdForFetch,
        fetchError: fetchErr ? fetchErr.message : null,
        rawType: raw == null ? 'null' : typeof raw,
        rawIsArray: Array.isArray(raw),
        rawLength: Array.isArray(raw) ? raw.length : (raw && typeof raw === 'object' ? Object.keys(raw).length : 0),
        rawPreview: raw == null ? null : (typeof raw === 'string' ? raw.substring(0, 200) : JSON.stringify(raw).substring(0, 300)),
        selectedItemsLength: selectedItems.length,
        selectedItemsNames: selectedItems.map(function (t) { return (t && (t.name != null ? t.name : t)) || t; })
      });
    }
    
    if (selectedItems.length === 0) {
      alert('No lab tests found in this order.');
      return null;
    }
    
    // For existing orders stored with expanded sub-tests, collapse to one line per panel so we bill panel price once
    const beforeCollapse = selectedItems.slice();
    selectedItems = collapseSelectedItemsForBilling(selectedItems);
    console.log('[LAB-BILLING-TRACE] After collapse', {
      beforeCollapseLength: beforeCollapse.length,
      afterCollapseLength: selectedItems.length,
      afterCollapseNames: selectedItems.map(function (t) { return (t && t.name) || t; })
    });
    
    // Map tests to services and calculate total
    const services = [];
    let totalAmount = 0;
    const defaultCurrency = localStorage.getItem(getBillingKey('default_currency')) || 'USD';
    
    for (const test of selectedItems) {
      const testName = test.name || test;
      const cptCode = test.cpt || test.code;
      
      if (!cptCode) {
        console.warn(`No CPT code found for test: ${testName}`);
        // Try to find by name in catalog
        const catalog = window.getPricingCatalog();
        const serviceByName = catalog.find(s => 
          (s.name || '').toLowerCase().includes(testName.toLowerCase()) &&
          s.category === 'Laboratory'
        );
        
        if (serviceByName) {
          services.push({
            id: serviceByName.id,
            code: serviceByName.code,
            name: serviceByName.name,
            quantity: 1,
            price: serviceByName.price,
            total: serviceByName.price
          });
          totalAmount += serviceByName.price;
        } else {
          // Default price if not found
          services.push({
            id: `LAB-${Date.now()}-${Math.random()}`,
            code: `LAB-UNKNOWN`,
            name: testName,
            quantity: 1,
            price: 50,
            total: 50
          });
          totalAmount += 50;
        }
        continue;
      }
      
      const serviceData = getServicePriceByCpt(cptCode);
      if (serviceData) {
        services.push({
          id: serviceData.id,
          code: serviceData.code,
          name: serviceData.name || testName,
          quantity: 1,
          price: serviceData.price,
          total: serviceData.price,
          taxable: serviceData.taxable
        });
        totalAmount += serviceData.price;
      } else {
        // Default price if CPT not found in catalog
        console.warn(`Service not found for CPT ${cptCode}, using default price`);
        services.push({
          id: `LAB-${Date.now()}-${Math.random()}`,
          code: mapCptToServiceCode(cptCode),
          name: testName,
          quantity: 1,
          price: 50,
          total: 50
        });
        totalAmount += 50;
      }
    }
    
    if (services.length === 0) {
      alert('Could not map lab tests to services. Please check the pricing catalog.');
      return null;
    }
    
    console.log('[LAB-BILLING-TRACE] Before createInvoice', {
      servicesLength: services.length,
      servicesNames: services.map(function (s) { return s.name; }),
      totalAmount
    });
    
    if (services.length === 1) {
      var oneName = services[0].name || '';
      var msg = 'This order has only 1 test in the system (' + oneName + '). The invoice will show 1 line.\n\nIf you expected 2 tests (e.g. Hepatitis B Profile + Hormonal Profile), cancel below and:\n1. Go to Select Lab Orders\n2. Create a NEW lab order with both tests selected\n3. Send to Lab Scientist\n4. Generate Invoice for that new order.\n\nCreate this 1-line invoice anyway?';
      if (!confirm(msg)) {
        cleanupLock();
        return null;
      }
    }
    
    // Get tax rate
    const taxRate = parseFloat(localStorage.getItem(getBillingKey('default_tax_rate')) || '0');
    const taxableServices = services.filter(s => s.taxable !== false);
    const subtotal = totalAmount;
    const taxAmount = taxableServices.reduce((sum, s) => sum + (s.total * taxRate / 100), 0);
    const total = subtotal + taxAmount;
    
    // Create invoice data
    const invoiceData = {
      patientId: patient.id || patient.patient_id,
      patientName: `${patient.firstName || patient.first_name || ''} ${patient.lastName || patient.last_name || ''}`.trim(),
      services: services,
      currency: defaultCurrency,
      taxRate: taxRate,
      discountAmount: 0,
      notes: `Invoice for Lab Order ${typeof window.formatLabOrderSerial === 'function' ? window.formatLabOrderSerial(order.serial_number || order.id, order.id, order) : (order.serial_number || order.id.substring(0, 8))}`,
      encounterId: order.visit_date || order.created_at,
      // Link to lab order
      labOrderId: orderId
    };
    
    // Create invoice
    const invoice = await window.createInvoice(invoiceData);
    
    if (!invoice || !invoice.id) {
      alert('Failed to create invoice. Please try again.');
      return null;
    }
    
    // Link invoice to lab order(s) — all orders in group get same invoice_id
    const updatePayload = {
      invoice_id: invoice.id,
      payment_status: 'pending',
      updated_at: new Date().toISOString()
    };
    const { error: updateError } = isGroup
      ? await supabase.from('orders').update(updatePayload).eq('type', 'lab').in('id', orderIds)
      : await supabase.from('orders').update(updatePayload).eq('id', orderId);
    
    if (updateError) {
      console.error('Error linking invoice to lab order(s):', updateError);
    }
    
    window.location.href = `/collect-payment?invoiceId=${invoice.id}&labOrderId=${orderIds[0]}`;
    
    cleanupLock();
    return invoice;
  } catch (error) {
    console.error('Error generating invoice from lab order:', error);
    alert('Error generating invoice: ' + error.message);
    cleanupLock();
    return null;
  } finally {
    hideGeneratingInvoiceOverlay();
  }
};

// Check if lab order payment is confirmed
window.isLabOrderPaymentConfirmed = async function(orderId) {
  try {
    const supabase = await window.getLabSupabaseClient();
    const { data: order, error } = await supabase
      .from('orders')
      .select('invoice_id, payment_status')
      .eq('id', orderId)
      .single();
    
    if (error || !order) {
      return false;
    }
    
    // Check payment status
    if (order.payment_status === 'paid' || order.payment_status === 'confirmed') {
      return true;
    }
    
    // Check invoice payment status
    if (order.invoice_id) {
      const invoice = await window.getInvoiceById(order.invoice_id);
      if (invoice && (invoice.status === 'paid' || invoice.amountPaid >= invoice.total)) {
        // Update this order and any other orders sharing this invoice (retroactive group)
        await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          })
          .eq('invoice_id', order.invoice_id);
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking payment status:', error);
    return false;
  }
};

// Process payment for lab order
window.processLabOrderPayment = async function(orderId) {
  if (!window.canInvoiceLabOrders()) {
    alert('Access denied. Only Medical Lab Scientists, Biller/Accountant, and Administrators can process payments for lab orders.');
    return null;
  }
  
  try {
    const supabase = await window.getLabSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('invoice_id')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order || !order.invoice_id) {
      alert('No invoice found for this lab order. Please generate an invoice first.');
      return null;
    }
    
    // Redirect to collect payment page
    window.location.href = `/collect-payment?invoiceId=${order.invoice_id}&labOrderId=${orderId}`;
  } catch (error) {
    console.error('Error processing lab order payment:', error);
    alert('Error: ' + error.message);
    return null;
  }
};

// Print receipt for lab order
window.printLabOrderReceipt = async function(orderId) {
  try {
    const supabase = await window.getLabSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('invoice_id')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order || !order.invoice_id) {
      alert('No invoice found for this lab order.');
      return;
    }
    
    // Get payment for this invoice
    const payments = await window.getAllPayments();
    const payment = payments.find(p => p.invoiceId === order.invoice_id && p.status === 'completed');
    
    if (payment && typeof window.printReceipt === 'function') {
      window.printReceipt(payment.id);
    } else {
      // Redirect to invoice details to print from there (pass orderId for fallback load)
      window.location.href = `/invoice-details?id=${order.invoice_id}&orderId=${orderId}`;
    }
  } catch (error) {
    console.error('Error printing receipt:', error);
    alert('Error: ' + error.message);
  }
};

// Cancel/Delete invoice and unlink from lab order
window.cancelLabOrderInvoice = async function(orderId) {
  if (!window.canInvoiceLabOrders || !window.canInvoiceLabOrders()) {
    alert('Access denied. Only Medical Lab Scientists, Biller/Accountant, and Administrators can cancel invoices for lab orders.');
    return false;
  }
  
  try {
    const supabase = await window.getLabSupabaseClient();
    
    // Get lab order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('invoice_id')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order || !order.invoice_id) {
      alert('No invoice found for this lab order.');
      return false;
    }
    
    const invoiceId = order.invoice_id;
    
    // Get invoice to check status
    const invoice = await window.getInvoiceById(invoiceId);
    if (!invoice) {
      alert('Invoice not found.');
      return false;
    }
    
    // Check if invoice has payments
    if (invoice.amountPaid > 0) {
      alert('Cannot cancel invoice with payments. Please delete all payments first.');
      return false;
    }
    
    // Confirm cancellation
    const confirmMessage = `Are you sure you want to cancel invoice ${invoice.invoiceNumber}?\n\nThis will:\n- Cancel the invoice\n- Unlink it from the lab order\n- Reset the order to "Not Invoiced" status\n\nThe invoice will remain in the system but marked as cancelled.`;
    
    if (!confirm(confirmMessage)) {
      return false;
    }
    
    // Cancel the invoice
    if (typeof window.cancelInvoice === 'function') {
      await window.cancelInvoice(invoiceId, 'Cancelled from lab order dashboard');
    } else {
      // Fallback: delete the invoice if cancelInvoice doesn't exist
      if (typeof window.deleteInvoice === 'function') {
        const deleted = await window.deleteInvoice(invoiceId);
        if (!deleted) {
          alert('Failed to cancel invoice.');
          return false;
        }
      } else {
        alert('Invoice cancellation function not available.');
        return false;
      }
    }
    
    // Unlink invoice from lab order(s) — all orders with this invoice_id (including grouped)
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        invoice_id: null,
        payment_status: 'unpaid',
        updated_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId);
    
    if (updateError) {
      console.error('Error unlinking invoice from lab order(s):', updateError);
      alert('Invoice cancelled, but failed to unlink from lab order(s). Please refresh the page.');
      return false;
    }
    
    // Reload dashboard
    if (typeof loadIncomingOrders === 'function') {
      loadIncomingOrders();
    }
    if (typeof loadInProcessOrders === 'function') {
      loadInProcessOrders();
    }
    
    alert('Invoice cancelled successfully. Lab order has been reset to "Not Invoiced" status.');
    return true;
  } catch (error) {
    console.error('Error cancelling lab order invoice:', error);
    alert('Error cancelling invoice: ' + error.message);
    return false;
  }
};

// Get billing key helper
function getBillingKey(key) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_${key}`;
}

console.log('✅ Lab Order Billing module loaded');
console.log('🔍 [LAB-BILLING] Module check:', {
  generateInvoiceFromLabOrder: typeof window.generateInvoiceFromLabOrder === 'function',
  isLabOrderPaymentConfirmed: typeof window.isLabOrderPaymentConfirmed === 'function',
  processLabOrderPayment: typeof window.processLabOrderPayment === 'function',
  printLabOrderReceipt: typeof window.printLabOrderReceipt === 'function',
  canInvoiceLabOrders: typeof window.canInvoiceLabOrders === 'function'
});


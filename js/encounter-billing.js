// Purpose: Create invoice from clinical encounter/visit (consultation billing)
// Links encounter to invoice for audit and charge capture from EMR

window.createInvoiceFromEncounter = async function(patient, visitDate, serviceIdOrCode, encounter) {
  if (!patient || !visitDate) {
    console.warn('createInvoiceFromEncounter: patient and visitDate required');
    return null;
  }
  if (typeof window.getPricingCatalog !== 'function' || typeof window.createInvoice !== 'function') {
    console.error('Billing modules not loaded');
    return null;
  }

  let invoiceData = null;

  if (window.MediForgeBillingService) {
    try {
      const billing = await window.MediForgeBillingService.getService();
      const enc = encounter || {
        id: `${patient.id || patient.patient_id}-${visitDate}`,
        visitDate,
        date: visitDate,
        diagnosisCodes: patient.diagnoses || []
      };
      invoiceData = billing.mapEncounterToInvoiceData({ encounter: enc, patient });
      if (serviceIdOrCode && billing.lookupFeeCode) {
        const fee = billing.lookupFeeCode(serviceIdOrCode, {
          province: patient.province || patient.state
        });
        if (fee) {
          invoiceData.services = [{
            code: fee.code,
            name: fee.description,
            category: fee.category || 'Consultation',
            quantity: 1,
            price: fee.amount,
            total: fee.amount,
            feeCode: fee.code,
            taxable: false
          }];
          invoiceData.total = fee.amount;
        }
      }
      invoiceData.billingModeAtCapture = billing.mode;
      invoiceData.currency = billing.config?.defaultCurrency;
    } catch (e) {
      console.warn('BillingService encounter map failed, using catalog fallback:', e.message);
    }
  }

  if (!invoiceData || !invoiceData.services?.length) {
    const catalog = window.getPricingCatalog();
    const catalogData = catalog && catalog.then ? await catalog : catalog;
    const services = Array.isArray(catalogData) ? catalogData : [];
    let service = null;
    if (serviceIdOrCode) {
      service = services.find(s => s.id === serviceIdOrCode || s.code === serviceIdOrCode);
    }
    if (!service) {
      service = services.find(s => (s.category || '').toLowerCase().includes('consultation')) ||
        services.find(s => (s.name || '').toLowerCase().includes('consultation')) ||
        services.find(s => (s.name || '').toLowerCase().includes('general')) ||
        services[0];
    }
    if (!service) {
      console.warn('No service found in catalog for encounter billing');
      return null;
    }
    const encounterId = `${patient.id || patient.patient_id}-${visitDate}`;
    const patientName = [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') ||
      patient.patientName || patient.name || 'Unknown';
    const apptType = encounter?.appointmentType || '';
    const apptId = encounter?.appointmentId || encounter?.id;
    invoiceData = {
      patientId: patient.patient_id || patient.patientNumber || patient.id || patient._supabaseUuid,
      patientName,
      date: visitDate,
      encounterId: apptId || encounterId,
      services: [{
        id: service.id,
        code: service.code,
        name: service.name,
        category: service.category || 'Consultation',
        quantity: 1,
        price: parseFloat(service.price) || 0,
        total: parseFloat(service.price) || 0,
        taxable: service.taxable !== false
      }],
      notes: apptId
        ? (apptType ? `Invoice for ${apptType} appointment` : 'Invoice for appointment')
        : `Encounter ${visitDate} - ${service.name}`
    };
  }

  const currency = invoiceData.currency ||
    localStorage.getItem((patient.org || 'Default') + '_billing_default_currency') ||
    (window.MediForgeBillingMode ? await window.MediForgeBillingMode.getBillingMode().then(m => m === 'USA' ? 'USD' : 'CAD') : 'CAD');
  invoiceData.currency = currency;

  const invoice = await window.createInvoice(invoiceData);

  if (invoice && window.MediForgePayerWorkflow) {
    const route = await window.MediForgePayerWorkflow.resolvePostInvoiceRoute(invoice, patient);
    if (route?.skipCollectPayment && route.message) {
      console.log('[encounter-billing]', route.message);
    }
    invoice._postInvoiceRoute = route;
  }

  if (invoice && window.MediForgeBillingService) {
    try {
      const billing = await window.MediForgeBillingService.getService();
      const claim = billing.generateClaim({
        encounter: encounter || { visitDate, date: visitDate },
        patient,
        invoice,
        services: invoiceData.services
      });
      invoice.claimDraft = claim;
    } catch (e) {
      console.warn('Claim draft generation skipped:', e.message);
    }
  }

  return invoice;
};

function buildInvoiceLaunchReturnUrl() {
  return window.location.pathname + (window.location.search || '');
}

function resolveServiceCodeForAppointmentType(appointmentType) {
  const t = String(appointmentType || '').toLowerCase();
  if (t.includes('follow')) return 'CONS-003';
  if (t.includes('specialist')) return 'CONS-002';
  return 'CONS-001';
}

function resolveInvoiceReturnUrl(fallback) {
  const raw = new URLSearchParams(window.location.search).get('returnUrl');
  if (!raw) {
    if (fallback) return fallback;
    try {
      if (document.referrer && document.referrer.includes(window.location.hostname)) {
        const ref = new URL(document.referrer);
        if (ref.pathname && !ref.pathname.includes('collect-payment') && !ref.pathname.includes('invoice-details')) {
          return ref.pathname + ref.search;
        }
      }
    } catch (_) { /* ignore */ }
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.startsWith('/') || decoded.startsWith('http') ? decoded : '/' + decoded;
  } catch (_) {
    return raw.startsWith('/') ? raw : '/' + raw;
  }
}

function appendInvoiceReturnUrl(path, returnUrl) {
  if (!returnUrl) return path;
  const sep = path.includes('?') ? '&' : '?';
  return path + sep + 'returnUrl=' + encodeURIComponent(returnUrl);
}

async function discardPendingInvoiceIfUntouched(invoiceId) {
  if (!invoiceId || typeof window.getInvoiceById !== 'function') return false;
  const inv = await window.getInvoiceById(invoiceId);
  if (!inv) return false;
  if ((parseFloat(inv.amountPaid) || 0) > 0) return false;
  if (inv.status !== 'pending' && inv.status !== 'claim_pending') return false;
  if (typeof window.cancelInvoice === 'function') {
    await window.cancelInvoice(invoiceId, 'Discarded before payment or billing confirmation');
    return true;
  }
  return false;
}

window.buildInvoiceLaunchReturnUrl = buildInvoiceLaunchReturnUrl;
window.resolveServiceCodeForAppointmentType = resolveServiceCodeForAppointmentType;
window.resolveInvoiceReturnUrl = resolveInvoiceReturnUrl;
window.appendInvoiceReturnUrl = appendInvoiceReturnUrl;
window.discardPendingInvoiceIfUntouched = discardPendingInvoiceIfUntouched;

window.discardPendingInvoiceAndReturn = async function discardPendingInvoiceAndReturn(fallback) {
  const params = new URLSearchParams(window.location.search);
  const invoiceId = params.get('invoiceId') || params.get('id');
  if (invoiceId) await discardPendingInvoiceIfUntouched(invoiceId);
  const target = resolveInvoiceReturnUrl(fallback || '/billing-dashboard');
  window.location.href = target || '/billing-dashboard';
};

/** Route after encounter invoice: payer-led (Canada) or patient pay, preserving launch context. */
window.navigateAfterEncounterInvoice = async function navigateAfterEncounterInvoice(invoice, patient, options) {
  if (!invoice?.id) return;
  const returnUrl = options.returnUrl || buildInvoiceLaunchReturnUrl();
  const route = window.MediForgePayerWorkflow
    ? await window.MediForgePayerWorkflow.resolvePostInvoiceRoute(invoice, patient)
    : null;

  if (route?.skipCollectPayment) {
    if (route.message) alert(route.message);
    window.location.href = resolveInvoiceReturnUrl(returnUrl) || returnUrl;
    return;
  }

  let dest = `/collect-payment?invoiceId=${invoice.id}`;
  dest = appendInvoiceReturnUrl(dest, returnUrl);
  window.location.href = dest;
};

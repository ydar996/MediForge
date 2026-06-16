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
    invoiceData = {
      patientId: patient.id || patient.patient_id,
      patientName,
      date: visitDate,
      encounterId,
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
      notes: `Encounter ${visitDate} - ${service.name}`
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

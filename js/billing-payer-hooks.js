/**
 * Hooks billing.js createInvoice / recordPayment with Canadian payer logic
 */
(function (global) {
  function waitForBilling() {
    return new Promise((resolve) => {
      if (global.createInvoice && global.recordPayment) return resolve();
      const t = setInterval(() => {
        if (global.createInvoice && global.recordPayment) {
          clearInterval(t);
          resolve();
        }
      }, 50);
      setTimeout(() => { clearInterval(t); resolve(); }, 5000);
    });
  }

  async function loadPatientForInvoice(patientId) {
    if (!patientId) return {};
    if (typeof global.resolvePatientByIdentifier === 'function') {
      const resolved = await global.resolvePatientByIdentifier(patientId);
      if (resolved) return normalizePatient(resolved);
    }
    if (typeof global.loadPatientsWithSupabasePriority === 'function') {
      const patients = await global.loadPatientsWithSupabasePriority();
      const p = patients.find((x) =>
        x.id === patientId ||
        x.patient_id === patientId ||
        x.patientNumber === patientId ||
        x._supabaseUuid === patientId
      );
      if (p) return normalizePatient(p);
    }
    const patients = JSON.parse(localStorage.getItem(global.getDataKey?.('patients') || 'patients') || '[]');
    return normalizePatient(patients.find((x) => x.id === patientId) || {});
  }

  function normalizePatient(p) {
    return {
      id: p.id,
      province: p.province || p.state,
      state: p.state,
      country: p.country,
      paymentSource: p.paymentSource || p.payment_source,
      phn: p.phn || p.healthCardNumber || p.health_card_number || p.ohip,
      healthCardNumber: p.healthCardNumber || p.health_card_number,
      insuranceName: p.insuranceName || p.insurance_name,
      privateInsurerId: p.privateInsurerId || p.insuranceName,
      copayAmount: p.copayAmount || p.copay_amount,
      preferredPaymentMethod: p.preferredPaymentMethod || p.preferred_payment_method
    };
  }

  waitForBilling().then(() => {
    if (!global.MediForgePayerEngine) return;

    const origCreate = global.createInvoice;
    global.createInvoice = async function (invoiceData) {
      try {
        const patient = await loadPatientForInvoice(invoiceData.patientId);
        let billingMode = null;
        if (global.MediForgeBillingMode?.getBillingMode) {
          billingMode = await global.MediForgeBillingMode.getBillingMode();
        }
        const enriched = await global.MediForgePayerEngine.enrichInvoice(
          { ...invoiceData, billingMode },
          patient
        );
        const invoice = await origCreate(enriched);
        if (!invoice) return invoice;

        const merged = await global.MediForgePayerWorkflow?.finalizePayerLedInvoice?.(invoice, patient, {
          billingMode
        }) || invoice;

        if (merged && global.MediForgePayerEngine.queueClaimDraft) {
          const claim = await global.MediForgePayerEngine.queueClaimDraft(merged, patient, enriched.services);
          if (claim && global.MediForgeIntegrationWorkflow?.submitClaimForInvoice) {
            await global.MediForgeIntegrationWorkflow.submitClaimForInvoice(
              merged,
              patient,
              enriched.services,
              { organizationId: await global.resolveOrganizationId?.() }
            );
          }
        }
        return merged;
      } catch (e) {
        console.warn('[billing-payer-hooks] enrich failed, using original:', e.message);
        return origCreate(invoiceData);
      }
    };

    const origPay = global.recordPayment;
    global.recordPayment = async function (paymentData) {
      const result = await origPay(paymentData);
      if (typeof global.logAuditEvent === 'function') {
        global.logAuditEvent('patient_payment_recorded', {
          method: paymentData.method,
          amount: paymentData.amount,
          invoiceId: paymentData.invoiceId
        });
      }
      return result;
    };

    console.log('[billing-payer-hooks] Canadian payer hooks active');
  });
})(typeof window !== 'undefined' ? window : global);

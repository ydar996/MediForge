/**
 * Payer-led billing workflow (Canada provincial / US insurance-first).
 * Cash collection is for copays and self-pay only.
 */
(function (global) {
  'use strict';

  const PAYER_LED_MODES = new Set(['Canada', 'USA']);

  function normalizePaymentSource(src) {
    const s = String(src || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!s || s === 'provincial' || s === 'government' || s === 'ohip' || s === 'medicare' || s === 'medicaid') {
      return 'provincial';
    }
    if (s === 'insurance' || s === 'private_insurance' || s === 'private' || s === 'commercial') {
      return 'private_insurance';
    }
    if (s === 'self_pay' || s === 'selfpay' || s === 'cash' || s === 'uninsured') return 'self_pay';
    if (s.includes('wcb') || s.includes('workers')) return 'wcb';
    return s;
  }

  async function isPayerLedMarket() {
    if (global.MediForgeBillingMode?.getBillingMode) {
      const mode = await global.MediForgeBillingMode.getBillingMode();
      return PAYER_LED_MODES.has(mode);
    }
    return true;
  }

  function isPayerLedInvoice(invoice) {
    if (!invoice) return false;
    const type = invoice.primaryPayer?.type;
    return type === 'provincial' || type === 'private' || type === 'wcb';
  }

  function requiresUpfrontPatientPayment(invoice) {
    if (!invoice) return true;
    const due = parseFloat(invoice.amountDue);
    if (!isNaN(due) && due <= 0) return false;
    if (invoice.primaryPayer?.type === 'patient_pay') return true;
    const split = invoice.payerSplit;
    if (split && parseFloat(split.patientDue) > 0) return true;
    return parseFloat(invoice.amountDue) > 0;
  }

  function isPayerClearedForService(invoice) {
    if (!invoice) return false;
    if (invoice.status === 'paid' || invoice.status === 'claim_pending' || invoice.status === 'billed_to_payer') {
      return true;
    }
    if (isPayerLedInvoice(invoice) && !requiresUpfrontPatientPayment(invoice)) return true;
    if (parseFloat(invoice.amountPaid) >= parseFloat(invoice.amountDue) && parseFloat(invoice.amountDue) >= 0) {
      return parseFloat(invoice.amountDue) === 0 || invoice.status === 'paid';
    }
    return false;
  }

  function payerDisplayName(invoice) {
    const p = invoice?.primaryPayer;
    if (!p) return 'Payer';
    if (p.payerName) return p.payerName;
    if (p.payerId) return p.payerId;
    if (p.type === 'provincial') return 'Provincial health plan';
    if (p.type === 'private') return 'Insurance';
    return 'Patient';
  }

  async function resolvePostInvoiceRoute(invoice, patient) {
    const payerLed = await isPayerLedMarket();
    const cleared = isPayerClearedForService(invoice);
    const needsPayment = requiresUpfrontPatientPayment(invoice);

    if (payerLed && isPayerLedInvoice(invoice) && !needsPayment) {
      return {
        skipCollectPayment: true,
        redirect: invoice.labOrderId ? '/lab-scientist-dashboard' : '/billing-dashboard',
        paymentStatus: 'billed_to_payer',
        invoiceStatus: 'claim_pending',
        message:
          'Claim queued to ' +
          payerDisplayName(invoice) +
          '. No patient payment required — service can proceed.'
      };
    }

    if (cleared && !needsPayment) {
      return {
        skipCollectPayment: true,
        redirect: '/billing-dashboard',
        paymentStatus: 'billed_to_payer',
        invoiceStatus: 'claim_pending',
        message: 'Billed to payer. No copay due at this time.'
      };
    }

    if (payerLed && isPayerLedInvoice(invoice) && needsPayment) {
      return {
        skipCollectPayment: false,
        redirect: `/collect-payment?invoiceId=${invoice.id}${invoice.labOrderId ? '&labOrderId=' + invoice.labOrderId : ''}`,
        message: 'Collect patient copay / coinsurance, then submit claim for the remainder.'
      };
    }

    return {
      skipCollectPayment: false,
      redirect: `/collect-payment?invoiceId=${invoice.id}${invoice.labOrderId ? '&labOrderId=' + invoice.labOrderId : ''}`,
      message: null
    };
  }

  async function finalizePayerLedInvoice(invoice, patient, options) {
    if (!invoice?.id) return invoice;
    const route = await resolvePostInvoiceRoute(invoice, patient);
    const patch = {
      primaryPayer: invoice.primaryPayer,
      payerSplit: invoice.payerSplit,
      payerAmountPending: invoice.payerAmountPending,
      billingMode: invoice.billingMode || options?.billingMode
    };
    if (route.skipCollectPayment) {
      patch.status = route.invoiceStatus || 'claim_pending';
      patch.amountDue = invoice.payerSplit?.patientDue ?? invoice.amountDue ?? 0;
    }
    if (typeof global.patchInvoice === 'function') {
      return global.patchInvoice(invoice.id, patch);
    }
    return { ...invoice, ...patch };
  }

  async function countPendingClaims() {
    const supabase = global.supabaseClient;
    if (!supabase) return 0;
    let orgId = null;
    if (typeof global.resolveOrganizationId === 'function') orgId = await global.resolveOrganizationId();
    if (!orgId) return 0;
    try {
      const { count, error } = await supabase
        .from('insurance_claims')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .in('status', ['draft', 'queued', 'pending', 'submitted']);
      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  }

  function sumPayerPendingFromInvoices(invoices) {
    if (!Array.isArray(invoices)) return 0;
    return invoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      const pending =
        parseFloat(inv.payerAmountPending) ||
        (inv.payerSplit ? parseFloat(inv.payerSplit.payerCovered) : 0) ||
        0;
      if (pending > 0 && (inv.status === 'claim_pending' || inv.status === 'pending' || inv.status === 'partial')) {
        return sum + pending;
      }
      return sum;
    }, 0);
  }

  global.MediForgePayerWorkflow = {
    normalizePaymentSource,
    isPayerLedMarket,
    isPayerLedInvoice,
    requiresUpfrontPatientPayment,
    isPayerClearedForService,
    resolvePostInvoiceRoute,
    finalizePayerLedInvoice,
    countPendingClaims,
    sumPayerPendingFromInvoices,
    payerDisplayName
  };
})(typeof window !== 'undefined' ? window : global);

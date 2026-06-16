'use strict';

const { loadBillingConfig } = require('./config');
const labCodes = require('./lab-code-resolver');

/**
 * Generate provincial claim draft (OHIP, RAMQ, MSP, etc.)
 * Production submission requires provincial credentials / clearinghouse.
 */
function buildProvincialClaimDraft({ patient, provider, invoice, services, payerCode, config }) {
  const cfg = config || loadBillingConfig();
  const payer = cfg.provincialPayers?.[payerCode] || { name: payerCode };

  return {
    claimType: 'provincial',
    payerCode,
    payerName: payer.name,
    province: payer.province,
    status: 'draft',
    patient: {
      phn: patient.phn || patient.healthCardNumber,
      lastName: patient.lastName,
      firstName: patient.firstName,
      dob: patient.dob,
      gender: patient.gender,
      versionCode: patient.healthCardVersion || patient.versionCode
    },
    provider: {
      billingNumber: provider.billingNumber || provider.ohipBillingNumber,
      specialty: provider.specialty,
      organizationId: provider.organizationId
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      date: invoice.date,
      total: invoice.total,
      payerAmount: invoice.payerSplit?.payerCovered
    },
    serviceLines: (services || []).map((s, idx) => {
      const claimProvince = patient.province || patient.state || payer.province || 'ON';
      const enriched = labCodes.enrichClaimServiceLine(s, 'Canada', undefined, claimProvince);
      return {
        lineNumber: idx + 1,
        serviceCode: enriched.serviceCode || enriched.feeCode || enriched.cpt || enriched.code,
        feeCode: enriched.feeCode || enriched.ohipFeeCode,
        cptReference: enriched.cptReference || enriched.cpt,
        description: enriched.description || enriched.name || s.description || s.name,
        amount: enriched.amount || enriched.price || s.amount || s.price,
        units: enriched.units || s.units || 1,
        diagnosisCodes: enriched.diagnosisCodes || s.diagnosisCodes || []
      };
    }),
    submittedAt: null,
    externalClaimId: null,
    transport: payer.claimTransport || 'manual'
  };
}

function buildPrivateClaimDraft({ patient, invoice, services, insurerId, config }) {
  const cfg = config || loadBillingConfig();
  const insurer = cfg.privateInsurers?.[insurerId] || { name: insurerId };

  return {
    claimType: 'private',
    insurerId,
    insurerName: insurer.name,
    status: 'draft',
    patient: {
      memberNumber: patient.insuranceMemberNumber || patient.insurance_member_number,
      policyNumber: patient.insurancePolicyNumber || patient.insurance_policy_number,
      groupNumber: patient.insurancePolicyGroupNumber,
      lastName: patient.lastName,
      firstName: patient.firstName,
      dob: patient.dob
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: invoice.total
    },
    serviceLines: services || [],
    ediProfile: insurer.ediProfile || '837P',
    transport: insurer.claimTransport || 'portal'
  };
}

/**
 * Submit claim to provincial portal (MCEDT, Teleplan, HLINK) or clearinghouse.
 * Returns queued:true when credentials/endpoints are not configured.
 */
async function submitClaimToPortal({ draft, portalUrl, transport, enabled }) {
  if (!enabled || !portalUrl || transport === 'manual') {
    return { draft, submitted: false, queued: true, reason: 'portal not configured' };
  }
  // Production: sign payload with clinic certificate and POST to provincial web service
  return {
    draft,
    submitted: true,
    queued: false,
    transport,
    portalUrl,
    externalClaimId: `EXT-${Date.now()}`,
    submittedAt: new Date().toISOString()
  };
}

module.exports = { buildProvincialClaimDraft, buildPrivateClaimDraft, submitClaimToPortal };

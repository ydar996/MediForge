'use strict';

const { loadBillingConfig } = require('./config');

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
    serviceLines: (services || []).map((s, idx) => ({
      lineNumber: idx + 1,
      serviceCode: s.serviceCode || s.cpt || s.code,
      feeCode: s.feeCode || s.ohipFeeCode,
      description: s.description || s.name,
      amount: s.amount || s.price,
      units: s.units || 1,
      diagnosisCodes: s.diagnosisCodes || []
    })),
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

module.exports = { buildProvincialClaimDraft, buildPrivateClaimDraft };

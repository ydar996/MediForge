'use strict';

const cutoff = require('./mcedt-cutoff');

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build MCEDT-oriented batch from provincial claim drafts or invoice export shape.
 */
function buildMcedtBatch({ claims, submitter, payerCode = 'OHIP', province = 'ON' }) {
  return {
    format: 'mcedt_batch',
    schemaVersion: '1.0',
    payerCode,
    province,
    status: 'draft',
    generatedAt: new Date().toISOString(),
    submitter: {
      billingNumber: submitter?.billingNumber || '',
      groupNumber: submitter?.groupNumber || '0001',
      softwareVendor: submitter?.softwareVendor || 'MEDIFORGE',
      organizationId: submitter?.organizationId || null
    },
    claims: (claims || []).map((c, idx) => normalizeClaim(c, idx))
  };
}

function normalizeClaim(claim, idx) {
  const patient = claim.patient || {};
  const invoice = claim.invoice || {};
  const lines = claim.serviceLines || claim.lines || [];
  return {
    claimReference: claim.claimReference || invoice.invoiceNumber || invoice.id || `CLAIM-${idx + 1}`,
    serviceDate: (claim.serviceDate || invoice.date || '').slice(0, 10),
    billingPeriod: cutoff.getBillingPeriod(claim.serviceDate || invoice.date)?.periodKey || null,
    cutoffDate: cutoff.getCutoffDate(claim.serviceDate || invoice.date),
    patient: {
      phn: patient.phn || patient.healthCardNumber || '',
      versionCode: patient.versionCode || patient.healthCardVersion || '',
      lastName: String(patient.lastName || '').toUpperCase(),
      firstName: String(patient.firstName || '').toUpperCase(),
      dob: String(patient.dob || '').replace(/-/g, '').slice(0, 8),
      gender: String(patient.gender || '').charAt(0).toUpperCase()
    },
    serviceLines: lines.map((line, lineIdx) => ({
      lineNumber: line.lineNumber || lineIdx + 1,
      feeCode: line.feeCode || line.serviceCode || line.code || '',
      diagnosticCode: (line.diagnosisCodes && line.diagnosisCodes[0]) || line.diagnosticCode || '',
      amount: parseFloat(line.amount || line.price || 0),
      units: line.units || 1,
      description: line.description || line.name || ''
    }))
  };
}

function validateClaimBatch(batch) {
  const errors = [];
  if (!batch) errors.push('Batch is required');
  if (!batch?.submitter?.billingNumber) errors.push('Submitter billing number is required');
  if (!batch?.claims?.length) errors.push('At least one claim is required');

  (batch?.claims || []).forEach((claim, i) => {
    const prefix = `Claim ${i + 1}`;
    if (!claim.patient?.phn) errors.push(`${prefix}: patient PHN is required`);
    else {
      const phnRaw = String(claim.patient.phn).replace(/\s/g, '');
      const version = String(claim.patient.versionCode || claim.patient.version_code || '').toUpperCase();
      const combined = /^\d{10}[A-Z]{2}$/i.test(phnRaw) ? phnRaw : phnRaw + version;
      if (!/^\d{10}[A-Z]{2}$/i.test(combined)) {
        errors.push(`${prefix}: PHN should be 10 digits plus 2-letter version code`);
      }
    }
    if (!claim.serviceDate) errors.push(`${prefix}: service date is required`);
    if (!claim.serviceLines?.length) errors.push(`${prefix}: at least one service line is required`);
    claim.serviceLines?.forEach((line, j) => {
      if (!line.feeCode) errors.push(`${prefix} line ${j + 1}: fee code is required`);
    });
  });

  const cutoffCheck = cutoff.validateServiceDatesForBatch(batch?.claims || []);
  return {
    valid: errors.length === 0,
    errors,
    cutoffWarnings: cutoffCheck.warnings
  };
}

/**
 * Serialize batch to MOH-oriented XML (structured export; XSD conformance requires MOH test environment).
 */
function serializeBatchToXml(batch) {
  const validation = validateClaimBatch(batch);
  const claimsXml = (batch.claims || [])
    .map((claim) => {
      const linesXml = (claim.serviceLines || [])
        .map(
          (line) =>
            `      <ServiceLine lineNumber="${line.lineNumber}">` +
            `<FeeCode>${escapeXml(line.feeCode)}</FeeCode>` +
            `<DiagnosticCode>${escapeXml(line.diagnosticCode)}</DiagnosticCode>` +
            `<Amount>${line.amount}</Amount>` +
            `<Units>${line.units}</Units>` +
            `</ServiceLine>`
        )
        .join('\n');
      return (
        `    <Claim reference="${escapeXml(claim.claimReference)}">` +
        `<ServiceDate>${escapeXml(claim.serviceDate)}</ServiceDate>` +
        `<BillingPeriod>${escapeXml(claim.billingPeriod)}</BillingPeriod>` +
        `<CutoffDate>${escapeXml(claim.cutoffDate)}</CutoffDate>` +
        `<Patient>` +
        `<PHN>${escapeXml(claim.patient.phn)}</PHN>` +
        `<VersionCode>${escapeXml(claim.patient.versionCode)}</VersionCode>` +
        `<LastName>${escapeXml(claim.patient.lastName)}</LastName>` +
        `<FirstName>${escapeXml(claim.patient.firstName)}</FirstName>` +
        `<DOB>${escapeXml(claim.patient.dob)}</DOB>` +
        `<Gender>${escapeXml(claim.patient.gender)}</Gender>` +
        `</Patient>` +
        `<ServiceLines>\n${linesXml}\n    </ServiceLines>` +
        `</Claim>`
      );
    })
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<McedtClaimBatch xmlns="http://www.health.gov.on.ca/mcedt" version="${escapeXml(batch.schemaVersion || '1.0')}">` +
    `<GeneratedAt>${escapeXml(batch.generatedAt)}</GeneratedAt>` +
    `<PayerCode>${escapeXml(batch.payerCode)}</PayerCode>` +
    `<Province>${escapeXml(batch.province)}</Province>` +
    `<Submitter>` +
    `<BillingNumber>${escapeXml(batch.submitter.billingNumber)}</BillingNumber>` +
    `<GroupNumber>${escapeXml(batch.submitter.groupNumber)}</GroupNumber>` +
    `<SoftwareVendor>${escapeXml(batch.submitter.softwareVendor)}</SoftwareVendor>` +
    `</Submitter>` +
    `<Claims>\n${claimsXml}\n  </Claims>` +
    `</McedtClaimBatch>`
  );
}

function parseMohRejection(raw) {
  if (!raw) return { parsed: false, error: 'Empty rejection payload' };
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return {
        parsed: true,
        format: 'text',
        rejectionCode: 'UNKNOWN',
        message: raw,
        claimReference: null
      };
    }
  }
  return {
    parsed: true,
    format: data.format || 'json',
    rejectionCode: data.rejectionCode || data.code || data.reasonCode || 'REJECTED',
    message: data.message || data.error || data.description || 'Claim rejected',
    claimReference: data.claimReference || data.claimId || data.invoiceId,
    lineNumber: data.lineNumber || null,
    raw: data
  };
}

module.exports = {
  buildMcedtBatch,
  validateClaimBatch,
  serializeBatchToXml,
  parseMohRejection,
  normalizeClaim
};

'use strict';

const mcedtFormat = require('./mcedt-format');

const STATUS_TRANSITIONS = {
  draft: ['submitted', 'void'],
  submitted: ['accepted', 'rejected', 'void'],
  accepted: ['paid', 'rejected'],
  rejected: ['draft', 'submitted', 'void'],
  paid: ['void'],
  void: []
};

function canTransition(from, to) {
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

function transitionClaimStatus(claim, nextStatus, meta = {}) {
  const current = claim.status || 'draft';
  if (!canTransition(current, nextStatus)) {
    return { ok: false, error: `Cannot transition from ${current} to ${nextStatus}` };
  }
  return {
    ok: true,
    claim: {
      ...claim,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
      ...meta
    }
  };
}

function applyRejection(claim, rejection) {
  const parsed = mcedtFormat.parseMohRejection(rejection);
  const transitioned = transitionClaimStatus(claim, 'rejected', {
    error: parsed.message,
    rejectionCode: parsed.rejectionCode,
    rejectedAt: new Date().toISOString()
  });
  if (!transitioned.ok) return transitioned;
  return { ok: true, rejection: parsed, claim: transitioned.claim };
}

function resubmitClaim(claim) {
  const reset = {
    ...claim,
    status: 'draft',
    error: null,
    rejectionCode: null,
    externalClaimId: null,
    submittedAt: null,
    resubmittedAt: new Date().toISOString()
  };
  return { ok: true, claim: reset };
}

function buildBatchFromClaimRecords(records, submitter) {
  const claims = (records || []).map((r) => {
    const payload = r.claim_payload || r.claimPayload || r;
    return mcedtFormat.normalizeClaim(payload);
  });
  return mcedtFormat.buildMcedtBatch({ claims, submitter });
}

function summarizeClaimQueue(records) {
  const counts = { draft: 0, submitted: 0, accepted: 0, rejected: 0, paid: 0, void: 0 };
  (records || []).forEach((r) => {
    const s = r.status || 'draft';
    if (counts[s] !== undefined) counts[s] += 1;
  });
  return counts;
}

module.exports = {
  canTransition,
  transitionClaimStatus,
  applyRejection,
  resubmitClaim,
  buildBatchFromClaimRecords,
  summarizeClaimQueue
};

'use strict';

/**
 * Structured audit trail for integration flows.
 * Persists to Supabase interop_messages when a client is provided; always logs to console in dev.
 */

function buildAuditRecord({
  organizationId,
  direction,
  standard,
  messageType,
  correlationId,
  patientId,
  status,
  payload,
  error,
  userId,
  province,
  transport
}) {
  return {
    organization_id: organizationId || null,
    direction: direction || 'outbound',
    standard: standard || 'unknown',
    message_type: messageType,
    correlation_id: correlationId || null,
    patient_id: patientId || null,
    payload: payload ? sanitizePayload(payload) : null,
    status: status || 'sent',
    error: error || null,
    created_by: userId || 'integration-service',
    metadata: { province, transport, at: new Date().toISOString() }
  };
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const copy = JSON.parse(JSON.stringify(payload));
  ['clientSecret', 'password', 'bearerToken', 'apiKey'].forEach((key) => {
    if (copy[key]) copy[key] = '[REDACTED]';
  });
  if (copy.oauth?.clientSecret) copy.oauth.clientSecret = '[REDACTED]';
  return copy;
}

async function logAudit(supabase, record) {
  const entry = buildAuditRecord(record);
  console.info('[integration-audit]', entry.message_type, entry.status, entry.correlation_id || '');

  if (!supabase || !entry.organization_id) return { logged: false, entry };

  const { data, error } = await supabase
    .from('interop_messages')
    .insert({
      organization_id: entry.organization_id,
      direction: entry.direction,
      standard: entry.standard,
      message_type: entry.message_type,
      correlation_id: entry.correlation_id,
      patient_id: entry.patient_id,
      payload: entry.payload,
      status: entry.status,
      error: entry.error,
      created_by: entry.created_by
    })
    .select('id')
    .single();

  if (error) console.error('[integration-audit] persist error:', error.message);
  return { logged: !error, id: data?.id, entry };
}

module.exports = { buildAuditRecord, logAudit, sanitizePayload };

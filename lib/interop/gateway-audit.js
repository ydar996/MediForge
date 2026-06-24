'use strict';

const { logAudit } = require('../integrations/audit-logger');

/**
 * Log interop gateway action to interop_messages (and console).
 */
async function logGatewayAction(supabase, { action, body, status, error, resultMeta }) {
  const organizationId = body.organizationId || body.organization_id;
  const standard = inferStandard(action);
  return logAudit(supabase, {
    organizationId,
    direction: action.startsWith('ingest') || action === 'parseOru' || action === 'receiveResult' ? 'inbound' : 'outbound',
    standard,
    messageType: action,
    correlationId: body.orderId || body.correlationId || body.patient?.id || null,
    patientId: body.patient?.id || body.patientId || null,
    status: error ? 'error' : status || 'success',
    payload: resultMeta || { action },
    error: error ? String(error.message || error) : null,
    userId: body.userId || 'interop-gateway',
    province: body.province,
    transport: standard
  });
}

function inferStandard(action) {
  if (/Hl7|Oru|Orm|mllp/i.test(action)) return 'hl7v2';
  if (/fhir|Bundle|Patient/i.test(action)) return 'fhir';
  if (/dicom/i.test(action)) return 'dicom';
  if (/claim|remittance/i.test(action)) return 'billing';
  return 'gateway';
}

module.exports = { logGatewayAction };

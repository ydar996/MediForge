/**
 * MediForge Interoperability Gateway
 * Unified entry point for labs, imaging, Rx, DICOM, claims, and remittance.
 *
 * POST body: { action, organizationId, province?, ...payload }
 * Env: INTEROP_GATEWAY_API_KEY, INTEROP_FHIR_*, SUPABASE_*
 */
const integrations = require('../../lib/integrations');
const interop = require('../../lib/interop');
const { createClient } = require('@supabase/supabase-js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Interop-Key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body)
  };
}

function authorize(event) {
  const key = process.env.INTEROP_GATEWAY_API_KEY;
  if (!key) return true;
  const header = event.headers['x-interop-key'] || event.headers['X-Interop-Key'];
  const auth = event.headers.authorization || event.headers.Authorization;
  if (header === key) return true;
  if (auth === `Bearer ${key}`) return true;
  return false;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function buildService(body) {
  const province = body.province || process.env.INTEROP_DEFAULT_PROVINCE || 'ON';
  interop.config.clearConfigCache?.();
  integrations.configLoader.clearIntegrationsConfigCache();
  const config = integrations.loadIntegrationsConfig({ province, reload: true });
  return new integrations.IntegrationService({
    supabase: getSupabase(),
    config,
    province
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!authorize(event)) {
    return json(401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const service = buildService(body);
  const action = body.action;

  try {
    let result;
    switch (action) {
      case 'transmitLabOrder':
      case 'sendOrder':
        result = await service.sendOrder({
          type: 'lab',
          patient: body.patient,
          order: body.order,
          organizationId: body.organizationId,
          userId: body.userId
        });
        break;
      case 'transmitImagingOrder':
        result = await service.sendOrder({
          type: 'imaging',
          patient: body.patient,
          order: body.order,
          organizationId: body.organizationId,
          userId: body.userId
        });
        break;
      case 'ingestOru':
      case 'receiveResult':
        result = await service.receiveResult({
          rawHl7: body.rawHl7,
          fhirBundle: body.fhirBundle,
          organizationId: body.organizationId,
          userId: body.userId,
          orderId: body.orderId
        });
        break;
      case 'transmitPrescription':
      case 'sendPrescription':
        result = await service.sendPrescription({
          patient: body.patient,
          prescription: body.prescription,
          organizationId: body.organizationId,
          userId: body.userId
        });
        break;
      case 'submitClaim':
        result = await service.submitClaim({
          patient: body.patient,
          provider: body.provider,
          invoice: body.invoice,
          services: body.services,
          payerCode: body.payerCode,
          organizationId: body.organizationId,
          userId: body.userId
        });
        break;
      case 'processRemittance':
        result = await service.processRemittance({
          raw: body.raw || body.remittance,
          invoices: body.invoices,
          organizationId: body.organizationId,
          userId: body.userId
        });
        break;
      case 'dicomweb':
        result = await service.dicomweb({ operation: body.operation, params: body.params || {} });
        break;
      case 'matchPatient':
        result = service.matchPatient(body);
        break;
      case 'generateLabHl7':
        result = {
          hl7: interop.adapters.lab.orderToHl7({
            patient: body.patient,
            order: body.order,
            config: service.config
          })
        };
        break;
      case 'parseOru':
        result = interop.adapters.lab.oruToChartResults(
          interop.adapters.lab.parseOruMessage(body.rawHl7)
        );
        break;
      case 'config':
      case 'integrationStatus':
        result = service.getStatus();
        break;
      case 'listProvinces':
        result = integrations.listProvinces();
        break;
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }

    return json(200, { success: true, action, result });
  } catch (err) {
    console.error('[interop-gateway]', err);
    return json(500, { success: false, error: err.message });
  }
};

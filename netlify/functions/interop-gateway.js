/**
 * MediForge Interoperability Gateway
 * Routes: lab/imaging/rx transmit, HL7 ORU ingest, FHIR webhook, DICOMweb proxy
 *
 * POST body: { action, organizationId, ...payload }
 * Env: INTEROP_GATEWAY_API_KEY, INTEROP_FHIR_CLIENT_ID, INTEROP_FHIR_CLIENT_SECRET, SUPABASE_*
 */

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

async function logMessage(supabase, record) {
  if (!supabase || !record.organization_id) return null;
  const { data, error } = await supabase.from('interop_messages').insert(record).select('id').single();
  if (error) console.error('[interop] log error:', error.message);
  return data?.id;
}

async function handleTransmitLab(body, config) {
  const { patient, order, transport = config.adapters?.lab || 'hl7' } = body;
  if (!patient || !order) throw new Error('patient and order required');

  if (transport === 'fhir') {
    const resource = interop.adapters.lab.orderToFhirServiceRequest({ patient, order, config });
    if (config.fhir?.baseUrl) {
      const oauth = {
        ...config.fhir.oauth,
        clientId: process.env.INTEROP_FHIR_CLIENT_ID || config.fhir.oauth.clientId,
        clientSecret: process.env.INTEROP_FHIR_CLIENT_SECRET || config.fhir.oauth.clientSecret
      };
      const result = await interop.fhir.client.createServiceRequest({
        baseUrl: config.fhir.baseUrl,
        oauth,
        resource
      });
      return { transport: 'fhir', resource, result };
    }
    return { transport: 'fhir', resource, queued: true };
  }

  const hl7 = interop.adapters.lab.orderToHl7({ patient, order, config });
  const mllp = config.hl7?.mllp;
  if (mllp?.host && config.enabled) {
    const { ack } = await interop.hl7.mllp.sendMllp({
      host: mllp.host,
      port: mllp.port || 2575,
      message: hl7,
      useTls: mllp.useTls !== false
    });
    const ackParsed = interop.hl7.parser.parseAckMessage(ack);
    return { transport: 'hl7', hl7, ack, ackParsed };
  }
  return { transport: 'hl7', hl7, queued: true };
}

async function handleIngestOru(body, config) {
  const { rawHl7 } = body;
  if (!rawHl7) throw new Error('rawHl7 required');
  const parsed = interop.adapters.lab.parseOruMessage(rawHl7);
  const chart = interop.adapters.lab.oruToChartResults(parsed);
  const ack = interop.hl7.ack.generateAck({ inboundMsh: parsed.msh, ackCode: 'AA' });
  return { parsed, chart, ack };
}

async function handleTransmitImaging(body, config) {
  const { patient, order, transport = config.adapters?.imaging || 'fhir' } = body;
  if (transport === 'hl7') {
    const hl7 = interop.adapters.imaging.orderToHl7({ patient, order, config });
    return { transport: 'hl7', hl7 };
  }
  const resource = interop.adapters.imaging.orderToFhirServiceRequest({ patient, order, config });
  return { transport: 'fhir', resource };
}

async function handleTransmitRx(body, config) {
  const { patient, prescription } = body;
  const payload = interop.adapters.rx.prescriptionToInfowayPayload({ patient, prescription, config });
  if (config.fhir?.baseUrl && config.enabled) {
    const oauth = {
      ...config.fhir.oauth,
      clientId: process.env.INTEROP_FHIR_CLIENT_ID || config.fhir.oauth.clientId,
      clientSecret: process.env.INTEROP_FHIR_CLIENT_SECRET || config.fhir.oauth.clientSecret
    };
    const result = await interop.fhir.client.createMedicationRequest({
      baseUrl: config.fhir.rxEndpoint || config.fhir.baseUrl,
      oauth,
      resource: payload.resource
    });
    return { payload, result };
  }
  return { payload, queued: true };
}

async function handleDicomweb(body, config) {
  const { operation, params = {} } = body;
  const token = process.env.INTEROP_DICOM_TOKEN || config.dicomweb?.bearerToken;
  const root = config.dicomweb?.wadoRsRoot || config.dicomweb?.qidoRsRoot;
  if (!root) throw new Error('dicomweb root not configured');

  switch (operation) {
    case 'qidoStudies':
      return interop.dicom.dicomweb.qidoSearchStudies({ wadoRsRoot: root, ...params, token });
    case 'wadoInstance':
      return interop.dicom.dicomweb.wadoRetrieveInstance({ wadoRsRoot: root, ...params, token });
    case 'stow':
      return interop.dicom.dicomweb.stowStore({
        stowRsRoot: config.dicomweb.stowRsRoot || root,
        dicomBuffer: Buffer.from(params.base64, 'base64'),
        token
      });
    case 'cFind':
      return interop.dicom.dicomweb.cFindViaGateway({
        gatewayUrl: config.dicomweb.dimseGatewayUrl,
        query: params.query,
        token
      });
    case 'cMove':
      return interop.dicom.dicomweb.cMoveViaGateway({
        gatewayUrl: config.dicomweb.dimseGatewayUrl,
        studyInstanceUid: params.studyInstanceUid,
        destinationAe: params.destinationAe,
        token
      });
    default:
      throw new Error(`Unknown DICOMweb operation: ${operation}`);
  }
}

async function handlePatientMatch(body) {
  const { phn, firstName, lastName, dob, candidates } = body;
  return interop.patientMatching.matchPatient({ phn, firstName, lastName, dob, candidates });
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

  const config = interop.config.loadConfig();
  if (process.env.INTEROP_FHIR_CLIENT_ID) {
    config.fhir.oauth.clientId = process.env.INTEROP_FHIR_CLIENT_ID;
  }
  if (process.env.INTEROP_FHIR_CLIENT_SECRET) {
    config.fhir.oauth.clientSecret = process.env.INTEROP_FHIR_CLIENT_SECRET;
  }

  const supabase = getSupabase();
  const action = body.action;

  try {
    let result;
    switch (action) {
      case 'transmitLabOrder':
        result = await handleTransmitLab(body, config);
        break;
      case 'ingestOru':
        result = await handleIngestOru(body, config);
        break;
      case 'transmitImagingOrder':
        result = await handleTransmitImaging(body, config);
        break;
      case 'transmitPrescription':
        result = await handleTransmitRx(body, config);
        break;
      case 'dicomweb':
        result = await handleDicomweb(body, config);
        break;
      case 'matchPatient':
        result = await handlePatientMatch(body);
        break;
      case 'generateLabHl7':
        result = { hl7: interop.adapters.lab.orderToHl7({ patient: body.patient, order: body.order, config }) };
        break;
      case 'parseOru':
        result = interop.adapters.lab.oruToChartResults(interop.adapters.lab.parseOruMessage(body.rawHl7));
        break;
      case 'config':
        result = {
          enabled: config.enabled,
          province: config.province,
          adapters: config.adapters,
          hl7Configured: Boolean(config.hl7?.mllp?.host),
          fhirConfigured: Boolean(config.fhir?.baseUrl),
          dicomConfigured: Boolean(config.dicomweb?.wadoRsRoot)
        };
        break;
      default:
        return json(400, { error: `Unknown action: ${action}` });
    }

    if (supabase && body.organizationId && config.security?.auditAllMessages !== false) {
      await logMessage(supabase, {
        organization_id: body.organizationId,
        direction: action.startsWith('ingest') ? 'inbound' : 'outbound',
        standard: action.includes('Oru') || action.includes('Hl7') ? 'hl7' : action.includes('dicom') ? 'dicom' : 'fhir',
        message_type: action,
        correlation_id: body.order?.serial_number || body.order?.id || body.prescription?.id,
        patient_id: body.patient?.id,
        payload: result,
        status: result.queued ? 'pending' : 'sent',
        created_by: body.userId || 'gateway'
      });
    }

    return json(200, { success: true, action, result });
  } catch (err) {
    console.error('[interop-gateway]', err);
    if (supabase && body.organizationId) {
      await logMessage(supabase, {
        organization_id: body.organizationId,
        direction: 'outbound',
        standard: 'hl7',
        message_type: action || 'unknown',
        status: 'failed',
        error: err.message,
        created_by: body.userId || 'gateway'
      });
    }
    return json(500, { success: false, error: err.message });
  }
};

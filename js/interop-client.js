/**
 * Browser client for MediForge interoperability gateway
 */
(function (global) {
  const GATEWAY_URL = '/.netlify/functions/interop-gateway';

  async function callGateway(payload) {
    const headers = { 'Content-Type': 'application/json' };
    const apiKey = global.INTEROP_GATEWAY_API_KEY || null;
    if (apiKey) headers['X-Interop-Key'] = apiKey;

    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error || `Gateway error ${res.status}`);
      err.response = json;
      throw err;
    }
    return json;
  }

  async function getConfig() {
    return callGateway({ action: 'config' });
  }

  async function transmitLabOrder({ organizationId, patient, order, userId }) {
    return callGateway({
      action: 'transmitLabOrder',
      organizationId,
      patient,
      order,
      userId
    });
  }

  async function transmitImagingOrder({ organizationId, patient, order, userId }) {
    return callGateway({
      action: 'transmitImagingOrder',
      organizationId,
      patient,
      order,
      userId
    });
  }

  async function transmitPrescription({ organizationId, patient, prescription, userId }) {
    return callGateway({
      action: 'transmitPrescription',
      organizationId,
      patient,
      prescription,
      userId
    });
  }

  async function ingestOru({ organizationId, rawHl7, userId }) {
    return callGateway({ action: 'ingestOru', organizationId, rawHl7, userId });
  }

  async function matchPatient(params) {
    return callGateway({ action: 'matchPatient', ...params });
  }

  async function dicomweb(operation, params, organizationId) {
    return callGateway({ action: 'dicomweb', operation, params, organizationId });
  }

  global.MediForgeInteropClient = {
    callGateway,
    getConfig,
    transmitLabOrder,
    transmitImagingOrder,
    transmitPrescription,
    ingestOru,
    matchPatient,
    dicomweb
  };
})(typeof window !== 'undefined' ? window : global);

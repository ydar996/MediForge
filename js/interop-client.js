/**
 * Browser client for MediForge interoperability / integration gateway
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
    return callGateway({ action: 'integrationStatus' });
  }

  async function listProvinces() {
    return callGateway({ action: 'listProvinces' });
  }

  async function transmitLabOrder({ organizationId, patient, order, userId, province }) {
    return callGateway({
      action: 'transmitLabOrder',
      organizationId,
      patient,
      order,
      userId,
      province
    });
  }

  async function transmitImagingOrder({ organizationId, patient, order, userId, province }) {
    return callGateway({
      action: 'transmitImagingOrder',
      organizationId,
      patient,
      order,
      userId,
      province
    });
  }

  async function transmitPrescription({ organizationId, patient, prescription, userId, province }) {
    return callGateway({
      action: 'transmitPrescription',
      organizationId,
      patient,
      prescription,
      userId,
      province
    });
  }

  async function submitClaim({ organizationId, patient, provider, invoice, services, payerCode, userId, province }) {
    return callGateway({
      action: 'submitClaim',
      organizationId,
      patient,
      provider,
      invoice,
      services,
      payerCode,
      userId,
      province
    });
  }

  async function processRemittance({ organizationId, raw, invoices, userId, province }) {
    return callGateway({
      action: 'processRemittance',
      organizationId,
      raw,
      invoices,
      userId,
      province
    });
  }

  async function ingestOru({ organizationId, rawHl7, userId, province }) {
    return callGateway({ action: 'ingestOru', organizationId, rawHl7, userId, province });
  }

  async function matchPatient(params) {
    return callGateway({ action: 'matchPatient', ...params });
  }

  async function dicomweb(operation, params, organizationId, province) {
    return callGateway({ action: 'dicomweb', operation, params, organizationId, province });
  }

  global.MediForgeInteropClient = {
    callGateway,
    getConfig,
    listProvinces,
    transmitLabOrder,
    transmitImagingOrder,
    transmitPrescription,
    submitClaim,
    processRemittance,
    ingestOru,
    matchPatient,
    dicomweb
  };
})(typeof window !== 'undefined' ? window : global);

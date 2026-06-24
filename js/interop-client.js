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

  async function transmitLabOrder({ organizationId, patient, order, userId, province, olisConsentGranted }) {
    return callGateway({
      action: 'transmitLabOrder',
      organizationId,
      patient,
      order,
      userId,
      province,
      olisConsentGranted: olisConsentGranted !== false
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

  async function transmitPrescription({ organizationId, patient, prescription, userId, province, erxConsentGranted, pharmacy }) {
    return callGateway({
      action: 'transmitPrescription',
      organizationId,
      patient,
      prescription,
      userId,
      province,
      erxConsentGranted: erxConsentGranted !== false,
      pharmacy
    });
  }

  async function generateRxFhir({ organizationId, patient, prescription, userId, province, pharmacy }) {
    return callGateway({ action: 'generateRxFhir', organizationId, patient, prescription, userId, province, pharmacy });
  }

  async function simulateRxTransmit({ organizationId, patient, prescription, userId, province, erxConsentGranted, pharmacy }) {
    return callGateway({
      action: 'simulateRxTransmit',
      organizationId,
      patient,
      prescription,
      userId,
      province,
      erxConsentGranted: erxConsentGranted !== false,
      pharmacy
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

  async function ingestOru({ organizationId, rawHl7, userId, province, olisConsentGranted }) {
    return callGateway({ action: 'ingestOru', organizationId, rawHl7, userId, province, olisConsentGranted });
  }

  async function generateLabHl7({ organizationId, patient, order, userId, province }) {
    return callGateway({ action: 'generateLabHl7', organizationId, patient, order, userId, province });
  }

  async function generateLabFhir({ organizationId, patient, order, userId, province }) {
    return callGateway({ action: 'generateLabFhir', organizationId, patient, order, userId, province });
  }

  async function generateImagingHl7({ organizationId, patient, order, userId, province }) {
    return callGateway({ action: 'generateImagingHl7', organizationId, patient, order, userId, province });
  }

  async function generateImagingFhir({ organizationId, patient, order, userId, province }) {
    return callGateway({ action: 'generateImagingFhir', organizationId, patient, order, userId, province });
  }

  async function ingestImagingReport({ organizationId, rawHl7, fhirBundle, userId, province }) {
    return callGateway({
      action: 'ingestImagingReport',
      organizationId,
      rawHl7,
      fhirBundle,
      userId,
      province
    });
  }

  async function connectingOntarioLaunch({ organizationId, patient, purpose, province }) {
    return callGateway({ action: 'connectingOntarioLaunch', organizationId, patient, purpose, province });
  }

  async function smartLaunch({ organizationId, patient, scope, launch, province }) {
    return callGateway({ action: 'smartLaunch', organizationId, patient, scope, launch, province });
  }

  async function fhirSearchPatients({ organizationId, phn, province, userId, olisConsentGranted }) {
    return callGateway({ action: 'fhirSearchPatients', organizationId, phn, province, userId, olisConsentGranted });
  }

  async function smartLaunch({ organizationId, patient, scope, launch, province }) {
    return callGateway({ action: 'smartLaunch', organizationId, patient, scope, launch, province });
  }

  async function ingestHrmReport({ organizationId, rawHl7, fhirBundle, userId, province, hrmConsentGranted }) {
    return callGateway({
      action: 'ingestHrmReport',
      organizationId,
      rawHl7,
      fhirBundle,
      userId,
      province,
      hrmConsentGranted
    });
  }

  async function queryDhdr({ organizationId, patient, fhirBundle, userId, province, dhdrConsentGranted }) {
    return callGateway({
      action: 'queryDhdr',
      organizationId,
      patient,
      fhirBundle,
      userId,
      province,
      dhdrConsentGranted
    });
  }

  async function matchPatient(params) {
    return callGateway({ action: 'matchPatient', ...params });
  }

  async function dicomweb(operation, params, organizationId, province) {
    return callGateway({ action: 'dicomweb', operation, params, organizationId, province });
  }

  /** Generic gateway call used by claims queue, remittance, MCEDT settings, etc. */
  async function call(action, payload = {}) {
    return callGateway({ action, ...payload });
  }

  global.MediForgeInteropClient = {
    callGateway,
    call,
    getConfig,
    listProvinces,
    transmitLabOrder,
    transmitImagingOrder,
    transmitPrescription,
    generateRxFhir,
    simulateRxTransmit,
    submitClaim,
    processRemittance,
    ingestOru,
    generateLabHl7,
    generateLabFhir,
    generateImagingHl7,
    generateImagingFhir,
    ingestImagingReport,
    connectingOntarioLaunch,
    smartLaunch,
    ingestHrmReport,
    queryDhdr,
    fhirSearchPatients,
    matchPatient,
    dicomweb
  };
})(typeof window !== 'undefined' ? window : global);

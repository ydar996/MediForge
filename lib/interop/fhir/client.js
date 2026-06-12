'use strict';

/**
 * FHIR R4 HTTP client with OAuth2 client credentials (Infoway/OLIS compatible)
 */
async function getAccessToken(oauthConfig) {
  if (!oauthConfig || !oauthConfig.tokenUrl) return null;
  if (oauthConfig.accessToken) return oauthConfig.accessToken;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret,
    scope: oauthConfig.scope || 'system/*.read system/*.write'
  });

  const res = await fetch(oauthConfig.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  return json.access_token;
}

async function fhirRequest({ baseUrl, path, method = 'GET', body, oauth, headers = {} }) {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const token = await getAccessToken(oauth);
  const reqHeaders = {
    Accept: 'application/fhir+json',
    'Content-Type': 'application/fhir+json',
    ...headers
  };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`FHIR ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.response = json;
    throw err;
  }

  return json;
}

async function searchPatients({ baseUrl, oauth, phn, province = 'ON' }) {
  const system = encodeURIComponent(
    `http://ehealthontario.ca/fhir/NamingSystem/id-${province.toLowerCase()}-patient-hcn`
  );
  return fhirRequest({
    baseUrl,
    oauth,
    path: `Patient?identifier=${system}|${encodeURIComponent(phn)}`
  });
}

async function createServiceRequest({ baseUrl, oauth, resource }) {
  return fhirRequest({ baseUrl, oauth, method: 'POST', path: 'ServiceRequest', body: resource });
}

async function createDiagnosticReport({ baseUrl, oauth, bundle }) {
  return fhirRequest({ baseUrl, oauth, method: 'POST', path: '', body: bundle });
}

async function createMedicationRequest({ baseUrl, oauth, resource }) {
  return fhirRequest({ baseUrl, oauth, method: 'POST', path: 'MedicationRequest', body: resource });
}

async function getImagingStudy({ baseUrl, oauth, studyId }) {
  return fhirRequest({ baseUrl, oauth, path: `ImagingStudy/${studyId}` });
}

module.exports = {
  getAccessToken,
  fhirRequest,
  searchPatients,
  createServiceRequest,
  createDiagnosticReport,
  createMedicationRequest,
  getImagingStudy
};

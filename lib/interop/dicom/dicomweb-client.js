'use strict';

/**
 * DICOMweb client (QIDO-RS, WADO-RS, STOW-RS)
 * Compatible with PACS supporting DICOMweb; C-FIND/C-MOVE routed via configured gateway URL.
 */

async function dicomwebFetch(baseUrl, path, { method = 'GET', headers = {}, body } = {}) {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, { method, headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DICOMweb ${method} ${path}: ${res.status} ${text}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/dicom+json') || contentType.includes('application/json')) {
    return res.json();
  }
  return res.arrayBuffer();
}

function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** QIDO-RS: search studies */
async function qidoSearchStudies({ wadoRsRoot, patientId, accessionNumber, token }) {
  const params = new URLSearchParams();
  if (patientId) params.set('PatientID', patientId);
  if (accessionNumber) params.set('AccessionNumber', accessionNumber);
  return dicomwebFetch(wadoRsRoot, `studies?${params}`, { headers: authHeaders(token) });
}

/** QIDO-RS: search series for study */
async function qidoSearchSeries({ wadoRsRoot, studyInstanceUid, token }) {
  return dicomwebFetch(wadoRsRoot, `studies/${studyInstanceUid}/series`, { headers: authHeaders(token) });
}

/** WADO-RS: retrieve instance */
async function wadoRetrieveInstance({ wadoRsRoot, studyUid, seriesUid, instanceUid, token }) {
  return dicomwebFetch(
    wadoRsRoot,
    `studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}`,
    { headers: { ...authHeaders(token), Accept: 'application/dicom' } }
  );
}

/** WADO-RS: rendered JPEG preview */
async function wadoRetrieveRendered({ wadoRsRoot, studyUid, seriesUid, instanceUid, token }) {
  return dicomwebFetch(
    wadoRsRoot,
    `studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}/rendered`,
    { headers: { ...authHeaders(token), Accept: 'image/jpeg' } }
  );
}

/** STOW-RS: store DICOM instance */
async function stowStore({ stowRsRoot, dicomBuffer, token }) {
  const boundary = `mediforge-${Date.now()}`;
  const body = `--${boundary}\r\nContent-Type: application/dicom\r\n\r\n`;
  const end = `\r\n--${boundary}--\r\n`;
  const payload = Buffer.concat([
    Buffer.from(body),
    Buffer.isBuffer(dicomBuffer) ? dicomBuffer : Buffer.from(dicomBuffer),
    Buffer.from(end)
  ]);

  return dicomwebFetch(stowRsRoot, '', {
    method: 'POST',
    headers: {
      ...authHeaders(token),
      'Content-Type': `multipart/related; type="application/dicom"; boundary=${boundary}`
    },
    body: payload
  });
}

/**
 * C-FIND/C-MOVE proxy — delegates to external DICOM gateway (Orthanc, dcm4chee, etc.)
 * Full DIMSE is not implemented in-browser; gateway exposes REST shim.
 */
async function cFindViaGateway({ gatewayUrl, query, token }) {
  return dicomwebFetch(gatewayUrl, 'dimse/c-find', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });
}

async function cMoveViaGateway({ gatewayUrl, studyInstanceUid, destinationAe, token }) {
  return dicomwebFetch(gatewayUrl, 'dimse/c-move', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ studyInstanceUid, destinationAe })
  });
}

module.exports = {
  qidoSearchStudies,
  qidoSearchSeries,
  wadoRetrieveInstance,
  wadoRetrieveRendered,
  stowStore,
  cFindViaGateway,
  cMoveViaGateway
};

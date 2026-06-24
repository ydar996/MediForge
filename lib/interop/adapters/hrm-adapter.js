'use strict';

const { parseMessage } = require('../hl7/parser');

function parseHrmHl7(rawHl7) {
  const parsed = parseMessage(rawHl7);
  const msh = parsed.msh || {};
  const pid = parsed.pid || {};
  const obx = parsed.obx || [];
  const reportText = obx.map((o) => o.value || o.observationValue).filter(Boolean).join('\n');
  return {
    messageType: msh.messageType || 'MDM^T02',
    patientMrn: pid.patientId || pid.id,
    patientName: pid.patientName,
    reportTitle: obx[0]?.identifier || 'Hospital Report',
    reportText: reportText || rawHl7.slice(0, 500),
    placerId: parsed.orc?.placerOrderNumber || parsed.obr?.placerOrderNumber,
    receivedAt: new Date().toISOString()
  };
}

function hrmPayloadToChartDocument(payload) {
  return {
    title: payload.reportTitle || 'Hospital Report',
    body: payload.reportText,
    source: 'hrm',
    messageType: payload.messageType,
    receivedAt: payload.receivedAt,
    placerId: payload.placerId
  };
}

function fhirDocumentReferenceToChart(bundle) {
  const entry = bundle?.entry?.[0]?.resource || bundle;
  if (entry?.resourceType !== 'DocumentReference') {
    return { parsed: false, error: 'Expected DocumentReference' };
  }
  const content = entry.content?.[0]?.attachment;
  return {
    parsed: true,
    document: {
      title: entry.description || content?.title || 'Hospital Report',
      body: content?.data ? Buffer.from(content.data, 'base64').toString('utf8') : content?.url || '',
      source: 'hrm_fhir',
      receivedAt: entry.date || new Date().toISOString()
    }
  };
}

module.exports = {
  parseHrmHl7,
  hrmPayloadToChartDocument,
  fhirDocumentReferenceToChart
};

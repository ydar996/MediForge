'use strict';

const { generateOrmO01 } = require('../hl7/generator');
const { enrichImagingItems } = require('../terminology/snomed');
const { buildServiceRequest, buildImagingStudy, buildDiagnosticReport } = require('../fhir/resources');
const { loadConfig } = require('../config');

function orderToHl7({ patient, order, config }) {
  const cfg = config || loadConfig();
  const items = enrichImagingItems(order.selected_items || order.selectedItems, cfg);
  return generateOrmO01({
    patient: { ...patient, phn: patient.phn || patient.healthCardNumber },
    order: {
      placerOrderNumber: order.serial_number || order.id,
      messageType: 'ORM^O01',
      items,
      orderDateTime: order.timestamp
    },
    config: { ...cfg.hl7, receivingApplication: 'RIS', receivingFacility: cfg.fhir?.imagingFacility || 'PACS' }
  });
}

function orderToFhirServiceRequest({ patient, order, config }) {
  const cfg = config || loadConfig();
  const items = enrichImagingItems(order.selected_items || order.selectedItems, cfg);
  return buildServiceRequest({
    patientId: patient.id,
    placerOrderNumber: order.serial_number || order.id,
    category: 'imaging',
    items,
    authoredOn: order.timestamp
  });
}

function buildImagingStudyResource({ patient, order, studyInstanceUid, config }) {
  const items = enrichImagingItems(order.selected_items || order.selectedItems, config);
  const modality = items[0]?.dicomModality || 'CT';
  return buildImagingStudy({
    patientId: patient.id,
    accessionNumber: order.serial_number || order.id,
    modality,
    seriesInstanceUid: studyInstanceUid
  });
}

function attachDicomStudyToResults(existingResults, { studyInstanceUid, wadoUrl, seriesUid }) {
  const base = existingResults && typeof existingResults === 'object' ? { ...existingResults } : {};
  base._imaging = base._imaging || {};
  base._imaging.studies = base._imaging.studies || [];
  base._imaging.studies.push({
    studyInstanceUid,
    seriesUid,
    wadoUrl,
    linkedAt: new Date().toISOString()
  });
  return base;
}

function reportToDiagnosticReport({ patient, order, reportText, observations }) {
  return buildDiagnosticReport({
    patientId: patient.id,
    placerOrderNumber: order.serial_number || order.id,
    observations,
    conclusion: reportText,
    effectiveDateTime: new Date().toISOString()
  });
}

module.exports = {
  orderToHl7,
  orderToFhirServiceRequest,
  buildImagingStudyResource,
  attachDicomStudyToResults,
  reportToDiagnosticReport
};

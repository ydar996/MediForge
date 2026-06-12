'use strict';

const { generateOrmO01, generateOmlO21 } = require('../hl7/generator');
const { generateOruR01 } = require('../hl7/generator');
const { parseOruMessage } = require('../hl7/parser');
const { enrichLabItems } = require('../terminology/loinc-pclocd');
const { buildServiceRequest, buildDiagnosticReport, buildObservation, buildBundle } = require('../fhir/resources');
const { loadConfig } = require('../config');

function orderToHl7({ patient, order, config }) {
  const cfg = config || loadConfig();
  const items = enrichLabItems(order.selected_items || order.selectedItems, cfg);
  const payload = {
    patient: {
      ...patient,
      phn: patient.phn || patient.healthCardNumber
    },
    order: {
      placerOrderNumber: order.serial_number || order.serialNumber || order.id,
      orderDateTime: order.timestamp || order.created_at,
      items
    },
    config: cfg.hl7
  };

  const useOml = cfg.adapters?.labMessageType === 'OML^O21';
  return useOml ? generateOmlO21(payload) : generateOrmO01(payload);
}

function orderToFhirServiceRequest({ patient, order, config }) {
  const cfg = config || loadConfig();
  const items = enrichLabItems(order.selected_items || order.selectedItems, cfg);
  return buildServiceRequest({
    patientId: patient.id,
    placerOrderNumber: order.serial_number || order.id,
    category: 'laboratory',
    items,
    authoredOn: order.timestamp
  });
}

function oruToChartResults(parsedOru) {
  const placerOrder = parsedOru.orc?.placerOrderNumber || parsedOru.obr[0]?.placerOrderNumber;
  const results = {};

  parsedOru.obx.forEach((obx) => {
    const parts = (obx.observationId || '').split('^');
    const testKey = parts[1] || parts[0] || `test_${obx.setId}`;
    results[testKey] = {
      value: obx.value,
      units: obx.units,
      referenceRange: obx.referenceRange,
      abnormalFlags: obx.abnormalFlags,
      status: obx.resultStatus === 'F' ? 'completed' : 'preliminary',
      loinc: parts[0],
      entered_at: obx.observationDateTime || new Date().toISOString(),
      source: 'hl7_oru'
    };
  });

  return {
    placerOrderNumber: placerOrder,
    results,
    critical: parsedOru.obx.some((o) => /HH|LL|AA|^H$|^L$/i.test(o.abnormalFlags))
  };
}

function fhirDiagnosticReportToChartResults(bundle) {
  const entries = bundle.entry || [];
  const observations = entries.filter((e) => e.resource?.resourceType === 'Observation').map((e) => e.resource);
  const report = entries.find((e) => e.resource?.resourceType === 'DiagnosticReport')?.resource;
  const results = {};

  observations.forEach((obs) => {
    const code = obs.code?.coding?.[0];
    const key = code?.display || code?.code || obs.id;
    results[key] = {
      value: obs.valueQuantity?.value ?? obs.valueString,
      units: obs.valueQuantity?.unit,
      referenceRange: obs.referenceRange?.[0]?.text,
      interpretation: obs.interpretation?.[0]?.coding?.[0]?.code,
      status: 'completed',
      loinc: code?.code,
      entered_at: obs.effectiveDateTime,
      source: 'fhir_diagnostic_report'
    };
  });

  return {
    placerOrderNumber: report?.identifier?.[0]?.value,
    results,
    conclusion: report?.conclusion,
    critical: observations.some((o) => /H|L|A/.test(o.interpretation?.[0]?.coding?.[0]?.code || ''))
  };
}

function buildOruFromResults({ patient, order, results, config }) {
  const cfg = config || loadConfig();
  const observations = Object.entries(results || {}).map(([name, r]) => ({
    name,
    loinc: r.loinc || '',
    universalServiceId: r.loinc ? `${r.loinc}^${name}^LN` : name,
    value: r.value,
    units: r.units,
    referenceRange: r.referenceRange,
    abnormalFlags: r.abnormalFlags,
    valueType: typeof r.value === 'number' ? 'NM' : 'ST',
    resultStatus: 'F'
  }));

  return generateOruR01({
    patient,
    result: {
      placerOrderNumber: order.serial_number || order.id,
      fillerOrderNumber: order.external_filler_id || '',
      observations
    },
    config: cfg.hl7
  });
}

module.exports = {
  orderToHl7,
  orderToFhirServiceRequest,
  oruToChartResults,
  fhirDiagnosticReportToChartResults,
  buildOruFromResults,
  parseOruMessage
};

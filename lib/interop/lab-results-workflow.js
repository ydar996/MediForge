'use strict';

/**
 * Lab result ingest workflow helpers (OLIS / HL7 ORU).
 */
function findOrderByPlacerNumber(orders, placerOrderNumber) {
  if (!placerOrderNumber) return null;
  const key = String(placerOrderNumber).trim();
  return (orders || []).find(
    (o) =>
      String(o.serial_number || o.serialNumber || '') === key ||
      String(o.id) === key ||
      String(o.invoice_number || '') === key
  );
}

function mergeChartIntoOrderResults(existingResults, chartResults) {
  const merged = {
    ...(existingResults || {}),
    ...(chartResults?.results || {}),
    _interop: {
      source: chartResults?.standard || 'hl7_oru',
      placerOrderNumber: chartResults?.placerOrderNumber || null,
      critical: chartResults?.critical === true,
      at: new Date().toISOString()
    }
  };
  return merged;
}

function summarizeInboundQueue(orders) {
  return (orders || [])
    .filter(
      (o) =>
        o.portal_results_status === 'awaiting_review' ||
        (o.results && o.results._interop)
    )
    .map((o) => ({
      id: o.id,
      serial_number: o.serial_number || o.serialNumber,
      patient_id: o.patient_id || o.patientId,
      portal_results_status: o.portal_results_status,
      critical: o.results?._interop?.critical === true,
      interopAt: o.results?._interop?.at
    }));
}

module.exports = {
  findOrderByPlacerNumber,
  mergeChartIntoOrderResults,
  summarizeInboundQueue
};

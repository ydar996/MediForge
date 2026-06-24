'use strict';

/**
 * Imaging / DI result ingest workflow helpers (DIR-ready desk).
 */
function findImagingOrderBySerial(orders, serial) {
  if (!serial) return null;
  const key = String(serial).trim();
  return (orders || []).find(
    (o) =>
      o.type === 'imaging' &&
      (String(o.serial_number || '') === key ||
        String(o.id) === key ||
        String(o.invoice_number || '') === key)
  );
}

function mergeImagingReportIntoOrder(existingResults, reportPayload) {
  const merged = {
    ...(existingResults || {}),
    ...(reportPayload?.results || {}),
    _interop: {
      source: reportPayload?.standard || 'fhir_diagnostic_report',
      placerOrderNumber: reportPayload?.placerOrderNumber || null,
      reportText: reportPayload?.reportText || null,
      at: new Date().toISOString()
    }
  };
  if (reportPayload?.wadoUrl) {
    merged._imaging = merged._imaging || {};
    merged._imaging.studies = merged._imaging.studies || [];
    merged._imaging.studies.push({
      wadoUrl: reportPayload.wadoUrl,
      studyInstanceUid: reportPayload.studyInstanceUid,
      linkedAt: new Date().toISOString()
    });
  }
  return merged;
}

function summarizeImagingReviewQueue(orders) {
  return (orders || [])
    .filter(
      (o) =>
        o.type === 'imaging' &&
        (o.portal_results_status === 'awaiting_review' ||
          o.results?._interop ||
          o.results?._imaging)
    )
    .map((o) => ({
      id: o.id,
      serial_number: o.serial_number,
      patient_id: o.patient_id,
      portal_results_status: o.portal_results_status,
      status: o.status,
      hasDicomLink: Boolean(o.results?._imaging?.studies?.length),
      interopAt: o.results?._interop?.at
    }));
}

module.exports = {
  findImagingOrderBySerial,
  mergeImagingReportIntoOrder,
  summarizeImagingReviewQueue
};

'use strict';

function findReportByPlacer(reports, placerId) {
  if (!placerId) return null;
  const key = String(placerId).trim();
  return (reports || []).find((r) => String(r.placer_id || r.placerId || '') === key);
}

function summarizeHrmInbox(reports) {
  return (reports || [])
    .filter((r) => r.status === 'awaiting_review' || !r.filed_at)
    .map((r) => ({
      id: r.id,
      patient_id: r.patient_id,
      report_title: r.report_title,
      status: r.status,
      created_at: r.created_at
    }));
}

function buildFilePatch(document) {
  return {
    status: 'filed',
    filed_at: new Date().toISOString(),
    report_body: document.body,
    report_title: document.title
  };
}

const hrmChartFile = require('./hrm-chart-file');

module.exports = {
  findReportByPlacer,
  summarizeHrmInbox,
  buildFilePatch,
  buildUnstructuredRecordFromReport: hrmChartFile.buildUnstructuredRecordFromReport,
  mergeUnstructuredRecords: hrmChartFile.mergeUnstructuredRecords
};

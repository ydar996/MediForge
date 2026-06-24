'use strict';

function parseExistingUnstructured(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return [];
}

function buildUnstructuredRecordFromReport(report, document) {
  const title = document?.title || report.report_title || 'Hospital Report';
  const body = document?.body || report.report_body || '';
  const text = body ? `${title}\n\n${body}` : title;
  return {
    id: `hrm_${report.id}`,
    kind: 'text',
    text,
    title,
    source: document?.source || 'hrm',
    hrmReportId: report.id,
    placerId: report.placer_id || document?.placerId || null,
    messageType: document?.messageType || null,
    createdAt: new Date().toISOString(),
    tags: ['hospital-report', 'hrm']
  };
}

function mergeUnstructuredRecords(existing, additions) {
  const map = new Map();
  parseExistingUnstructured(existing).forEach((record) => {
    if (record?.id) map.set(record.id, record);
  });
  (additions || []).forEach((record) => {
    if (record?.id) map.set(record.id, record);
  });
  return Array.from(map.values());
}

module.exports = {
  parseExistingUnstructured,
  buildUnstructuredRecordFromReport,
  mergeUnstructuredRecords
};

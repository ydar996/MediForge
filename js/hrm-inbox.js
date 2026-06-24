'use strict';

(function (global) {
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

  function buildChartRecord(report) {
    const title = report.report_title || 'Hospital Report';
    const body = report.report_body || '';
    const text = body ? `${title}\n\n${body}` : title;
    return {
      id: `hrm_${report.id}`,
      kind: 'text',
      text,
      title,
      source: 'hrm',
      hrmReportId: report.id,
      placerId: report.placer_id || null,
      createdAt: new Date().toISOString(),
      tags: ['hospital-report', 'hrm']
    };
  }

  function mergeRecords(existing, additions) {
    const map = new Map();
    parseExistingUnstructured(existing).forEach((record) => {
      if (record?.id) map.set(record.id, record);
    });
    (additions || []).forEach((record) => {
      if (record?.id) map.set(record.id, record);
    });
    return Array.from(map.values());
  }

  async function loadAwaitingReports() {
    if (!global.supabase) return [];
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return [];
    const { data, error } = await global.supabase
      .from('hrm_inbound_reports')
      .select('id, patient_id, placer_id, report_title, status, created_at')
      .eq('organization_id', orgId)
      .eq('status', 'awaiting_review')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      console.warn('HRM inbox load:', error.message);
      return [];
    }
    return data || [];
  }

  async function insertReport(row) {
    if (!global.supabase) return { error: 'Database not configured' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const { data, error } = await global.supabase
      .from('hrm_inbound_reports')
      .insert({ ...row, organization_id: orgId })
      .select()
      .single();
    return error ? { error: error.message } : { data };
  }

  async function fileReportLocal(id, patientId) {
    if (!global.supabase) return { error: 'Database not configured' };
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    if (!orgId) return { error: 'Organization not found' };

    const { data: report, error: reportError } = await global.supabase
      .from('hrm_inbound_reports')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();
    if (reportError || !report) return { error: 'Report not found' };

    const pid = String(patientId).trim();
    let { data: patient } = await global.supabase
      .from('patients')
      .select('id, patient_id, unstructured_records')
      .eq('organization_id', orgId)
      .eq('patient_id', pid)
      .maybeSingle();
    if (!patient) {
      ({ data: patient } = await global.supabase
        .from('patients')
        .select('id, patient_id, unstructured_records')
        .eq('organization_id', orgId)
        .eq('id', pid)
        .maybeSingle());
    }
    if (!patient) return { error: 'Patient not found' };

    const record = buildChartRecord(report);
    const merged = mergeRecords(patient.unstructured_records, [record]);
    const { error: patientError } = await global.supabase
      .from('patients')
      .update({ unstructured_records: merged, updated_at: new Date().toISOString() })
      .eq('id', patient.id)
      .eq('organization_id', orgId);
    if (patientError) return { error: patientError.message };

    const { error: updateError } = await global.supabase
      .from('hrm_inbound_reports')
      .update({
        status: 'filed',
        patient_id: patient.patient_id || pid,
        filed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    if (updateError) return { error: updateError.message };

    return { ok: true, recordId: record.id, patientId: patient.patient_id || patient.id };
  }

  async function fileReport(id, patientId) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgId = user.organizationId || user.organization_id;
    const userId = user.id || user.userId;

    if (global.MediForgeInteropClient?.fileHrmReportToChart) {
      try {
        const res = await global.MediForgeInteropClient.fileHrmReportToChart({
          organizationId: orgId,
          reportId: id,
          patientId,
          userId
        });
        if (res?.result?.ok || res?.ok) return res.result || res;
      } catch (err) {
        console.warn('Gateway file HRM fallback to local:', err.message);
      }
    }

    return fileReportLocal(id, patientId);
  }

  function renderQueue(container, rows) {
    if (!rows.length) {
      container.innerHTML =
        '<p>No hospital reports awaiting review. Paste an HL7 MDM/ORU or FHIR DocumentReference below.</p>';
      return;
    }
    const html = [
      '<table class="hrm-table"><thead><tr><th>Report</th><th>Patient</th><th>Status</th><th>Actions</th></tr></thead><tbody>'
    ];
    rows.forEach((r) => {
      html.push(
        `<tr><td>${r.report_title || r.id}</td>` +
          `<td>${r.patient_id ? `<a href="patient-details?patientId=${encodeURIComponent(r.patient_id)}">${r.patient_id}</a>` : 'Unmatched'}</td>` +
          `<td>${r.status}</td>` +
          `<td><button type="button" class="btn-sm" data-file="${r.id}" data-patient="${r.patient_id || ''}">File to chart</button></td></tr>`
      );
    });
    html.push('</tbody></table>');
    container.innerHTML = html.join('');
  }

  global.MediForgeHrmInbox = { loadAwaitingReports, insertReport, fileReport, renderQueue };
})(typeof window !== 'undefined' ? window : globalThis);

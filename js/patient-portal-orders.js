/**
 * Patient portal — lab/imaging order copy and reviewed results viewer.
 */
(function (global) {
  'use strict';

  const PP = global.MediForgePatientPortal || {};
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const RESULT_METADATA = new Set([
    'status', 'entered_at', 'entered_by', 'auditTrail', 'AuditTrail',
    'completed_at', 'completed_by', 'started_at', 'started_by',
    'reviewed_at', 'reviewed_by', 'doctor_note', 'doctor_note_by', 'doctor_note_updated_at',
    'file_name', 'file_data', 'file_type', 'file_size', '_attachments', '_interop'
  ]);

  function parseItems(order) {
    return PP.parseJsonField ? PP.parseJsonField(order.selected_items, []) : (order.selected_items || []);
  }

  function parseResults(order) {
    if (!order || !order.results) return {};
    if (typeof order.results === 'string') {
      try { return JSON.parse(order.results); } catch (_) { return {}; }
    }
    return typeof order.results === 'object' ? order.results : {};
  }

  function formatSerial(order) {
    const raw = order.serial_number || order.id || '';
    if (typeof global.formatLabOrderSerial === 'function') {
      return global.formatLabOrderSerial(raw, order.id, order);
    }
    return raw;
  }

  function formatDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    return Number.isNaN(d.getTime())
      ? String(val).slice(0, 10)
      : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function resultFieldValue(val) {
    if (val == null) return '';
    if (typeof val === 'object' && val.value != null) return String(val.value);
    if (typeof val === 'object' && val.result != null) return String(val.result);
    if (typeof val === 'string' || typeof val === 'number') return String(val);
    return '';
  }

  function buildOrderCopyHtml(order, patient) {
    const type = order.type === 'imaging' ? 'Imaging Order' : 'Laboratory Order';
    const items = parseItems(order);
    const patientName = patient
      ? [patient.firstName || patient.first_name, patient.lastName || patient.last_name].filter(Boolean).join(' ')
      : 'Patient';
    const rows = items.map((item) => {
      const name = item.name || item.test || item.study || item.item || 'Test';
      const code = item.cpt || item.code || item.ohip || '';
      return `<tr><td>${esc(name)}</td><td>${esc(code)}</td></tr>`;
    }).join('');

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(type)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#222;}
h1{color:#008751;margin:0 0 8px;font-size:22px;}
.meta{color:#555;margin-bottom:20px;line-height:1.5;}
table{width:100%;border-collapse:collapse;margin-top:16px;}
th,td{border:1px solid #ddd;padding:10px;text-align:left;}
th{background:#008751;color:#fff;}
.note{margin-top:24px;padding:14px;background:#f8f9fa;border-left:4px solid #008751;font-size:14px;}
@media print{.no-print{display:none;}}
</style></head><body>
<h1>${esc(type)}</h1>
<div class="meta">
<p><strong>Patient:</strong> ${esc(patientName)}</p>
<p><strong>Order #:</strong> ${esc(formatSerial(order))}</p>
<p><strong>Order date:</strong> ${esc(formatDate(order.visit_date || order.created_at || order.timestamp))}</p>
</div>
<h2>Tests / studies ordered</h2>
<table><thead><tr><th>Test / study</th><th>Code</th></tr></thead>
<tbody>${rows || '<tr><td colspan="2">No items listed</td></tr>'}</tbody></table>
<div class="note">This is a copy of your order requisition. Result values are released in the patient portal only after your provider has reviewed them.</div>
<p class="no-print" style="margin-top:24px;"><button onclick="window.print()">Print / Save as PDF</button></p>
</body></html>`;
  }

  function buildReviewedResultsHtml(order, patient) {
    const type = order.type === 'imaging' ? 'Imaging Results' : 'Lab Results';
    const results = parseResults(order);
    const testNames = Object.keys(results).filter((k) => !k.startsWith('_'));
    const patientName = patient
      ? [patient.firstName || patient.first_name, patient.lastName || patient.last_name].filter(Boolean).join(' ')
      : 'Patient';

    let body = '';
    testNames.forEach((testName) => {
      const test = results[testName] || {};
      const fields = Object.entries(test).filter(([k, v]) => {
        if (RESULT_METADATA.has(k)) return false;
        const display = resultFieldValue(v);
        return display !== '' && display !== 'Not Tested';
      });

      body += `<div class="test-block"><h3>${esc(testName)}</h3>`;
      if (fields.length) {
        body += '<table><thead><tr><th>Component</th><th>Result</th></tr></thead><tbody>';
        fields.forEach(([key, val]) => {
          const label = (val && typeof val === 'object' && val.label) ? val.label : key.replace(/_/g, ' ');
          body += `<tr><td>${esc(label)}</td><td><strong>${esc(resultFieldValue(val))}</strong></td></tr>`;
        });
        body += '</tbody></table>';
      }
      if (test.notes) {
        body += `<div class="note"><strong>Notes</strong><p>${esc(test.notes)}</p></div>`;
      }
      if (test.doctor_note) {
        body += `<div class="provider-note"><strong>Provider comment</strong><p>${esc(test.doctor_note)}</p></div>`;
      }
      if (test.file_name && test.file_data) {
        const url = `data:${test.file_type || 'application/pdf'};base64,${test.file_data}`;
        body += `<p><a href="${url}" target="_blank" rel="noopener">Open attached file: ${esc(test.file_name)}</a></p>`;
      }
      body += '</div>';
    });

    if (!body) {
      body = '<p>No structured results are on file for this order. Contact your clinic if you expected attachments.</p>';
    }

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(type)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px;max-width:900px;margin:0 auto;color:#222;}
h1{color:#008751;margin:0 0 8px;}
.meta{color:#555;margin-bottom:20px;}
.test-block{margin-bottom:28px;padding:16px;border:1px solid #e0e0e0;border-radius:8px;}
.test-block h3{margin:0 0 12px;color:#006b42;}
table{width:100%;border-collapse:collapse;}
th,td{border:1px solid #ddd;padding:8px;text-align:left;}
th{background:#008751;color:#fff;}
.note,.provider-note{margin-top:12px;padding:12px;background:#f8f9fa;border-radius:6px;}
.provider-note{border-left:4px solid #008751;}
</style></head><body>
<h1>${esc(type)}</h1>
<div class="meta">
<p><strong>Patient:</strong> ${esc(patientName)}</p>
<p><strong>Order #:</strong> ${esc(formatSerial(order))}</p>
<p><strong>Reviewed results</strong> — released by your care team</p>
</div>
${body}
</body></html>`;
  }

  function openHtmlWindow(html, title) {
    const w = global.open('', '_blank');
    if (!w) {
      alert('Please allow pop-ups to view this document.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = title || 'MediForge Patient Portal';
  }

  async function resolvePatientForOrder(order) {
    if (typeof global.getPatientDemographics === 'function') {
      try {
        return await global.getPatientDemographics();
      } catch (_) { /* fall through */ }
    }
    return null;
  }

  async function openOrderCopy(order) {
    if (!order) return;
    let full = order;
    if (order.id && global.supabaseClient) {
      const fetched = await fetchPortalOrderById(order.id);
      if (fetched) full = fetched;
    }
    let html = full.html_content;
    if (html && typeof html === 'string' && html.trim().length > 50) {
      openHtmlWindow(html, 'Order copy');
      return;
    }
    const patient = await resolvePatientForOrder(full);
    openHtmlWindow(buildOrderCopyHtml(full, patient), 'Order copy');
  }

  async function openReviewedResults(order) {
    if (!order) return;
    let fullOrder = order;
    if (order.id && global.supabaseClient) {
      const fetched = await fetchPortalOrderById(order.id);
      if (fetched) fullOrder = fetched;
    }
    const portal = PP.getOrderPortalStatus ? PP.getOrderPortalStatus(fullOrder) : {};
    if (!portal.canView) {
      alert('Results are not available yet. Your provider must review them first.');
      return;
    }
    const patient = await resolvePatientForOrder(fullOrder);
    openHtmlWindow(buildReviewedResultsHtml(fullOrder, patient), 'Reviewed results');
  }

  async function fetchPortalOrderById(orderId) {
    if (!orderId || !global.supabaseClient) return null;
    const { data, error } = await global.supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  global.MediForgePatientPortalOrders = {
    openOrderCopy,
    openReviewedResults,
    fetchPortalOrderById,
    buildOrderCopyHtml,
    buildReviewedResultsHtml
  };
})(typeof window !== 'undefined' ? window : global);

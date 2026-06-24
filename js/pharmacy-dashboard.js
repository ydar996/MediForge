/**
 * Pharmacy Dashboard UI Logic
 * Handles all pharmacy dashboard interactions
 * ONLY accessible to Pharmacists - does not modify existing prescription flows
 */

function pharmacyPrescriptionMnemonicLabel(prescription) {
  if (!prescription) return '';
  if (typeof window.getPrescriptionDisplayLabel === 'function') {
    return window.getPrescriptionDisplayLabel(prescription);
  }
  if (typeof window.getPrescriptionMnemonic === 'function') {
    const m = window.getPrescriptionMnemonic(prescription);
    if (m) return m;
  }
  const id = prescription.id;
  return (typeof id === 'string' ? id : (id || '').toString()).substring(0, 8);
}

// Check access and initialize
document.addEventListener('DOMContentLoaded', async function() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (user.role !== 'Pharmacist' && user.role !== 'pharmacist') {
    document.getElementById('access-denied').style.display = 'block';
    return;
  }
  
  document.getElementById('pharmacy-content').style.display = 'block';
  
  // Show org context (inventory is per-org)
  try {
    const orgId = await window.getPharmacyOrgId();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const orgName = user.org || user.organization_name || 'Unknown';
    const el = document.getElementById('pharmacy-org-context');
    if (el) el.textContent = `Viewing as: ${orgName} (inventory is per organization)`;
  } catch (e) {
    const el = document.getElementById('pharmacy-org-context');
    if (el) el.textContent = 'Org context unavailable';
  }
  
  // Load initial data
  await loadDashboard();
  
  // Load default tab content (incoming is active by default but never populated on first load)
  switchTab('incoming', null);
  
  // Auto-refresh every 30 seconds
  setInterval(loadDashboard, 30000);
});

// Switch tabs
function switchTab(tabName, event) {
  // Hide all tabs
  document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Show selected tab - handle both event-based and programmatic calls
  if (event && event.target) {
    event.target.classList.add('active');
  } else {
    // Find tab by data attribute or text content
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-tab') === tabName || 
          tab.textContent.toLowerCase().includes(tabName.replace('-', ' '))) {
        tab.classList.add('active');
      }
    });
  }
  
  const tabContent = document.getElementById(`tab-${tabName}`);
  if (tabContent) {
    tabContent.classList.add('active');
  }
  
  // Load tab data
  if (tabName === 'incoming') {
    loadIncomingPrescriptions();
  } else if (tabName === 'ready-to-fill') {
    loadReadyToFillPrescriptions();
  } else if (tabName === 'in-process') {
    loadInProcessPrescriptions();
  } else if (tabName === 'filled') {
    loadFilledPrescriptions();
  } else if (tabName === 'inventory') {
    loadInventory();
  } else if (tabName === 'import-stock') {
    loadImportStockForm();
  } else if (tabName === 'pharmacist-prescribe') {
    loadPharmacistPrescribeForm();
  } else if (tabName === 'add-medication') {
    loadAddMedicationForm(window._addMedicationPrefill || undefined);
    window._addMedicationPrefill = null;
  }
}

// Load dashboard stats
async function loadDashboard() {
  try {
    // Load stock alerts (may return empty if stock_alerts table not populated)
    let alertsCount = 0;
    try {
      const alerts = await window.getStockAlerts();
      displayStockAlerts(alerts);
      alertsCount = alerts.length;
    } catch (error) {
      console.warn('Could not load stock alerts:', error);
    }
    
    // Load prescription counts
    let incoming = [];
    let inProcess = [];
    let filled = [];
    
    try {
      incoming = await window.getIncomingPrescriptions();
      document.getElementById('stat-incoming').textContent = incoming.length;
    } catch (error) {
      console.warn('Could not load incoming prescriptions:', error);
      document.getElementById('stat-incoming').textContent = '0';
    }
    
    try {
      inProcess = await window.getInProcessPrescriptions();
      document.getElementById('stat-in-process').textContent = inProcess.length;
    } catch (error) {
      console.warn('Could not load in-process prescriptions:', error);
      document.getElementById('stat-in-process').textContent = '0';
    }
    
    try {
      const readyToFill = await window.getReadyToFillPrescriptions();
      const rtEl = document.getElementById('stat-ready-to-fill');
      if (rtEl) rtEl.textContent = readyToFill.length;
    } catch (error) {
      console.warn('Could not load ready-to-fill:', error);
      const rtEl = document.getElementById('stat-ready-to-fill');
      if (rtEl) rtEl.textContent = '0';
    }
    
    try {
      filled = await window.getFilledPrescriptions();
      // Count filled today
      const today = new Date().toISOString().split('T')[0];
      const filledToday = filled.filter(p => p.filled_at && p.filled_at.startsWith(today)).length;
      document.getElementById('stat-filled').textContent = filledToday;
    } catch (error) {
      console.warn('Could not load filled prescriptions:', error);
      document.getElementById('stat-filled').textContent = '0';
    }
    
    // Load inventory count and derive low stock count (fallback when stock_alerts is empty)
    let lowStockFromInventory = 0;
    try {
      const inventory = await window.getMedicationInventory();
      document.getElementById('stat-inventory').textContent = inventory.length;
      const getStatus = (i) => i.status ?? (i.current_stock === 0 ? 'Out of Stock' : (i.current_stock || 0) <= (i.reorder_point ?? i.minimum_stock ?? i.reorder_level ?? 0) ? 'Low Stock' : 'In Stock');
      lowStockFromInventory = inventory.filter(i => getStatus(i) === 'Low Stock' || getStatus(i) === 'Out of Stock').length;
    } catch (error) {
      console.warn('Could not load inventory:', error);
      document.getElementById('stat-inventory').textContent = '0';
    }
    // Low Stock Alerts: use inventory-derived count when stock_alerts is empty (table may not be populated)
    document.getElementById('stat-alerts').textContent = Math.max(alertsCount, lowStockFromInventory);
    
    // Show migration notice if tables are missing
    checkMigrationStatus();
    
    // Do NOT reload tab content on 30s refresh – it resets inventory sub-tabs and disrupts the user.
    // Stats above are already updated. User can click a tab to reload its content if needed.
    
  } catch (error) {
    console.error('Error loading dashboard:', error);
    // Show error message to user
    showMigrationNotice();
  }
}

// Check if migration has been run
async function checkMigrationStatus() {
  try {
    const supabase = await window.getPharmacySupabaseClient();
    // Try to query a table that should exist after migration
    const { error: tableError } = await supabase
      .from('stock_alerts')
      .select('id')
      .limit(1);
    
    // Also check for pharmacy_status column
    const { error: columnError } = await supabase
      .from('prescriptions')
      .select('pharmacy_status')
      .limit(1);
    
    // If both checks fail, show notice
    if (tableError && (tableError.code === 'PGRST205' || tableError.message?.includes('Could not find the table'))) {
      showMigrationNotice();
    } else if (columnError && (columnError.code === '42703' || columnError.message?.includes('column') || columnError.message?.includes('pharmacy_status'))) {
      showMigrationNotice();
    } else {
      // Migration is complete - remove notice if it exists
      const notice = document.getElementById('migration-notice');
      if (notice) {
        notice.remove();
      }
    }
  } catch (error) {
    // If we can't check, don't show notice (might be a different error)
    console.warn('Could not verify migration status:', error);
  }
}

// Show migration notice
function showMigrationNotice() {
  const container = document.getElementById('pharmacy-content');
  if (!container) return;
  
  // Check if notice already exists
  if (document.getElementById('migration-notice')) return;
  
  const notice = document.createElement('div');
  notice.id = 'migration-notice';
  notice.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 20px; margin-bottom: 20px; border-radius: 4px;';
  notice.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: #856404;">⚠️ Database Migration Required</h3>
    <p style="margin: 0 0 10px 0; color: #856404;">
      The pharmacy management system requires database tables to be created. 
      Please run the migration file: <code>supabase/migrations/20250118000001_create_pharmacy_tables.sql</code>
    </p>
    <p style="margin: 0; color: #856404; font-size: 14px;">
      <strong>To fix:</strong> Go to your Supabase dashboard → SQL Editor → Run the migration file.
    </p>
  `;
  
  container.insertBefore(notice, container.firstChild);
}

// Display stock alerts
function displayStockAlerts(alerts) {
  const container = document.getElementById('stock-alerts-container');
  
  if (!alerts || alerts.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  
  let html = '';
  
  if (criticalAlerts.length > 0) {
    html += '<div class="alert-banner critical">';
    html += '<strong>🚨 Critical Alerts:</strong><ul style="margin: 10px 0 0 20px;">';
    criticalAlerts.forEach(alert => {
      html += `<li>${alert.message}</li>`;
    });
    html += '</ul></div>';
  }
  
  if (warningAlerts.length > 0) {
    html += '<div class="alert-banner">';
    html += '<strong>⚠️ Low Stock Warnings:</strong><ul style="margin: 10px 0 0 20px;">';
    warningAlerts.slice(0, 5).forEach(alert => {
      html += `<li>${alert.message}</li>`;
    });
    if (warningAlerts.length > 5) {
      html += `<li>... and ${warningAlerts.length - 5} more</li>`;
    }
    html += '</ul></div>';
  }
  
  container.innerHTML = html;
}

// Ensure only legacy patient IDs (MECXXXX) or manually entered ones are displayed - never UUIDs
async function enrichPrescriptionsWithDisplayIds(prescriptions) {
  if (!prescriptions || prescriptions.length === 0) return prescriptions;
  const isUuid = (id) => id && typeof id === 'string' && id.includes('-') && id.length === 36;
  const resolve = typeof window.resolvePatientByIdentifier === 'function' ? window.resolvePatientByIdentifier : null;
  const getIdentifier = typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier : null;
  for (const p of prescriptions) {
    const pid = p.patient_id;
    if (!pid) {
      p.displayPatientId = '';
      continue;
    }
    let resolvedPatient = null;
    if (resolve) {
      try {
        resolvedPatient = await resolve(pid);
        if (resolvedPatient) p._resolvedPatient = resolvedPatient;
      } catch (e) {
        resolvedPatient = null;
      }
    }
    if (typeof window.getPatientIdForDisplay === 'function') {
      p.displayPatientId =
        window.getPatientIdForDisplay(resolvedPatient || { patient_id: pid }, pid) || '';
    } else if (!isUuid(pid)) {
      p.displayPatientId = pid;
    } else if (resolvedPatient && getIdentifier) {
      p.displayPatientId = getIdentifier(resolvedPatient) || '';
    } else {
      p.displayPatientId = isUuid(pid) ? '' : pid;
    }
  }
  return prescriptions;
}

function pharmacyPatientIdUi(item) {
  const hint = item.displayPatientId || item.patient_id || '';
  const subject = item._resolvedPatient || hint;
  const raw =
    typeof window.patientMrnDisplay === 'function'
      ? window.patientMrnDisplay(subject, hint)
      : hint;
  return String(raw || ':').replace(/</g, '&lt;');
}

// Load incoming prescriptions
async function loadIncomingPrescriptions() {
  const container = document.getElementById('incoming-prescriptions-list');
  container.innerHTML = '<div class="loading">Loading incoming prescriptions...</div>';
  
  try {
    let prescriptions = await window.getIncomingPrescriptions();
    prescriptions = await enrichPrescriptionsWithDisplayIds(prescriptions);
    
    if (prescriptions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No incoming prescriptions</h3>
          <p>Prescriptions appear here when a doctor <strong>signs</strong> a prescription and your organization has <strong>In-House Pharmacy</strong> enabled.</p>
          <ul style="text-align: left; max-width: 400px; margin: 16px auto;">
            <li>Dashboard → turn on <strong>💊 In-House Pharmacy: True</strong></li>
            <li>Doctor opens a patient → <strong>Prescription</strong> → adds meds and <strong>signs</strong> → Save</li>
            <li>If the table was missing, run migration: <code>supabase/migrations/20260206000005_create_prescriptions_table.sql</code></li>
          </ul>
          <p><small>Signed prescriptions from patient records also appear here; use &quot;Add to pharmacy queue&quot; to process them.</small></p>
        </div>
      `;
      return;
    }
    
    window.__pharmacyIncomingPrescriptions = prescriptions;
    const safePrescId = (p) => (typeof p?.id === 'string' ? p.id : (p?.id?.id || p?.id?.uuid || (p?.id && String(p.id) !== '[object Object]' ? String(p.id) : '')));
    container.innerHTML = prescriptions.map((prescription, index) => {
      const medications = Array.isArray(prescription.medications) ? prescription.medications : (typeof prescription.medications === 'string' ? JSON.parse(prescription.medications || '[]') : []);
      const sentDate = prescription.sent_to_pharmacy_at ? new Date(prescription.sent_to_pharmacy_at).toLocaleString() : 'N/A';
      const fromPatientRecord = !!prescription._fromPatientRecord;
      const sentToAccountant = prescription.pharmacy_status === 'approved_by_pharmacist';
      const patientName = prescription.patient_name || prescription.displayPatientId || prescription.patient_id;
      const idForDisplay = pharmacyPrescriptionMnemonicLabel(prescription);
      const prescId = safePrescId(prescription);
      const patientIdForUrl = prescription.displayPatientId || prescription.patient_id || '';
      const addAllergyUrl = patientIdForUrl ? `pharmacy-add-patient-allergy.html?patientId=${encodeURIComponent(patientIdForUrl || prescription.patient_id)}` : (prescription.patient_id ? `pharmacy-add-patient-allergy.html?patientId=${encodeURIComponent(prescription.patient_id)}` : '#');
      let actionBlock;
      if (sentToAccountant) {
        actionBlock = '<div class="action-buttons action-sent-to-accountant"><span class="status-badge" style="background:#17a2b8;color:#fff;">Sent to Biller/Accountant</span> <span style="color:#666;font-size:14px;">Waiting for payment. Will move to Ready to fill when paid.</span></div>';
      } else if (fromPatientRecord) {
        actionBlock = `<div class="action-buttons">
             <span class="status-badge" style="background:#6c757d;margin-right:8px;">From patient record</span>
             <button class="btn btn-primary" onclick="window.addToQueueFromPatientRecord(this)">
               Add to pharmacy queue
             </button>
           </div>`;
      } else {
        actionBlock = `<div class="action-buttons">
             <a href="${addAllergyUrl}" class="btn btn-outline-secondary" ${patientIdForUrl ? '' : 'style="pointer-events:none;opacity:0.6"'}>Add allergy</a>
             <button class="btn btn-primary" onclick="approvePrescriptionFromCard('${prescId}', this)">Approve</button>
             <button class="btn btn-outline-danger" onclick="rejectPrescriptionFromCard('${prescId}', this)">Reject / Return</button>
             <button class="btn btn-outline-secondary" onclick="sentOutPrescriptionFromCard('${prescId}', this)">Sent out</button>
           </div>`;
      }
      const statusBadge = sentToAccountant
        ? '<span class="status-badge" style="background:#17a2b8;color:#fff;">Sent to Biller/Accountant</span>'
        : '<span class="status-badge status-pending">Pending</span>';
      const prescriberBadge = prescription.prescriber_type === 'pharmacist'
        ? '<span class="status-badge" style="background:#6f42c1;color:#fff;margin-left:6px;">Prescribed by pharmacist</span>' : '';
      return `
        <div class="prescription-card" data-incoming-index="${index}">
          <div class="prescription-header">
            <div class="prescription-info">
              <h3>Prescription #${idForDisplay}</h3>
              <div class="prescription-meta">
                Patient: ${patientName}<br>
                Patient ID: ${pharmacyPatientIdUi(prescription)}<br>
                Sent: ${sentDate}<br>
                Diagnosis: ${prescription.diagnosis || 'N/A'}
              </div>
            </div>
            ${statusBadge}${prescriberBadge}
          </div>
          
          <div class="medications-list">
            <strong>Medications:</strong>
            ${medications.map(med => `
              <div class="medication-item">
                <div>
                  <strong>${med.name || med.medication_name || 'N/A'}</strong> - ${med.strength || ''} ${med.form || ''}<br>
                  <small>Quantity: ${med.quantity || 'N/A'}, Refills: ${med.refills ?? 0}</small>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${actionBlock}
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading incoming prescriptions:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load ready-to-fill prescriptions (approved + paid) – show Start Fill
async function loadReadyToFillPrescriptions() {
  const container = document.getElementById('ready-to-fill-prescriptions-list');
  if (!container) return;
  container.innerHTML = '<div class="loading">Loading ready-to-fill prescriptions...</div>';
  try {
    let prescriptions = await window.getReadyToFillPrescriptions();
    prescriptions = await enrichPrescriptionsWithDisplayIds(prescriptions);
    if (prescriptions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No prescriptions ready to fill</h3>
          <p>Prescriptions appear here after the <strong>Biller/Accountant</strong> has generated an invoice and <strong>received payment</strong>. Then you can start filling.</p>
        </div>
      `;
      return;
    }
    const idFor = p => pharmacyPrescriptionMnemonicLabel(p);
    const prescIdFor = (p) => (typeof p?.id === 'string' ? p.id : (p?.id?.id || p?.id?.uuid || (p?.id && String(p.id) !== '[object Object]' ? String(p.id) : '')));
    container.innerHTML = prescriptions.map(p => {
      const medRaw = p.medications;
      const medications = Array.isArray(medRaw) ? medRaw : (typeof medRaw === 'string' ? JSON.parse(medRaw || '[]') : []);
      const prescriberBadge = p.prescriber_type === 'pharmacist'
        ? '<span class="status-badge" style="background:#6f42c1;color:#fff;margin-left:6px;">Prescribed by pharmacist</span>' : '';
      return `
        <div class="prescription-card">
          <div class="prescription-header">
            <div class="prescription-info">
              <h3>Prescription #${idFor(p)}</h3>
              <div class="prescription-meta">
                Patient: ${p.patient_name || p.displayPatientId || p.patient_id}<br>
                Patient ID: ${pharmacyPatientIdUi(p)}<br>
                Diagnosis: ${(p.diagnosis || 'N/A').substring(0, 80)}${(p.diagnosis || '').length > 80 ? '…' : ''}
              </div>
            </div>
            <span class="status-badge" style="background:#008753;">Paid</span>${prescriberBadge}
          </div>
          <div class="medications-list">
            <strong>Medications:</strong>
            ${medications.map(med => `
              <div class="medication-item">
                <strong>${med.name || 'N/A'}</strong> – ${med.strength || ''} ${med.form || ''} · Qty: ${med.quantity || 'N/A'}
              </div>
            `).join('')}
          </div>
          <div class="action-buttons">
            <button class="btn btn-primary" onclick="startProcessing('${prescIdFor(p)}')">Start Fill</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading ready-to-fill:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load in-process prescriptions (per-medication status: Mark as Dispensed per line)
async function loadInProcessPrescriptions() {
  const container = document.getElementById('in-process-prescriptions-list');
  container.innerHTML = '<div class="loading">Loading in-process prescriptions...</div>';
  
  try {
    let prescriptions = await window.getInProcessPrescriptions();
    prescriptions = await enrichPrescriptionsWithDisplayIds(prescriptions);
    
    if (prescriptions.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No prescriptions in process</h3></div>';
      return;
    }
    
    const ensurePrescId = (p) => (typeof p?.id === 'string' ? p.id : (p?.id?.id || p?.id?.uuid || (p?.id && String(p.id) !== '[object Object]' ? String(p.id) : '')));
    container.innerHTML = prescriptions.map(prescription => {
      const medRaw = prescription.medications;
      const medications = Array.isArray(medRaw) ? medRaw : (typeof medRaw === 'string' ? JSON.parse(medRaw || '[]') : []);
      const prescId = ensurePrescId(prescription);
      const idShort = pharmacyPrescriptionMnemonicLabel(prescription);
      const prescriberBadge = prescription.prescriber_type === 'pharmacist'
        ? '<span class="status-badge" style="background:#6f42c1;color:#fff;margin-left:6px;">Prescribed by pharmacist</span>' : '';
      return `
        <div class="prescription-card">
          <div class="prescription-header">
            <div class="prescription-info">
              <h3>Prescription #${idShort}</h3>
              <div class="prescription-meta">
                Patient ID: ${pharmacyPatientIdUi(prescription)}<br>
                Diagnosis: ${(prescription.diagnosis || 'N/A').replace(/</g, '&lt;')}
              </div>
            </div>
            <span class="status-badge status-in-process">In Process</span>${prescriberBadge}
          </div>
          
          <div class="medications-list">
            <strong>Medications:</strong>
            ${medications.map((med, idx) => {
              const lineStatus = med.pharmacy_line_status || 'in-process';
              const isTerminal = lineStatus === 'completed' || lineStatus === 'rejected' || lineStatus === 'sent_out';
              const statusLabel = lineStatus === 'completed' ? 'Completed' : lineStatus === 'rejected' ? 'Rejected' : lineStatus === 'sent_out' ? 'Sent out' : 'In Process';
              const statusClass = lineStatus === 'completed' ? 'status-filled' : lineStatus === 'rejected' || lineStatus === 'sent_out' ? 'status-pending' : 'status-in-process';
              return `
              <div class="medication-item" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <div>
                  <strong>${(med.name || 'N/A').replace(/</g, '&lt;')}</strong> – ${(med.strength || '').replace(/</g, '&lt;')} ${(med.form || '').replace(/</g, '&lt;')}<br>
                  <small>Quantity: ${med.quantity || 'N/A'}, Refills: ${med.refills ?? 0}</small>
                  <span class="status-badge ${statusClass}" style="margin-left:8px;">${statusLabel}</span>
                </div>
                <div>
                  ${!isTerminal ? `<button type="button" class="btn btn-success btn-mark-line-dispensed" data-prescription-id="${prescId}" data-line-index="${idx}">✅ Mark as Dispensed</button>` : ''}
                  ${!isTerminal ? `<button type="button" class="btn btn-outline-danger btn-reject-line" data-prescription-id="${prescId}" data-line-index="${idx}">Reject line</button>` : ''}
                  ${!isTerminal ? `<button type="button" class="btn btn-outline-secondary btn-sent-out-line" data-prescription-id="${prescId}" data-line-index="${idx}">Sent out</button>` : ''}
                  <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
                    <input type="text" class="dispense-notes-input" data-prescription-id="${prescId}" data-line-index="${idx}" placeholder="Dispense notes (optional)" style="width:100%;max-width:220px;padding:6px 8px;font-size:12px;border:1px solid #ddd;border-radius:4px;">
                    <button type="button" class="btn btn-outline-secondary btn-dispense-line" data-prescription-id="${prescId}" data-line-index="${idx}">💊 Dispense</button>
                  </div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
    
    // Delegate: Mark as Dispensed per line
    container.querySelectorAll('.btn-mark-line-dispensed').forEach(btn => {
      btn.addEventListener('click', async function() {
        const prescriptionId = this.getAttribute('data-prescription-id');
        const lineIndex = parseInt(this.getAttribute('data-line-index'), 10);
        if (prescriptionId == null || isNaN(lineIndex)) return;
        if (!confirm('Mark this medication line as dispensed?')) return;
        this.disabled = true;
        this.textContent = '…';
        try {
          await window.markMedicationLineDispensed(prescriptionId, lineIndex);
          loadInProcessPrescriptions();
          loadDashboard();
        } catch (err) {
          this.disabled = false;
          this.textContent = '✅ Mark as Dispensed';
          alert('Error: ' + (err.message || err));
        }
      });
    });
    
    // Delegate: Reject line (per medication)
    container.querySelectorAll('.btn-reject-line').forEach(btn => {
      btn.addEventListener('click', async function() {
        const prescriptionId = this.getAttribute('data-prescription-id');
        const lineIndex = parseInt(this.getAttribute('data-line-index'), 10);
        if (prescriptionId == null || isNaN(lineIndex)) return;
        const reason = prompt('Reason for rejecting this line (e.g. allergy, contraindication, patient unable to afford):');
        if (reason === null) return;
        this.disabled = true;
        this.textContent = '…';
        try {
          await window.updatePrescriptionLineStatus(prescriptionId, lineIndex, 'rejected', reason || '');
          loadInProcessPrescriptions();
          loadDashboard();
        } catch (err) {
          this.disabled = false;
          this.textContent = 'Reject line';
          alert('Error: ' + (err.message || err));
        }
      });
    });

    // Delegate: Sent out (per medication – not in local inventory)
    container.querySelectorAll('.btn-sent-out-line').forEach(btn => {
      btn.addEventListener('click', async function() {
        const prescriptionId = this.getAttribute('data-prescription-id');
        const lineIndex = parseInt(this.getAttribute('data-line-index'), 10);
        if (prescriptionId == null || isNaN(lineIndex)) return;
        const notes = prompt('Notes (e.g. printed for outside pharmacy):');
        if (notes === null) return;
        this.disabled = true;
        this.textContent = '…';
        try {
          await window.updatePrescriptionLineStatus(prescriptionId, lineIndex, 'sent_out', notes || '');
          loadInProcessPrescriptions();
          loadDashboard();
        } catch (err) {
          this.disabled = false;
          this.textContent = 'Sent out';
          alert('Error: ' + (err.message || err));
        }
      });
    });

    // Delegate: Dispense (per line – uses notes from card, no prompts)
    container.querySelectorAll('.btn-dispense-line').forEach(btn => {
      btn.addEventListener('click', async function() {
        const prescriptionId = this.getAttribute('data-prescription-id');
        const lineIndex = parseInt(this.getAttribute('data-line-index'), 10);
        if (!prescriptionId || prescriptionId === '[object Object]' || isNaN(lineIndex)) {
          alert('Error: Invalid prescription ID');
          return;
        }
        const notesInput = this.closest('.medication-item')?.querySelector('.dispense-notes-input');
        const notes = notesInput ? notesInput.value.trim() || null : null;
        try {
          const supabase = await window.getPharmacySupabaseClient();
          const { data: prescription, error } = await supabase.from('prescriptions').select('medications, patient_id').eq('id', prescriptionId).single();
          if (error || !prescription) throw new Error('Prescription not found');
          const meds = Array.isArray(prescription.medications) ? prescription.medications : (typeof prescription.medications === 'string' ? JSON.parse(prescription.medications || '[]') : []);
          const med = meds[lineIndex];
          if (!med) throw new Error('Medication line not found');
          await window.dispenseMedication({
            prescription_id: prescriptionId,
            patient_id: prescription.patient_id,
            medication_name: med.name || med.medication_name,
            strength: med.strength || '',
            form: med.form || '',
            quantity: parseInt(med.quantity, 10) || 1,
            batch_number: null,
            expiry_date: null,
            notes: notes
          });
          alert('✅ Medication dispensed successfully!');
          loadInProcessPrescriptions();
          loadDashboard();
        } catch (err) {
          if (err.code === 'MEDICATION_NOT_IN_INVENTORY' && err.medication) {
            const med = err.medication;
            const displayName = [med.name, med.strength, med.form].filter(Boolean).join(' - ');
            const add = confirm(err.message + '\n\nAdd "' + displayName + '" to inventory now?');
            if (add) {
              window._addMedicationPrefill = { name: med.name, strength: med.strength, form: med.form };
              switchTab('add-medication', null);
            }
          } else {
            alert('Error: ' + (err.message || err));
          }
        }
      });
    });
    
  } catch (error) {
    console.error('Error loading in-process prescriptions:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load filled prescriptions
async function loadFilledPrescriptions() {
  const container = document.getElementById('filled-prescriptions-list');
  container.innerHTML = '<div class="loading">Loading filled prescriptions...</div>';
  
  try {
    let prescriptions = await window.getFilledPrescriptions();
    prescriptions = await enrichPrescriptionsWithDisplayIds(prescriptions);
    
    if (prescriptions.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No filled prescriptions</h3></div>';
      return;
    }
    
    container.innerHTML = prescriptions.map(prescription => {
      const medRaw = prescription.medications;
      const medications = Array.isArray(medRaw) ? medRaw : (typeof medRaw === 'string' ? JSON.parse(medRaw || '[]') : []);
      const filledDate = prescription.filled_at ? new Date(prescription.filled_at).toLocaleString() : 'N/A';
      const patientPickup = String(prescription.patient_pickup_status || '').toLowerCase();
      const pickupBadge = patientPickup === 'picked_up'
        ? `<span class="status-badge" style="background:#17a2b8;color:#fff;margin-left:6px;">Patient picked up${prescription.patient_pickup_at ? ' · ' + new Date(prescription.patient_pickup_at).toLocaleString() : ''}</span>`
        : (patientPickup === 'due_for_pickup' ? '<span class="status-badge" style="background:#ffc107;color:#333;margin-left:6px;">Awaiting patient pickup</span>' : '');
      const idDisplay = pharmacyPrescriptionMnemonicLabel(prescription);
      const prescriberBadge = prescription.prescriber_type === 'pharmacist'
        ? '<span class="status-badge" style="background:#6f42c1;color:#fff;margin-left:6px;">Prescribed by pharmacist</span>' : '';
      return `
        <div class="prescription-card">
          <div class="prescription-header">
            <div class="prescription-info">
              <h3>Prescription #${idDisplay}</h3>
              <div class="prescription-meta">
                Patient ID: ${pharmacyPatientIdUi(prescription)}<br>
                Filled: ${filledDate}<br>
                Diagnosis: ${prescription.diagnosis || 'N/A'}
              </div>
            </div>
            <span class="status-badge status-filled">Filled</span>${prescriberBadge}${pickupBadge}
          </div>
          
          <div class="medications-list">
            <strong>Medications:</strong>
            ${medications.map(med => `
              <div class="medication-item">
                <div>
                  <strong>${med.name}</strong> - ${med.strength} ${med.form}<br>
                  <small>Quantity: ${med.quantity || 'N/A'}, Refills: ${med.refills || 0}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Error loading filled prescriptions:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

// Load inventory (enhanced: dashboard + table, industry-standard columns)
async function loadInventory() {
  const container = document.getElementById('inventory-list');
  container.innerHTML = '<div class="loading">Loading inventory...</div>';
  
  try {
    let enriched = [];
    try {
      enriched = typeof window.getEnrichedInventory === 'function' ? await window.getEnrichedInventory() : await window.getMedicationInventory();
    } catch (_) {
      enriched = await window.getMedicationInventory();
    }
    window.__pharmacyInventory = enriched;
    
    if (enriched.length === 0) {
      container.innerHTML = '<div class="empty-state"><h3>No medications in inventory</h3><p>Add medications via <strong>Add Medication</strong> or bulk import via <strong>Import Opening Stock</strong>. Inventory is per organization.</p></div>';
      return;
    }
    
    renderInventoryEnhanced(container, enriched);
    
  } catch (error) {
    console.error('Error loading inventory:', error);
    container.innerHTML = `<div class="empty-state"><h3>Error</h3><p>${error.message}</p></div>`;
  }
}

function renderInventoryEnhanced(container, inventory) {
  const currency = typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : 'CAD';
  const fmt = (v, c) => (typeof window.formatCurrency === 'function' ? window.formatCurrency(v, c || currency) : (currency === 'NGN' ? '₦' : '$') + (v || 0));
  
  container.innerHTML = `
    <div class="inventory-enhanced">
      <div class="inv-view-tabs" style="display:flex;gap:8px;margin-bottom:16px;">
        <button class="btn btn-success inv-tab-btn active" data-view="dashboard">📊 Dashboard</button>
        <button class="btn btn-outline-secondary inv-tab-btn" data-view="table">📋 Table View</button>
        <button class="btn btn-outline-secondary inv-tab-btn" data-view="analytics">📈 Analytics</button>
      </div>
      <div id="inv-dashboard-view" class="inv-view"></div>
      <div id="inv-table-view" class="inv-view" style="display:none;"></div>
      <div id="inv-analytics-view" class="inv-view" style="display:none;"></div>
    </div>
  `;
  
  const setActiveView = (view) => {
    window.__pharmacyInventoryView = view;
    container.querySelectorAll('.inv-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
      b.classList.toggle('btn-success', b.dataset.view === view);
      b.classList.toggle('btn-outline-secondary', b.dataset.view !== view);
    });
    container.querySelectorAll('.inv-view').forEach(v => v.style.display = 'none');
    const viewEl = document.getElementById(`inv-${view}-view`);
    if (viewEl) viewEl.style.display = 'block';
    if (view === 'dashboard') renderInventoryDashboard(document.getElementById('inv-dashboard-view'), inventory);
    else if (view === 'table') renderInventoryTable(document.getElementById('inv-table-view'), inventory, fmt);
    else if (view === 'analytics') renderInventoryAnalytics(document.getElementById('inv-analytics-view'), inventory);
  };

  container.querySelectorAll('.inv-tab-btn').forEach(btn => {
    btn.onclick = (e) => { e.preventDefault(); setActiveView(btn.dataset.view); };
  });

  const preservedView = window.__pharmacyInventoryView || 'dashboard';
  setActiveView(preservedView);
}

async function renderInventoryDashboard(el, inventory) {
  el.innerHTML = '<div class="loading">Loading dashboard...</div>';
  let kpis = {};
  let trendData = [];
  let categoryData = [];
  let topSelling = [];
  try {
    if (typeof window.getInventoryKPIs === 'function') kpis = await window.getInventoryKPIs();
    if (typeof window.getSalesTrendData === 'function') trendData = await window.getSalesTrendData(30);
    if (typeof window.getInventoryByCategory === 'function') categoryData = await window.getInventoryByCategory();
    if (typeof window.getTopSellingItems === 'function') topSelling = await window.getTopSellingItems(10, 30);
  } catch (e) { console.warn('Analytics load error:', e); }
  
  const currency = typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : 'CAD';
  const fmt = (v) => (typeof window.formatCurrency === 'function' ? window.formatCurrency(v, currency) : (currency === 'NGN' ? '₦' : '$') + (v || 0));
  
  const nearExpiry = inventory.filter(i => i.near_expiry && !i.expired);
  const expired = inventory.filter(i => i.expired);
  const lowStock = inventory.filter(i => i.status === 'Low Stock' || i.status === 'Out of Stock');
  
  const lowCount = kpis.lowStockCount ?? lowStock.length;
  const outCount = kpis.outOfStockCount ?? inventory.filter(i=>i.status==='Out of Stock').length;
  const nearCount = kpis.nearExpiryCount ?? nearExpiry.length;
  const expCount = kpis.expiredCount ?? expired.length;
  const totalVal = kpis.totalValue ?? inventory.reduce((s,i)=>(s+(i.cost_price||i.cost_per_unit||0)*(i.quantity_on_hand||i.current_stock||0)),0);
  const itemsWithCost = inventory.filter(i=>(i.cost_price??i.cost_per_unit??0)>0 && (i.quantity_on_hand??i.current_stock??0)>0).length;
  const showCostHint = inventory.length > 10 && totalVal < 10000 && itemsWithCost < inventory.length * 0.5;
  el.innerHTML = `
    <div class="inv-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">
      <a href="/pharmacy-inventory-details?type=total-items" class="kpi-card" style="background:linear-gradient(135deg,#008753,#006b42);color:white;padding:16px;border-radius:8px;text-decoration:none;display:block;cursor:pointer;color:inherit;">
        <div style="font-size:12px;opacity:0.9;">Total Items</div>
        <div style="font-size:24px;font-weight:700;">${kpis.totalItems ?? inventory.length}</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px;">View details →</div>
      </a>
      <a href="/pharmacy-inventory-details?type=total-items" class="kpi-card" style="background:linear-gradient(135deg,#4169E1,#2a4a9e);color:white;padding:16px;border-radius:8px;text-decoration:none;display:block;cursor:pointer;color:inherit;">
        <div style="font-size:12px;opacity:0.9;">Inventory Value</div>
        <div style="font-size:20px;font-weight:700;">${fmt(totalVal)}</div>
        ${showCostHint ? `<div style="font-size:10px;opacity:0.85;margin-top:4px;">Only ${itemsWithCost} of ${inventory.length} items have cost. Use Import → Update existing to add costs.</div>` : '<div style="font-size:11px;opacity:0.8;margin-top:4px;">View details →</div>'}
      </a>
      <a href="/pharmacy-inventory-details?type=low-stock" class="kpi-card" style="background:linear-gradient(135deg,#FF8C00,#cc7000);color:white;padding:16px;border-radius:8px;text-decoration:none;display:block;cursor:pointer;color:inherit;">
        <div style="font-size:12px;opacity:0.9;">Low/Out of Stock</div>
        <div style="font-size:24px;font-weight:700;">${lowCount} / ${outCount}</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px;">View medicines →</div>
      </a>
      <a href="/pharmacy-inventory-details?type=expiry-risk" class="kpi-card" style="background:linear-gradient(135deg,#dc3545,#a82833);color:white;padding:16px;border-radius:8px;text-decoration:none;display:block;cursor:pointer;color:inherit;">
        <div style="font-size:12px;opacity:0.9;">Near Expiry / Expired</div>
        <div style="font-size:24px;font-weight:700;">${nearCount} / ${expCount}</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px;">View medicines →</div>
      </a>
      <a href="/pharmacy-inventory-details?type=total-items" class="kpi-card" style="background:linear-gradient(135deg,#6f42c1,#4a2d82);color:white;padding:16px;border-radius:8px;text-decoration:none;display:block;cursor:pointer;color:inherit;">
        <div style="font-size:12px;opacity:0.9;">Avg Turnover</div>
        <div style="font-size:24px;font-weight:700;">${kpis.avgTurnover ?? ':'}</div>
        <div style="font-size:11px;opacity:0.8;margin-top:4px;">View details →</div>
      </a>
    </div>
    <div class="inv-alerts" style="margin-bottom:20px;">
      ${(lowStock.length > 0 || nearExpiry.length > 0 || expired.length > 0) ? `
        <div class="alert-banner ${expired.length > 0 ? 'critical' : ''}" style="padding:12px 16px;border-radius:8px;margin-bottom:8px;">
          <strong>⚠️ Alerts:</strong>
          ${expired.length > 0 ? `<span style="color:#dc3545;">${expired.length} expired</span>` : ''}
          ${expired.length > 0 && nearExpiry.length > 0 ? ' · ' : ''}
          ${nearExpiry.length > 0 ? `<span style="color:#ff8c00;">${nearExpiry.length} near expiry (&lt;30 days)</span>` : ''}
          ${(expired.length > 0 || nearExpiry.length > 0) && lowStock.length > 0 ? ' · ' : ''}
          ${lowStock.length > 0 ? `<span style="color:#ff8c00;">${lowStock.length} low/out of stock</span>` : ''}
        </div>
      ` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h4 style="margin:0 0 12px 0;">Sales Trend (30 days)</h4>
        <canvas id="inv-sales-chart" height="180"></canvas>
      </div>
      <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h4 style="margin:0 0 12px 0;">Inventory by Category</h4>
        <canvas id="inv-category-chart" height="180"></canvas>
      </div>
    </div>
    <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <h4 style="margin:0 0 12px 0;">Top Selling Items (30 days)</h4>
      <canvas id="inv-topselling-chart" height="200"></canvas>
    </div>
  `;
  
  if (typeof Chart !== 'undefined') {
    const salesEl = document.getElementById('inv-sales-chart');
    const catEl = document.getElementById('inv-category-chart');
    const topEl = document.getElementById('inv-topselling-chart');
    if (trendData.length > 0 && salesEl) {
      new Chart(salesEl, {
        type: 'line',
        data: { labels: trendData.map(d=>d.date.slice(5)), datasets: [{ label: 'Units', data: trendData.map(d=>d.units), borderColor: '#008753', fill: true, tension: 0.3 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
      });
    }
    if (categoryData.length > 0 && catEl) {
      new Chart(catEl, {
        type: 'doughnut',
        data: { labels: categoryData.map(d=>d.category), datasets: [{ data: categoryData.map(d=>d.count), backgroundColor: ['#008753','#4169E1','#FF8C00','#6f42c1','#17a2b8'] }] },
        options: { responsive: true }
      });
    }
    if (topSelling.length > 0 && topEl) {
      new Chart(topEl, {
        type: 'bar',
        data: { labels: topSelling.map(d=>d.name?.slice(0,20)+'…'), datasets: [{ label: 'Units sold', data: topSelling.map(d=>d.quantity), backgroundColor: '#008753' }] },
        options: { indexAxis: 'y', responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
      });
    }
  }
}

const INV_TABLE_COLUMN_DEFS = [
  { key: 'medication_name', label: 'Medication Name', required: true },
  { key: 'strength', label: 'Strength' },
  { key: 'form', label: 'Form' },
  { key: 'batch_number', label: 'Batch/Lot' },
  { key: 'expiry_date', label: 'Expiry' },
  { key: 'quantity_on_hand', label: 'Qty on Hand' },
  { key: 'cost_price', label: 'Cost' },
  { key: 'selling_price', label: 'Selling' },
  { key: 'reorder_level', label: 'Reorder' },
  { key: 'status', label: 'Status' }
];
const INV_TABLE_DEFAULT_HIDDEN = new Set(['batch_number', 'cost_price', 'reorder_level']);

function invTableColumnStorageKey() {
  const u = JSON.parse(localStorage.getItem('user') || '{}');
  return 'pharmacy_inv_table_cols_' + (u.org || u.organization_id || 'default');
}

function getDefaultInventoryTableColumnKeys() {
  return INV_TABLE_COLUMN_DEFS.map(d => d.key).filter(k => !INV_TABLE_DEFAULT_HIDDEN.has(k));
}

function loadInventoryTableColumnKeys() {
  const canonical = INV_TABLE_COLUMN_DEFS.map(d => d.key);
  const fallback = getDefaultInventoryTableColumnKeys();
  try {
    const raw = localStorage.getItem(invTableColumnStorageKey());
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    const picked = parsed.filter(k => canonical.includes(k));
    if (!picked.length) return fallback;
    return canonical.filter(k => picked.includes(k));
  } catch (e) {
    return fallback;
  }
}

function saveInventoryTableColumnKeys(keys) {
  const canonical = INV_TABLE_COLUMN_DEFS.map(d => d.key);
  const filtered = canonical.filter(k => keys.includes(k));
  const withRequired = filtered.includes('medication_name') ? filtered : ['medication_name', ...filtered.filter(k => k !== 'medication_name')];
  localStorage.setItem(invTableColumnStorageKey(), JSON.stringify(withRequired));
  return withRequired;
}

function renderInventoryTable(el, inventory, fmt) {
  // Full columns for CSV export (all data accessible)
  const colsAll = ['Item/Medicine Name','SKU/NDC','Barcode','Batch/Lot','Expiry','Qty on Hand','On PO','On SO','Reorder Level','Supplier','Cost','Selling','Shelf','Warehouse','Pack Size','Category','Velocity','WOS','Status','Last Received','Last Sold','Turnover','Carrying Cost'];
  const keysAll = ['medication_name','sku_ndc','barcode','batch_number','expiry_date','quantity_on_hand','on_purchase_order','on_sales_order','reorder_level','manufacturer','cost_price','selling_price','shelf_location','warehouse_location','pack_size','category_type','sales_velocity_per_day','weeks_of_supply','status','last_received_date','last_sold_date','inventory_turnover_rate','carrying_cost'];
  let visibleKeys = loadInventoryTableColumnKeys();

  const columnPickerHtml = INV_TABLE_COLUMN_DEFS.map(d => {
    const checked = visibleKeys.includes(d.key) ? ' checked' : '';
    const disabled = d.required ? ' disabled checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;margin:6px 0;cursor:${d.required ? 'default' : 'pointer'};font-size:13px;"><input type="checkbox" class="inv-col-toggle" data-col="${d.key}"${checked}${disabled}> ${d.label}${d.required ? ' <span style="color:#888;font-size:11px;">(always)</span>' : ''}</label>`;
  }).join('');

  el.innerHTML = `
    <div class="inv-table-toolbar" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;">
      <input type="text" id="inv-search" placeholder="Search by name, SKU, batch..." style="flex:1;min-width:200px;padding:8px 12px;border:1px solid #ccc;border-radius:4px;">
      <select id="inv-filter-status" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="">All statuses</option>
        <option value="In Stock">In Stock</option>
        <option value="Low Stock">Low Stock</option>
        <option value="Out of Stock">Out of Stock</option>
        <option value="Overstock">Overstock</option>
      </select>
      <select id="inv-filter-category" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="">All categories</option>
        ${[...new Set(inventory.map(i=>i.category_type||'General'))].map(c=>`<option value="${c}">${c}</option>`).join('')}
      </select>
      <select id="inv-filter-location" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="">All locations</option>
        ${[...new Set(inventory.map(i=>i.warehouse_location||i.shelf_location||'').filter(Boolean))].sort().map(l=>`<option value="${l}">${l}</option>`).join('')}
      </select>
      <div style="position:relative;">
        <button type="button" class="btn btn-outline-secondary" id="inv-columns-btn" title="Choose which columns appear in the table">Columns…</button>
        <div id="inv-column-panel" style="display:none;position:absolute;left:0;top:100%;margin-top:4px;z-index:50;background:#fff;border:1px solid #ccc;border-radius:8px;padding:12px 16px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:260px;max-height:min(380px,70vh);overflow-y:auto;">
          <div style="font-weight:600;margin-bottom:8px;font-size:13px;">Table columns</div>
          <p style="font-size:11px;color:#666;margin:0 0 8px;line-height:1.35;">Shown in this order. Cost, batch, and reorder are off by default; enable here anytime. Export CSV still includes all fields.</p>
          ${columnPickerHtml}
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline-secondary" id="inv-columns-reset" style="font-size:12px;padding:4px 10px;">Reset default</button>
            <button type="button" class="btn btn-primary" id="inv-columns-done" style="font-size:12px;padding:4px 10px;">Apply</button>
          </div>
        </div>
      </div>
      <button class="btn btn-outline-secondary" id="inv-export-csv" title="Export includes all columns (SKU, cost, supplier, etc.)">Export CSV</button>
      <button class="btn btn-outline-secondary" id="inv-export-pdf" title="Print to PDF">Export PDF</button>
      <span id="inv-summary-count" style="margin-left:auto;font-size:14px;color:#555;font-weight:500;"></span>
    </div>
    <div style="overflow-x:auto;">
      <table class="inventory-table" id="inv-data-table">
        <thead><tr id="inv-thead-row"></tr></thead>
        <tbody id="inv-tbody"></tbody>
      </table>
    </div>
    <div id="inv-pagination" style="margin-top:12px;display:flex;justify-content:center;gap:8px;"></div>
  `;

  function renderThead() {
    const tr = document.getElementById('inv-thead-row');
    if (!tr) return;
    tr.innerHTML = visibleKeys.map(k => {
      const def = INV_TABLE_COLUMN_DEFS.find(d => d.key === k);
      return `<th data-col="${k}" data-key="${k}">${def ? def.label : k}</th>`;
    }).join('') + '<th data-col="actions" class="inv-th-actions" data-key="actions">Actions</th>';
  }
  renderThead();
  
  let filtered = [...inventory];
  const PAGE_SIZE = 20;
  let page = 0;
  
  const getVal = (item, k) => {
    const fallbacks = { quantity_on_hand: 'current_stock', cost_price: 'cost_per_unit', selling_price: 'selling_price_per_unit', last_sold_date: 'last_dispensed_at', reorder_level: 'reorder_point', location: 'shelf_location', category_type: 'therapeutic_category', manufacturer: 'supplier_name' };
    if (k === 'sku_ndc') return item.sku_ndc ?? item.ndc ?? item.sku ?? '';
    return item[k] ?? item[fallbacks[k]] ?? '';
  };
  function row(item) {
    const status = item.status ?? (item.current_stock === 0 ? 'Out of Stock' : item.current_stock <= (item.reorder_point ?? item.minimum_stock ?? 0) ? 'Low Stock' : 'In Stock');
    const stockClass = status === 'Out of Stock' ? 'stock-out' : status === 'Low Stock' ? 'stock-low' : 'stock-ok';
    const esc = (v)=>String(v??'').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    const cells = visibleKeys.map(k => {
      const v = getVal(item, k);
      if (k === 'medication_name') return `<td data-col="${k}" class="inv-cell inv-cell--name"><strong>${esc(v) || ':'}</strong></td>`;
      if (k === 'expiry_date' && v) return `<td data-col="${k}">${new Date(v).toLocaleDateString()}</td>`;
      if (k === 'last_received_date' && v) return `<td data-col="${k}">${new Date(v).toLocaleDateString()}</td>`;
      if (k === 'last_sold_date' && v) return `<td data-col="${k}">${new Date(v).toLocaleDateString()}</td>`;
      if ((k === 'cost_price' || k === 'selling_price') && v != null && v !== '') return `<td data-col="${k}">${fmt(v)}</td>`;
      if (k === 'status') return `<td data-col="${k}" class="${stockClass}">${status}</td>`;
      return `<td data-col="${k}">${esc(v) || ':'}</td>`;
    }).join('');
    return `<tr>${cells}<td data-col="actions" class="inv-cell inv-cell--actions">
      <button type="button" class="btn btn-outline-secondary btn-edit-inventory" data-id="${item.id}" style="padding:4px 8px;font-size:12px;">Edit</button>
      <button type="button" class="btn btn-outline-secondary btn-cost-history" data-id="${item.id}" style="padding:4px 8px;font-size:12px;" title="Weighted average & purchase audit">History</button>
      <button type="button" class="btn btn-warning" onclick="adjustStock('${item.id}', '${(item.medication_name||'').replace(/'/g,"\\'")}', ${item.current_stock||item.quantity_on_hand||0})">Adjust</button>
    </td></tr>`;
  }
  
  function render() {
    const tbody = document.getElementById('inv-tbody');
    if (!tbody) return;
    const start = page * PAGE_SIZE;
    const pageData = filtered.slice(start, start + PAGE_SIZE);
    tbody.innerHTML = pageData.map(row).join('');
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const totalItems = inventory.length;
    const filteredCount = filtered.length;
    const summaryEl = document.getElementById('inv-summary-count');
    if (summaryEl) {
      if (filteredCount < totalItems) {
        summaryEl.textContent = `Showing ${filteredCount} of ${totalItems} items`;
        summaryEl.title = 'Filters are active';
      } else {
        summaryEl.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
        summaryEl.title = '';
      }
    }
    const pagEl = document.getElementById('inv-pagination');
    if (pagEl) {
      pagEl.innerHTML = totalPages <= 1 ? '' : `
        <button class="btn btn-outline-secondary inv-page-prev" ${page<=0?'disabled':''}>Prev</button>
        <span>Page ${page+1} of ${totalPages}</span>
        <button class="btn btn-outline-secondary inv-page-next" ${page>=totalPages-1?'disabled':''}>Next</button>
      `;
      pagEl.querySelector('.inv-page-prev')?.addEventListener('click', ()=>{ if (page>0) { page--; render(); } });
      pagEl.querySelector('.inv-page-next')?.addEventListener('click', ()=>{ if (page<totalPages-1) { page++; render(); } });
    }
    el.querySelectorAll('.btn-edit-inventory').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute('data-id');
        const item = (window.__pharmacyInventory||[]).find(i=>i.id===id);
        if (item) editInventoryDetails(id, item);
      };
    });
    el.querySelectorAll('.btn-cost-history').forEach(btn=>{
      btn.onclick = ()=>{
        const id = btn.getAttribute('data-id');
        const invItem = (window.__pharmacyInventory||[]).find(i=>i.id===id);
        if (invItem) showInventoryCostHistoryModal(id, invItem);
      };
    });
  }
  
  document.getElementById('inv-search').oninput = (e)=>{
    const q = (e.target.value||'').toLowerCase();
    filtered = inventory.filter(i=>
      !q || [i.medication_name,i.sku_ndc,i.ndc,i.barcode,i.batch_number,i.manufacturer].some(v=>(v||'').toLowerCase().includes(q))
    );
    const status = document.getElementById('inv-filter-status')?.value;
    const cat = document.getElementById('inv-filter-category')?.value;
    const loc = document.getElementById('inv-filter-location')?.value;
    const getStatus = (i) => i.status ?? (i.current_stock === 0 ? 'Out of Stock' : (i.current_stock || 0) <= (i.reorder_point ?? i.minimum_stock ?? i.reorder_level ?? 0) ? 'Low Stock' : 'In Stock');
    if (status) filtered = filtered.filter(i=>getStatus(i)===status);
    if (cat) filtered = filtered.filter(i=>(i.category_type||'General')===cat);
    if (loc) filtered = filtered.filter(i=>(i.warehouse_location||i.shelf_location||'')===loc);
    page = 0;
    render();
  };
  document.getElementById('inv-filter-status').onchange = ()=>document.getElementById('inv-search').dispatchEvent(new Event('input'));
  document.getElementById('inv-filter-category').onchange = ()=>document.getElementById('inv-search').dispatchEvent(new Event('input'));
  document.getElementById('inv-filter-location').onchange = ()=>document.getElementById('inv-search').dispatchEvent(new Event('input'));

  const colPanel = document.getElementById('inv-column-panel');
  const colBtn = document.getElementById('inv-columns-btn');
  function syncColumnPickerCheckboxes() {
    el.querySelectorAll('.inv-col-toggle:not(:disabled)').forEach(cb => {
      const k = cb.getAttribute('data-col');
      cb.checked = visibleKeys.includes(k);
    });
  }
  if (colPanel) colPanel.addEventListener('click', (e) => e.stopPropagation());
  if (colBtn && colPanel) {
    colBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = colPanel.style.display !== 'block';
      colPanel.style.display = open ? 'block' : 'none';
      if (open) syncColumnPickerCheckboxes();
    });
  }
  document.getElementById('inv-columns-done')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const picked = INV_TABLE_COLUMN_DEFS.map(d => d.key).filter(k => {
      const def = INV_TABLE_COLUMN_DEFS.find(x => x.key === k);
      const cb = el.querySelector('.inv-col-toggle[data-col="' + k + '"]');
      if (def && def.required) return true;
      return cb && cb.checked;
    });
    visibleKeys = saveInventoryTableColumnKeys(picked);
    renderThead();
    render();
    if (colPanel) colPanel.style.display = 'none';
  });
  document.getElementById('inv-columns-reset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    localStorage.removeItem(invTableColumnStorageKey());
    visibleKeys = loadInventoryTableColumnKeys();
    syncColumnPickerCheckboxes();
    renderThead();
    render();
  });
  
  document.getElementById('inv-export-pdf').onclick = ()=>{ window.print(); };
  document.getElementById('inv-export-csv').onclick = ()=>{
    const headers = colsAll;
    const csv = [headers.join(','), ...filtered.map(i=>keysAll.map(k=>{
      const v = i[k] ?? i[k.replace(/_/g,'')];
      const s = v != null ? String(v) : '';
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
    a.download = 'inventory-export.csv';
    a.click();
  };
  
  render();
}

async function renderInventoryAnalytics(el, inventory) {
  el.innerHTML = '<div class="loading">Loading analytics...</div>';
  let abc = [];
  let slow = [];
  let expiryRisk = [];
  try {
    if (typeof window.runABCAnalysis === 'function') abc = await window.runABCAnalysis();
    if (typeof window.getSlowMovingReport === 'function') slow = await window.getSlowMovingReport();
    if (typeof window.getExpiryRiskReport === 'function') expiryRisk = await window.getExpiryRiskReport();
  } catch (e) { console.warn('Analytics error:', e); }
  
  const currency = typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : 'CAD';
  const fmt = (v) => (typeof window.formatCurrency === 'function' ? window.formatCurrency(v, currency) : (currency === 'NGN' ? '₦' : '$') + (v || 0));
  
  el.innerHTML = `
    <div style="display:grid;gap:20px;">
      <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h4>ABC Analysis (by value)</h4>
        <p style="color:#666;font-size:13px;">A=high value, B=medium, C=low. Focus reorder on A items.</p>
        <table class="inventory-table" style="font-size:13px;"><thead><tr><th>Class</th><th>Item</th><th>Value</th><th>Cumulative %</th></tr></thead><tbody>
          ${(abc.length?abc.slice(0,30):[]).map(i=>`<tr><td><span style="font-weight:700;color:${i.abc_class==='A'?'#dc3545':i.abc_class==='B'?'#ff8c00':'#6c757d'}">${i.abc_class}</span></td><td>${(i.medication_name||'').replace(/</g,'&lt;')}</td><td>${fmt(i.totalValue)}</td><td>${i.cumulative_pct}%</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h4>Slow-Moving / Dead Stock (&gt;60 days unsold)</h4>
        <table class="inventory-table" style="font-size:13px;"><thead><tr><th>Item</th><th>Qty</th><th>Days since sold</th><th>Value</th></tr></thead><tbody>
          ${(slow.length?slow.slice(0,20):[]).map(i=>`<tr><td>${(i.medication_name||'').replace(/</g,'&lt;')}</td><td>${i.quantity_on_hand||i.current_stock}</td><td>${i.days_since_sold??':'}</td><td>${fmt((i.cost_price||i.cost_per_unit||0)*(i.quantity_on_hand||i.current_stock||0))}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div style="background:white;padding:16px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <h4>Expiry Risk (FEFO priority)</h4>
        <table class="inventory-table" style="font-size:13px;"><thead><tr><th>Item</th><th>Batch</th><th>Expiry</th><th>Days left</th><th>Qty</th></tr></thead><tbody>
          ${(expiryRisk.length?expiryRisk.slice(0,20):[]).map(i=>`<tr class="${i.expired?'stock-out':i.near_expiry?'stock-low':''}"><td>${(i.medication_name||'').replace(/</g,'&lt;')}</td><td>${i.batch_number||':'}</td><td>${i.expiry_date?new Date(i.expiry_date).toLocaleDateString():':'}</td><td>${i.days_to_expiry??':'}</td><td>${i.quantity_on_hand||i.current_stock}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  `;
}

function editInventoryDetails(inventoryId, item) {
  const v = (k) => (item[k] || '').toString().replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const modal = document.createElement('div');
  modal.id = 'edit-inventory-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;overflow-y:auto;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:8px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.15);">
      <h3 style="margin:0 0 16px 0;">Edit inventory – ${v('medication_name')}</h3>
      <div style="margin-bottom:12px;padding:10px;background:#f8f9fa;border-radius:6px;font-size:12px;color:#555;">Price changes take effect immediately and are logged with timestamp for audit.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label>Cost per unit</label><input type="number" id="inv-cost" step="0.01" min="0" value="${item.cost_per_unit ?? item.cost_price ?? ''}" placeholder="0.00" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Selling price per unit</label><input type="number" id="inv-selling-price" step="0.01" min="0" value="${item.selling_price_per_unit ?? item.selling_price ?? ''}" placeholder="0.00" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Price unit (e.g. TAB, PACK)</label><input type="text" id="inv-price-unit" value="${v('price_unit')}" placeholder="per unit" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Batch</label><input type="text" id="inv-batch" value="${v('batch_number')}" placeholder="LOT2024001" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Expiry</label><input type="date" id="inv-expiry" value="${item.expiry_date || ''}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>SKU</label><input type="text" id="inv-sku" value="${v('sku')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>NDC</label><input type="text" id="inv-ndc" value="${v('ndc')}" placeholder="e.g. 0006-4898-00" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Barcode</label><input type="text" id="inv-barcode" value="${v('barcode')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Manufacturer</label><input type="text" id="inv-manufacturer" value="${v('manufacturer')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Shelf location</label><input type="text" id="inv-shelf" value="${v('shelf_location')}" placeholder="A1-2" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Warehouse / Site</label><input type="text" id="inv-warehouse" value="${v('warehouse_location')}" placeholder="Main, Branch A" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Registration no.</label><input type="text" id="inv-registration" value="${v('registration_number')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Country of origin</label><input type="text" id="inv-country" value="${v('country_of_origin')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Reorder point</label><input type="number" id="inv-reorder-point" value="${item.reorder_point ?? ''}" min="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Reorder qty</label><input type="number" id="inv-reorder-qty" value="${item.reorder_quantity ?? ''}" min="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Pack size</label><input type="number" id="inv-pack-size" value="${item.pack_size ?? ''}" min="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Lead time (days)</label><input type="number" id="inv-lead-time" value="${item.lead_time_days ?? ''}" min="0" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Unit of purchase</label><input type="text" id="inv-unit-purchase" value="${v('unit_of_purchase')}" placeholder="boxes, bottles" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Storage conditions</label><input type="text" id="inv-storage" value="${v('storage_conditions')}" placeholder="2-8°C" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Controlled substance</label><select id="inv-controlled" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"><option value="">None</option><option value="Schedule II" ${item.controlled_substance === 'Schedule II' ? 'selected' : ''}>Schedule II</option><option value="Schedule III" ${item.controlled_substance === 'Schedule III' ? 'selected' : ''}>Schedule III</option><option value="Schedule IV" ${item.controlled_substance === 'Schedule IV' ? 'selected' : ''}>Schedule IV</option></select></div>
        <div><label>Therapeutic category</label><input type="text" id="inv-category" value="${v('therapeutic_category')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>ATC code</label><input type="text" id="inv-atc" value="${v('atc_code')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div><label>Special handling</label><input type="text" id="inv-special" value="${v('special_handling')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="inv-rx" ${item.prescription_only ? 'checked' : ''}><label for="inv-rx">Prescription only</label></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="inv-cold" ${item.cold_chain ? 'checked' : ''}><label for="inv-cold">Cold chain</label></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="inv-tax" ${item.tax_exempt ? 'checked' : ''}><label for="inv-tax">Tax exempt</label></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:16px;">
        <button type="button" class="btn btn-outline-secondary" id="inv-view-cost-history" style="margin-right:auto;">Cost & receipt history</button>
        <button type="button" class="btn btn-outline-secondary" id="inv-edit-cancel">Cancel</button>
        <button type="button" class="btn btn-primary" id="inv-edit-save">Save</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const num = (id) => { const x = document.getElementById(id)?.value; return x !== '' && !isNaN(parseFloat(x)) ? parseFloat(x) : null; };
  const save = async () => {
    const costVal = document.getElementById('inv-cost')?.value;
    const sellingVal = document.getElementById('inv-selling-price')?.value;
    const priceUnitVal = document.getElementById('inv-price-unit')?.value?.trim() || null;
    const updates = {
      cost_per_unit: costVal !== '' && !isNaN(parseFloat(costVal)) ? parseFloat(costVal) : null,
      selling_price_per_unit: sellingVal !== '' && !isNaN(parseFloat(sellingVal)) ? parseFloat(sellingVal) : null,
      price_unit: priceUnitVal,
      batch_number: document.getElementById('inv-batch')?.value?.trim() || null,
      expiry_date: document.getElementById('inv-expiry')?.value || null,
      sku: document.getElementById('inv-sku')?.value?.trim() || null,
      ndc: document.getElementById('inv-ndc')?.value?.trim() || null,
      barcode: document.getElementById('inv-barcode')?.value?.trim() || null,
      manufacturer: document.getElementById('inv-manufacturer')?.value?.trim() || null,
      shelf_location: document.getElementById('inv-shelf')?.value?.trim() || null,
      warehouse_location: document.getElementById('inv-warehouse')?.value?.trim() || null,
      registration_number: document.getElementById('inv-registration')?.value?.trim() || null,
      country_of_origin: document.getElementById('inv-country')?.value?.trim() || null,
      reorder_point: num('inv-reorder-point'),
      reorder_quantity: num('inv-reorder-qty'),
      pack_size: num('inv-pack-size'),
      lead_time_days: num('inv-lead-time'),
      unit_of_purchase: document.getElementById('inv-unit-purchase')?.value?.trim() || null,
      storage_conditions: document.getElementById('inv-storage')?.value?.trim() || null,
      controlled_substance: document.getElementById('inv-controlled')?.value || null,
      therapeutic_category: document.getElementById('inv-category')?.value?.trim() || null,
      atc_code: document.getElementById('inv-atc')?.value?.trim() || null,
      special_handling: document.getElementById('inv-special')?.value?.trim() || null,
      prescription_only: document.getElementById('inv-rx')?.checked || false,
      cold_chain: document.getElementById('inv-cold')?.checked || false,
      tax_exempt: document.getElementById('inv-tax')?.checked || false
    };
    try {
      if (typeof window.updateInventoryDetails === 'function') {
        await window.updateInventoryDetails(inventoryId, updates);
        modal.remove();
        alert('✅ Inventory updated!');
        loadInventory();
      } else {
        modal.remove();
        alert('Update function not available. Run the migration.');
      }
    } catch (e) {
      alert('Error: ' + (e.message || e));
    }
  };
  modal.querySelector('#inv-edit-save').onclick = save;
  modal.querySelector('#inv-edit-cancel').onclick = () => modal.remove();
  modal.querySelector('#inv-view-cost-history').onclick = () => {
    showInventoryCostHistoryModal(inventoryId, item);
  };
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function costHistoryFieldLabel(field) {
  if (field === 'cost_per_unit') return 'Average cost (WAC)';
  if (field === 'selling_price_per_unit') return 'Selling price';
  if (field === 'price_unit') return 'Price unit';
  return field || ':';
}

async function showInventoryCostHistoryModal(inventoryId, item) {
  const label = [item.medication_name, item.strength, item.form].filter(Boolean).join(' · ');
  const esc = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const currency = typeof window.getDefaultCurrency === 'function' ? window.getDefaultCurrency() : 'CAD';
  const fmtMoney = (v) =>
    v == null || v === ''
      ? ':'
      : typeof window.formatCurrency === 'function'
        ? window.formatCurrency(parseFloat(v), currency)
        : (currency === 'NGN' ? 'NGN ' : '$') + parseFloat(v).toFixed(2);

  const modal = document.createElement('div');
  modal.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;overflow-y:auto;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:8px;max-width:880px;width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.15);">
      <h3 style="margin:0 0 8px 0;color:#008753;">Cost & receipt history</h3>
      <p style="margin:0 0 16px;font-size:14px;color:#36454F;font-weight:600;">${esc(label)}</p>
      <p id="cost-history-status" style="font-size:14px;color:#666;">Loading…</p>
      <div id="cost-history-body" style="display:none;"></div>
      <p id="cost-history-footnote" style="display:none;font-size:12px;color:#666;margin-top:16px;line-height:1.45;">
        Read-only audit. Average cost (WAC) changes are stored per inventory line; purchase rows show receipt unit cost when recorded.
        On-hand layers (FEFO) and receipt-linked unit costs appear in Inventory layers below when the migration is applied.
      </p>
      <div style="margin-top:16px;text-align:right;">
        <button type="button" class="btn btn-secondary" id="cost-history-close">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#cost-history-close').onclick = close;
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };

  const statusEl = modal.querySelector('#cost-history-status');
  const bodyEl = modal.querySelector('#cost-history-body');
  const footEl = modal.querySelector('#cost-history-footnote');

  try {
    if (typeof window.getInventoryCostAuditTrail !== 'function') {
      statusEl.textContent = 'History API not loaded (pharmacy-manager.js).';
      return;
    }
    const trail = await window.getInventoryCostAuditTrail(inventoryId);
    const pe = trail.errors && trail.errors.priceHistory;
    const te = trail.errors && trail.errors.transactions;
    const le = trail.errors && trail.errors.lots;
    const errParts = [];
    if (pe) errParts.push('Price history: ' + (pe.message || pe.code || 'unavailable'));
    if (te) errParts.push('Movements: ' + (te.message || te.code || 'unavailable'));
    if (le) errParts.push('Layers: ' + (le.message || le.code || 'unavailable'));
    if (errParts.length && statusEl) {
      statusEl.textContent = errParts.join(' · ');
    } else if (statusEl) {
      statusEl.style.display = 'none';
    }

    const ph = trail.priceHistory || [];
    const purchases = trail.purchaseTransactions || [];
    const other = trail.otherTransactions || [];
    const invLots = trail.lots || [];

    const phRows = ph
      .map((r) => {
        const oldV =
          r.field_changed === 'price_unit'
            ? r.old_value_text != null
              ? esc(r.old_value_text)
              : ':'
            : fmtMoney(r.old_value);
        const newV =
          r.field_changed === 'price_unit'
            ? r.new_value_text != null
              ? esc(r.new_value_text)
              : ':'
            : fmtMoney(r.new_value);
        return `<tr>
          <td>${r.effective_from ? new Date(r.effective_from).toLocaleString() : ':'}</td>
          <td>${esc(costHistoryFieldLabel(r.field_changed))}</td>
          <td>${oldV}</td>
          <td>${newV}</td>
          <td>${esc(r.changed_by || ':')}</td>
        </tr>`;
      })
      .join('');

    const purRows = purchases
      .map((r) => {
        return `<tr>
          <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ':'}</td>
          <td>${r.quantity != null ? esc(r.quantity) : ':'}</td>
          <td>${r.balance_after != null ? esc(r.balance_after) : ':'}</td>
          <td>${r.unit_cost != null && r.unit_cost !== '' ? fmtMoney(r.unit_cost) : ':'}</td>
          <td>${r.extended_cost != null && r.extended_cost !== '' ? fmtMoney(r.extended_cost) : ':'}</td>
          <td style="max-width:220px;font-size:12px;">${esc(r.notes || r.reason || ':')}</td>
          <td>${esc(r.performed_by_username || ':')}</td>
        </tr>`;
      })
      .join('');

    const othRows = other
      .map((r) => {
        return `<tr>
          <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ':'}</td>
          <td>${esc(r.transaction_type || ':')}</td>
          <td>${r.quantity != null ? esc(r.quantity) : ':'}</td>
          <td>${r.balance_after != null ? esc(r.balance_after) : ':'}</td>
          <td style="max-width:260px;font-size:12px;">${esc(r.notes || r.reason || ':')}</td>
        </tr>`;
      })
      .join('');

    const lotRows = invLots
      .map((r) => {
        return `<tr>
          <td>${r.expiry_date ? esc(r.expiry_date) : ':'}</td>
          <td>${r.received_at ? new Date(r.received_at).toLocaleString() : ':'}</td>
          <td>${r.quantity_on_hand != null ? esc(r.quantity_on_hand) : ':'}</td>
          <td>${r.unit_cost != null && r.unit_cost !== '' ? fmtMoney(r.unit_cost) : ':'}</td>
          <td>${esc(r.batch_number || ':')}</td>
          <td>${esc(r.source || ':')}</td>
          <td style="max-width:200px;font-size:12px;">${esc(r.notes || ':')}</td>
        </tr>`;
      })
      .join('');

    bodyEl.innerHTML = `
      <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 8px;font-size:15px;">Price & average cost changes</h4>
        <p style="font-size:12px;color:#666;margin:0 0 8px;">Each row is an effective-dated change (manual edit, bulk import WAC, restock, etc.).</p>
        <div style="overflow-x:auto;">
          <table class="inventory-table" style="font-size:13px;width:100%;">
            <thead><tr><th>Effective</th><th>Field</th><th>Old</th><th>New</th><th>By</th></tr></thead>
            <tbody>${phRows || '<tr><td colspan="5">No price history rows yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 8px;font-size:15px;">Purchase receipts (stock increases)</h4>
        <div style="overflow-x:auto;">
          <table class="inventory-table" style="font-size:13px;width:100%;">
            <thead><tr><th>Date</th><th>Qty in</th><th>Balance after</th><th>Unit cost</th><th>Extended</th><th>Notes</th><th>By</th></tr></thead>
            <tbody>${purRows || '<tr><td colspan="7">No purchase transactions yet.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 8px;font-size:15px;">Inventory layers (FEFO / on hand)</h4>
        <p style="font-size:12px;color:#666;margin:0 0 8px;">Each row is a receipt or opening layer. Dispensing consumes earliest expiry first, then oldest receipt.</p>
        <div style="overflow-x:auto;">
          <table class="inventory-table" style="font-size:13px;width:100%;">
            <thead><tr><th>Expiry</th><th>Received</th><th>Qty on hand</th><th>Unit cost</th><th>Batch</th><th>Source</th><th>Notes</th></tr></thead>
            <tbody>${lotRows || '<tr><td colspan="7">No inventory layers yet (run lot migration or add stock).</td></tr>'}</tbody>
          </table>
        </div>
      </div>
      <div>
        <h4 style="margin:0 0 8px;font-size:15px;">Other movements</h4>
        <p style="font-size:12px;color:#666;margin:0 0 8px;">Dispensing, adjustments, and transfers. Dispense rows include average COGS when recorded.</p>
        <div style="overflow-x:auto;">
          <table class="inventory-table" style="font-size:13px;width:100%;">
            <thead><tr><th>Date</th><th>Type</th><th>Qty</th><th>Balance after</th><th>Notes</th></tr></thead>
            <tbody>${othRows || '<tr><td colspan="5">None.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;
    bodyEl.style.display = 'block';
    footEl.style.display = 'block';
  } catch (e) {
    statusEl.textContent = 'Error: ' + (e.message || e);
    statusEl.style.color = '#c62828';
  }
}

// Medication database management
let medicationDatabase = [];
let customMedications = [];

// Load medication database from prescriptions.js and custom medications
function loadMedicationDatabase() {
  // Get DRUG_DATABASE from prescriptions.js if available
  if (typeof DRUG_DATABASE !== 'undefined') {
    medicationDatabase = [...DRUG_DATABASE];
  } else {
    // Fallback: try to load from script tag
    try {
      const script = document.createElement('script');
      script.src = 'js/prescriptions.js';
      script.onload = () => {
        if (typeof DRUG_DATABASE !== 'undefined') {
          medicationDatabase = [...DRUG_DATABASE];
        }
      };
    } catch (e) {
      console.warn('Could not load DRUG_DATABASE:', e);
    }
  }
  
  // Load custom medications from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const orgKey = user.org ? `${user.org}_custom_medications` : 'custom_medications';
  const stored = localStorage.getItem(orgKey);
  if (stored) {
    try {
      customMedications = JSON.parse(stored);
    } catch (e) {
      console.warn('Could not parse custom medications:', e);
      customMedications = [];
    }
  }
  
  return [...medicationDatabase, ...customMedications];
}

// Save custom medication
function saveCustomMedication(medication) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const orgKey = user.org ? `${user.org}_custom_medications` : 'custom_medications';
  
  // Check if already exists
  const toKey = (d) => `${(d.name||'').trim().toLowerCase()}|${(d.form||'').trim().toLowerCase()}|${(d.strength||'').trim().toLowerCase()}`;
  const medKey = toKey(medication);
  
  const exists = customMedications.some(m => toKey(m) === medKey);
  if (!exists) {
    customMedications.push(medication);
    localStorage.setItem(orgKey, JSON.stringify(customMedications));
  }
}

// Get all medications (database + custom)
function getAllMedications() {
  return loadMedicationDatabase();
}

// Load import opening stock form
function loadImportStockForm() {
  const container = document.getElementById('import-stock-form');
  if (!container) return;
  container.innerHTML = `
    <div class="prescription-card">
      <h2>Import Opening Stock</h2>
      <p style="margin-bottom: 12px; color: #555;">Paste CSV or upload <strong>.csv / .xlsx</strong>. Use <strong>Medication Name</strong> (generic), optional <strong>Brand Name</strong> / <strong>Manufacturer</strong>, <strong>Count per Card</strong> (pack size), and dates as <strong>M/D/YYYY</strong> or ISO. <a href="data/pharmacy-bulk-upload-template-updated.csv" download="pharmacy-bulk-upload-template.csv" style="color: var(--adire-blue);">CSV template</a> · <a href="data/PHARMACY-INVENTORY-IMPORT-GUIDE.md" target="_blank" style="color: var(--adire-blue);">Import guide</a></p>
      <p style="margin-bottom: 12px; padding: 10px; background: #f8f9fa; border-radius: 6px; font-size: 13px;"><strong>Note:</strong> Inventory is <em>per organization</em>. If you see fewer items than expected, you may be viewing a different org, or the import was done under another user/org. Re-import here to add items for your current org.</p>
      <div style="margin-bottom: 12px;">
        <label>CSV / Excel (paste CSV here, or choose a file)</label>
        <textarea id="import-csv-text" rows="10" placeholder="Paste CSV here, or upload .csv / .xlsx (first sheet, row 1 = headers). Example:
Medication Name,Strength,Form,Quantity on Hand,Unit of Measure,Expiry Date,Selling Price per Unit,Cost per Unit,Unit for Pricing,Batch Number,Brand Name,Manufacturer Name,Count per Card
Amlodipine,10mg,Tablet,16,PACKS,2027-06-01,1500,333,PACK,,Eden,Genesis Pharma,14" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 12px;"></textarea>
        <input type="file" id="import-csv-file" accept=".csv,.txt,.xlsx,.xls" style="margin-top: 8px;">
      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 8px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px;">
          <input type="checkbox" id="import-update-existing" style="width: 16px; height: 16px;">
          <span>Update existing items (cost, selling price, stock)</span>
        </label>
      </div>
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <button type="button" class="btn btn-primary" id="btn-import-stock">Import</button>
        <button type="button" class="btn btn-success" id="btn-import-predefined" title="Import from pharmacy-opening-stock-ehr-format.csv">Import predefined stock</button>
      </div>
      <div id="import-progress-area" style="margin-top: 12px; display: none;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
          <div id="import-progress-bar" style="flex: 1; height: 10px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
            <div id="import-progress-fill" style="height: 100%; width: 0%; background: linear-gradient(90deg, var(--primary-green), var(--adire-blue)); transition: width 0.15s ease-out;"></div>
          </div>
          <span id="import-progress-text" style="font-size: 13px; font-weight: 600; min-width: 200px; max-width: 42%; text-align: right; line-height: 1.3;"></span>
        </div>
        <div id="import-progress-detail" style="font-size: 12px; color: #555; line-height: 1.4; min-height: 1.2em;"></div>
      </div>
      <div id="import-result" style="margin-top: 8px; font-size: 14px; padding: 10px; border-radius: 6px; display: none;"></div>
    </div>
  `;
  document.getElementById('import-csv-file').onchange = function(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const ta = document.getElementById('import-csv-text');
    const name = (f.name || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const r = new FileReader();
      r.onload = () => {
        try {
          const parsed = typeof window.parsePharmacyInventoryExcelBuffer === 'function'
            ? window.parsePharmacyInventoryExcelBuffer(r.result)
            : [];
          ta.dataset.excelParsed = JSON.stringify(parsed);
          ta.value = parsed.length
            ? '[Excel loaded: ' + parsed.length + ' row(s). Click Import to upload to inventory.]'
            : '[Excel file had no parseable rows. Check the first sheet and header row.]';
        } catch (err) {
          delete ta.dataset.excelParsed;
          ta.value = '[Excel error: ' + (err.message || err) + ']';
        }
      };
      r.readAsArrayBuffer(f);
      return;
    }
    delete ta.dataset.excelParsed;
    const rt = new FileReader();
    rt.onload = () => { ta.value = rt.result || ''; };
    rt.readAsText(f);
  };
  document.getElementById('import-csv-text').addEventListener('input', function() {
    delete this.dataset.excelParsed;
  });
   function runImport(parsed, buttons) {
    const progressArea = document.getElementById('import-progress-area');
    const progressFill = document.getElementById('import-progress-fill');
    const progressText = document.getElementById('import-progress-text');
    const progressDetail = document.getElementById('import-progress-detail');
    const resultEl = document.getElementById('import-result');
    progressArea.style.display = 'block';
    if (progressDetail) progressDetail.textContent = '';
    resultEl.style.display = 'none';
    buttons.forEach(b => { b.disabled = true; });
    function formatEta(sec) {
      if (sec == null || sec <= 0 || !isFinite(sec)) return '';
      if (sec < 120) return ' · ~' + Math.max(1, Math.round(sec)) + 's left';
      const m = Math.floor(sec / 60);
      const s = Math.round(sec % 60);
      return ' · ~' + m + 'm ' + s + 's left';
    }
    const onProgress = (ev) => {
      if (typeof ev === 'string') return;
      if (ev.phase === 'preparing') {
        progressFill.style.width = '6%';
        progressText.textContent =
          (ev.phaseLabel || 'Preparing…') + (ev.rowsInFile != null ? ' · ' + ev.rowsInFile + ' rows in file' : '');
        if (progressDetail) progressDetail.textContent = '';
        return;
      }
      const workDone = ev.workDone != null ? ev.workDone : 0;
      const workTotal = Math.max(1, ev.workTotal || 1);
      const pct = ev.phase === 'done' ? 100 : Math.min(99, Math.round((workDone / workTotal) * 100));
      const eta = formatEta(ev.etaSeconds);
      let label = ev.phaseLabel || ev.phase || '';
      if (ev.phase === 'done') {
        label = 'Completed';
        progressFill.style.width = '100%';
      } else {
        progressFill.style.width = pct + '%';
      }
      progressText.textContent = label + ' · step ' + workDone + '/' + workTotal + eta;
      if (progressDetail) {
        progressDetail.textContent = ev.subLabel || '';
      }
    };
    const replaceExisting = document.getElementById('import-update-existing')?.checked ?? false;
    return window.importPharmacyOpeningStock(parsed, { onProgress, replaceExisting }).then(r => {
      progressFill.style.width = '100%';
      progressText.textContent = 'Completed · ' + (r.imported + r.updated + r.skipped) + ' rows accounted for';
      if (progressDetail) progressDetail.textContent = r.errors && r.errors.length ? r.errors.length + ' row errors (see console)' : '';
      resultEl.style.display = 'block';
      resultEl.style.background = 'linear-gradient(135deg, rgba(0,135,83,0.12), rgba(0,107,66,0.08))';
      resultEl.style.borderLeft = '4px solid var(--primary-green)';
      resultEl.style.color = '#155724';
      resultEl.style.fontWeight = '600';
      resultEl.textContent = `Import complete: ${r.imported} imported, ${r.updated} updated, ${r.skipped} skipped${r.errors?.length ? '. ' + r.errors.length + ' errors (see console)' : ''}`;
      if (r.errors?.length) console.warn('Import errors:', r.errors);
      loadInventory();
      loadDashboard();
      return r;
    }).catch(err => {
      resultEl.style.display = 'block';
      resultEl.style.background = 'rgba(220,53,69,0.1)';
      resultEl.style.borderLeft = '4px solid #dc3545';
      resultEl.style.color = '#721c24';
      resultEl.textContent = 'Error: ' + (err.message || err);
      throw err;
    }).finally(() => {
      buttons.forEach(b => { b.disabled = false; });
      setTimeout(() => { progressArea.style.display = 'none'; }, 2000);
    });
  }

  document.getElementById('btn-import-predefined').onclick = async function() {
    const resultEl = document.getElementById('import-result');
    resultEl.style.display = 'block';
    resultEl.style.background = '#f8f9fa';
    resultEl.style.borderLeft = '4px solid var(--adire-blue)';
    resultEl.textContent = 'Fetching pharmacy-opening-stock-ehr-format.csv…';
    const btnImport = document.getElementById('btn-import-stock');
    const btnPredef = document.getElementById('btn-import-predefined');
    try {
      const res = await fetch('data/pharmacy-opening-stock-ehr-format.csv');
      if (!res.ok) throw new Error('Could not fetch CSV file');
      const text = await res.text();
      const parsed = typeof window.parsePharmacyInventoryCSV === 'function' ? window.parsePharmacyInventoryCSV(text) : [];
      if (parsed.length === 0) { resultEl.textContent = 'No valid rows in CSV.'; return; }
      await runImport(parsed, [btnImport, btnPredef]);
    } catch (err) {
      resultEl.style.display = 'block';
      resultEl.style.background = 'rgba(220,53,69,0.1)';
      resultEl.style.borderLeft = '4px solid #dc3545';
      resultEl.textContent = 'Error: ' + (err.message || err);
      btnImport.disabled = false;
      btnPredef.disabled = false;
    }
  };
  document.getElementById('btn-import-stock').onclick = async function() {
    const ta = document.getElementById('import-csv-text');
    const text = (ta.value || '').trim();
    let parsed = [];
    if (ta.dataset.excelParsed) {
      try { parsed = JSON.parse(ta.dataset.excelParsed); } catch (_) { parsed = []; }
    }
    if (!parsed || !parsed.length) {
      if (!text) { alert('Paste or upload CSV / Excel first.'); return; }
      parsed = typeof window.parsePharmacyInventoryCSV === 'function' ? window.parsePharmacyInventoryCSV(text) : [];
    }
    const resultEl = document.getElementById('import-result');
    resultEl.style.display = 'block';
    resultEl.style.background = '#f8f9fa';
    resultEl.style.borderLeft = '4px solid var(--adire-blue)';
    resultEl.textContent = 'Preparing import…';
    const btnImport = document.getElementById('btn-import-stock');
    const btnPredef = document.getElementById('btn-import-predefined');
    try {
      if (parsed.length === 0) { resultEl.textContent = 'No valid rows found.'; return; }
      await runImport(parsed, [btnImport, btnPredef]);
    } catch (err) {
      resultEl.style.display = 'block';
      resultEl.style.background = 'rgba(220,53,69,0.1)';
      resultEl.style.borderLeft = '4px solid #dc3545';
      resultEl.textContent = 'Error: ' + (err.message || err);
      btnImport.disabled = false;
      btnPredef.disabled = false;
    }
  };
}

// Load pharmacist prescribe form (OTC / non-addictive only; same workflow: approval → payment → dispense)
function loadPharmacistPrescribeForm() {
  const container = document.getElementById('pharmacist-prescribe-form');
  if (!container) return;
  const prescribable = typeof window.getPharmacistPrescribableMedications === 'function' ? window.getPharmacistPrescribableMedications() : [];
  const medOptions = prescribable.map(d => {
    const name = (d.name || '').replace(/'/g, "\\'");
    const strength = (d.strength || '').split(',')[0].trim();
    const form = d.form || 'Tablet';
    return `<option value="${name}" data-strength="${strength}" data-form="${form}">${d.name} (${d.category || ''})</option>`;
  }).join('');
  container.innerHTML = `
    <div class="prescription-card">
      <h2>📝 Pharmacist Prescribe (OTC / Non-Addictive Only)</h2>
      <p style="margin-bottom: 16px; color: #555;">Prescribe OTC or non-addictive medications. Same workflow: prescription → approval → invoice → payment → dispense. <strong>Audit trail:</strong> prescriber_type=pharmacist.</p>
      <form id="pharmacist-prescribe-form-element">
        <div style="margin-bottom: 16px; position: relative;">
          <label>Patient *</label>
          <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
            <input type="text" id="pharm-prescribe-patient-search" placeholder="Click to show list · Search by name, ID, or DOB" style="flex: 1 1 auto; min-width: 0; width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;" autocomplete="off">
            <button type="button" id="pharm-prescribe-patient-search-btn" class="btn btn-outline-secondary" style="flex: 0 0 auto; padding: 8px 12px; font-size: 14px; white-space: nowrap;">Search</button>
          </div>
          <div id="pharm-prescribe-patient-results" style="position: absolute; left: 0; right: 0; top: 100%; margin-top: 4px; max-height: 220px; overflow-y: auto; background: white; border: 1px solid #ccc; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; display: none;"></div>
          <input type="hidden" id="pharm-prescribe-patient-id">
          <div id="pharm-prescribe-patient-selected" style="margin-top: 8px; padding: 8px; background: #f0f9f4; border-radius: 4px; display: none;"></div>
        </div>
        <div style="margin-bottom: 16px;">
          <label>Diagnosis / Reason</label>
          <input type="text" id="pharm-prescribe-diagnosis" placeholder="e.g. Mild pain, Heartburn" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 16px;">
          <label>Medications *</label>
          <div id="pharm-prescribe-meds-list">
            <div class="pharm-prescribe-med-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 80px; gap: 8px; align-items: end; margin-bottom: 8px;">
              <div>
                <label style="font-size: 12px;">Medication</label>
                <select class="pharm-med-select" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"><option value="">Select...</option>${medOptions}</select>
              </div>
              <div><label style="font-size: 12px;">Strength</label><input type="text" class="pharm-med-strength" placeholder="e.g. 500mg" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label style="font-size: 12px;">Form</label><input type="text" class="pharm-med-form" placeholder="Tablet" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label style="font-size: 12px;">Qty</label><input type="number" class="pharm-med-qty" value="1" min="1" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><button type="button" class="btn btn-outline-danger pharm-med-remove" style="padding: 8px;">✕</button></div>
            </div>
          </div>
          <button type="button" id="pharm-prescribe-add-med" class="btn btn-outline-secondary" style="margin-top: 8px;">+ Add medication</button>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button type="submit" class="btn btn-primary">Create Prescription</button>
          <span id="pharm-prescribe-result" style="font-size: 13px; color: #666;"></span>
        </div>
      </form>
    </div>
  `;
  const templateRow = document.querySelector('.pharm-prescribe-med-row');
  document.getElementById('pharm-prescribe-add-med').onclick = function() {
    const list = document.getElementById('pharm-prescribe-meds-list');
    const clone = templateRow.cloneNode(true);
    clone.querySelectorAll('input, select').forEach(el => { el.value = el.type === 'number' ? '1' : ''; });
    list.appendChild(clone);
  };
  document.getElementById('pharmacist-prescribe-form-element').addEventListener('submit', async function(e) {
    e.preventDefault();
    const patientId = document.getElementById('pharm-prescribe-patient-id').value;
    const patientName = document.getElementById('pharm-prescribe-patient-selected').textContent.replace(/^Selected:\s*/, '').trim();
    if (!patientId) { alert('Please select a patient.'); return; }
    const rows = document.querySelectorAll('.pharm-prescribe-med-row');
    const medications = [];
    for (const row of rows) {
      const sel = row.querySelector('.pharm-med-select');
      const name = sel?.value?.trim();
      if (!name) continue;
      const strength = row.querySelector('.pharm-med-strength')?.value?.trim() || (sel?.options[sel.selectedIndex]?.dataset?.strength || '');
      const form = row.querySelector('.pharm-med-form')?.value?.trim() || (sel?.options[sel.selectedIndex]?.dataset?.form || 'Tablet');
      const qty = parseInt(row.querySelector('.pharm-med-qty')?.value, 10) || 1;
      medications.push({ name, strength, form, quantity: qty, directions: 'As directed' });
    }
    if (medications.length === 0) { alert('Add at least one medication.'); return; }
    const resultEl = document.getElementById('pharm-prescribe-result');
    resultEl.textContent = 'Creating…';
    try {
      const data = await window.createPrescriptionFromPharmacist({
        patientId,
        patientName,
        medications,
        diagnosis: document.getElementById('pharm-prescribe-diagnosis').value.trim() || 'Pharmacist-prescribed (OTC/non-addictive)'
      });
      resultEl.textContent = 'Prescription created. It appears in Incoming. Same workflow: Approve → Invoice → Payment → Dispense.';
      document.getElementById('pharmacist-prescribe-form-element').reset();
      document.getElementById('pharm-prescribe-patient-id').value = '';
      document.getElementById('pharm-prescribe-patient-selected').style.display = 'none';
      document.getElementById('pharm-prescribe-patient-selected').textContent = '';
      loadDashboard();
      switchTab('incoming', null);
    } catch (err) {
      resultEl.textContent = 'Error: ' + (err.message || err);
    }
  });
  document.getElementById('pharm-prescribe-meds-list').addEventListener('click', function(e) {
    const btn = e.target.closest('.pharm-med-remove');
    if (btn) {
      const row = btn.closest('.pharm-prescribe-med-row');
      const list = document.getElementById('pharm-prescribe-meds-list');
      if (row && list && list.children.length > 1) row.remove();
    }
  });
  document.getElementById('pharmacist-prescribe-form-element').addEventListener('change', function(e) {
    if (e.target.classList.contains('pharm-med-select')) {
      const opt = e.target.options[e.target.selectedIndex];
      const row = e.target.closest('.pharm-prescribe-med-row');
      if (row && opt?.dataset?.strength) row.querySelector('.pharm-med-strength').value = opt.dataset.strength;
      if (row && opt?.dataset?.form) row.querySelector('.pharm-med-form').value = opt.dataset.form;
    }
  });
  async function searchPatients(q) {
    const resultsEl = document.getElementById('pharm-prescribe-patient-results');
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="padding: 12px; color: #666;">Loading…</div>';
    try {
      const supabase = await window.getPharmacySupabaseClient();
      const orgId = await window.getPharmacyOrgId();
      let query = supabase.from('patients').select('id, patient_id, first_name, last_name, date_of_birth')
        .eq('organization_id', orgId)
        .limit(50);
      if (q && q.trim()) {
        const qEsc = q.trim().replace(/'/g, "''");
        query = query.or(`patient_id.ilike.%${qEsc}%,first_name.ilike.%${qEsc}%,last_name.ilike.%${qEsc}%,date_of_birth.ilike.%${qEsc}%`);
      } else {
        query = query.order('last_name', { ascending: true });
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) { resultsEl.innerHTML = '<div style="padding: 12px; color: #666;">No patients found. Try a different search.</div>'; return; }
      resultsEl.innerHTML = data.map(p => {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ');
        const dob = p.date_of_birth ? (typeof p.date_of_birth === 'string' ? p.date_of_birth.substring(0, 10) : String(p.date_of_birth).substring(0, 10)) : '';
        const displayId = (typeof window.getPatientIdentifier === 'function' ? window.getPatientIdentifier(p) : null) || p.patient_id || (p.id && !String(p.id).includes('-') ? p.id : '') || ':';
        const label = name + ' (' + displayId + ')' + (dob ? ' · DOB: ' + dob : '');
        const labelEsc = label.replace(/"/g, '&quot;');
        return `<div class="pharm-patient-option" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" data-id="${p.id}" data-name="${labelEsc}">${label}</div>`;
      }).join('');
      resultsEl.querySelectorAll('.pharm-patient-option').forEach(div => {
        div.onmouseover = function() { this.style.background = '#f0f9f4'; };
        div.onmouseout = function() { this.style.background = 'white'; };
        div.onclick = function() {
          document.getElementById('pharm-prescribe-patient-id').value = this.dataset.id;
          document.getElementById('pharm-prescribe-patient-selected').textContent = 'Selected: ' + this.dataset.name;
          document.getElementById('pharm-prescribe-patient-selected').style.display = 'block';
          document.getElementById('pharm-prescribe-patient-search').value = '';
          resultsEl.style.display = 'none';
        };
      });
    } catch (err) {
      resultsEl.innerHTML = '<div style="padding: 12px; color: #c00;">Error: ' + (err.message || err) + '</div>';
    }
  }

  let searchDebounce = null;
  const searchInput = document.getElementById('pharm-prescribe-patient-search');
  const resultsEl = document.getElementById('pharm-prescribe-patient-results');

  function showPatientDropdown() {
    searchPatients(searchInput.value.trim());
  }
  searchInput.addEventListener('focus', showPatientDropdown);
  searchInput.addEventListener('click', showPatientDropdown);

  searchInput.addEventListener('input', function() {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => searchPatients(searchInput.value.trim()), 200);
  });

  document.getElementById('pharm-prescribe-patient-search-btn').onclick = function() {
    searchPatients(searchInput.value.trim());
  };

  document.addEventListener('click', function(e) {
    if (!e.target.closest('#pharm-prescribe-patient-search') && !e.target.closest('#pharm-prescribe-patient-results') && !e.target.closest('#pharm-prescribe-patient-search-btn')) {
      resultsEl.style.display = 'none';
    }
  });
}

// Load add medication form (optionally with prefill: { name, strength, form })
function loadAddMedicationForm(prefill) {
  const container = document.getElementById('add-medication-form');
  
  // Load medication database
  const allMeds = getAllMedications();
  
  container.innerHTML = `
    <div class="prescription-card">
      <h2>Add New Medication to Inventory</h2>
      <form id="add-medication-form-element" onsubmit="handleAddMedication(event)">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label>Medication Name *</label>
            <div style="position: relative;">
              <input type="text" id="med-name" list="medication-list" autocomplete="off" required 
                     style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"
                     placeholder="Type or select medication..."
                     onfocus="showMedicationDropdown()"
                     oninput="filterMedications(this.value)"
                     onclick="showMedicationDropdown()">
              <datalist id="medication-list"></datalist>
              <div id="medication-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; max-height: 300px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
            </div>
            <button type="button" onclick="showAddCustomMedicationModal()" style="margin-top: 5px; padding: 5px 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
              ➕ Add New Medication
            </button>
          </div>
          <div>
            <label>Generic Name</label>
            <input type="text" id="med-generic" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"
                   onfocus="showGenericSuggestions()"
                   onclick="showGenericSuggestions()">
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label>Strength *</label>
            <div style="position: relative;">
              <input type="text" id="med-strength" list="strength-list" autocomplete="off" required 
                     style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"
                     placeholder="Select or type strength..."
                     onfocus="showStrengthDropdown()"
                     onclick="showStrengthDropdown()">
              <datalist id="strength-list"></datalist>
              <div id="strength-dropdown" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #ccc; border-radius: 4px; max-height: 200px; overflow-y: auto; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
            </div>
          </div>
          <div>
            <label>Form *</label>
            <select id="med-form" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;"
                    onfocus="showFormSuggestions()"
                    onclick="showFormSuggestions()">
              <option value="">Select...</option>
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="injection">Injection</option>
              <option value="cream">Cream</option>
              <option value="ointment">Ointment</option>
              <option value="drops">Drops</option>
              <option value="inhaler">Inhaler</option>
            </select>
          </div>
          <div>
            <label>Route</label>
            <select id="med-route" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="oral">Oral</option>
              <option value="topical">Topical</option>
              <option value="IV">IV</option>
              <option value="IM">IM</option>
              <option value="subcutaneous">Subcutaneous</option>
            </select>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label>Initial Stock *</label>
            <input type="number" id="med-initial-stock" min="0" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label>Minimum Stock</label>
            <input type="number" id="med-min-stock" value="10" min="0" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label>Maximum Stock</label>
            <input type="number" id="med-max-stock" value="1000" min="0" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label>Cost per Unit</label>
            <input type="number" id="med-cost" step="0.01" min="0" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label>Selling Price per Unit</label>
            <input type="number" id="med-price" step="0.01" min="0" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
          <div>
            <label>Batch / Lot number</label>
            <input type="text" id="med-batch" placeholder="e.g. LOT2024001" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          <div>
            <label>Expiry date</label>
            <input type="date" id="med-expiry" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
        </div>
        
        <details style="margin-bottom: 15px; border: 1px solid #ddd; border-radius: 4px; padding: 12px;">
          <summary style="cursor: pointer; font-weight: 600;">Optional details (regulatory, supply chain, storage)</summary>
          <div style="margin-top: 15px; display: grid; gap: 15px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>Registration no.</label><input type="text" id="med-registration" placeholder="NAFDAC/FDA" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Manufacturer</label><input type="text" id="med-manufacturer" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Country of origin</label><input type="text" id="med-country" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>SKU / Product code</label><input type="text" id="med-sku" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>NDC</label><input type="text" id="med-ndc" placeholder="e.g. 0006-4898-00" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Barcode</label><input type="text" id="med-barcode" placeholder="Scan or type" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>Shelf location</label><input type="text" id="med-shelf" placeholder="e.g. A1-2" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Warehouse / Site</label><input type="text" id="med-warehouse" placeholder="Main, Branch A" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>Reorder point</label><input type="number" id="med-reorder-point" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Reorder quantity</label><input type="number" id="med-reorder-qty" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Pack size</label><input type="number" id="med-pack-size" min="0" placeholder="Units per pack" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>Unit of purchase</label><input type="text" id="med-unit-purchase" placeholder="e.g. boxes, bottles" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Lead time (days)</label><input type="number" id="med-lead-time" min="0" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Therapeutic category</label><input type="text" id="med-category" placeholder="e.g. antibiotic" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div><label>ATC code</label><input type="text" id="med-atc" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Storage conditions</label><input type="text" id="med-storage" placeholder="e.g. 2-8°C" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"></div>
              <div><label>Controlled substance</label><select id="med-controlled" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;"><option value="">None</option><option value="Schedule II">Schedule II</option><option value="Schedule III">Schedule III</option><option value="Schedule IV">Schedule IV</option></select></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
              <div style="display:flex;align-items:center;gap:8px;margin-top:20px;"><input type="checkbox" id="med-prescription-only"><label for="med-prescription-only">Prescription only (Rx)</label></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:20px;"><input type="checkbox" id="med-cold-chain"><label for="med-cold-chain">Cold chain</label></div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:20px;"><input type="checkbox" id="med-tax-exempt"><label for="med-tax-exempt">Tax exempt</label></div>
            </div>
            <div>
              <label>Special handling</label>
              <input type="text" id="med-special-handling" placeholder="e.g. hazardous, light-sensitive" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            </div>
          </div>
        </details>
        
        <button type="submit" class="btn btn-success" style="width: 100%; margin-top: 20px;">
          ➕ Add Medication to Inventory
        </button>
      </form>
    </div>
  `;
  
  if (prefill && (prefill.name || prefill.strength || prefill.form)) {
    const nameEl = document.getElementById('med-name');
    const genericEl = document.getElementById('med-generic');
    const strengthEl = document.getElementById('med-strength');
    const formEl = document.getElementById('med-form');
    if (nameEl) nameEl.value = prefill.name || '';
    if (genericEl) genericEl.value = prefill.name || '';
    if (strengthEl) strengthEl.value = prefill.strength || '';
    if (formEl && prefill.form) {
      const formLower = (prefill.form || '').toLowerCase();
      const opts = Array.from(formEl.options);
      const match = opts.find(o => (o.value || '').toLowerCase() === formLower || (o.text || '').toLowerCase() === formLower);
      if (match) formEl.value = match.value;
      else { const o = document.createElement('option'); o.value = formLower; o.textContent = prefill.form; formEl.appendChild(o); formEl.value = formLower; }
    }
  }
}

// Show medication dropdown
window.showMedicationDropdown = function() {
  const dropdown = document.getElementById('medication-dropdown');
  const input = document.getElementById('med-name');
  if (!dropdown || !input) return;

  const filter = (input.value || '').trim();
  const filterLower = filter.toLowerCase();
  let filtered = [];

  if (filterLower.length >= 2 &&
      typeof window.searchCanadianDrugs === 'function' &&
      typeof window.isCanadianFormularyReady === 'function' &&
      window.isCanadianFormularyReady()) {
    filtered = window.searchCanadianDrugs(filter, 50);
  } else {
    const allMeds = getAllMedications();
    filtered = allMeds.filter((m) =>
      (m.name || '').toLowerCase().includes(filterLower) ||
      (m.generic && m.generic.toLowerCase().includes(filterLower))
    );
  }
  
  dropdown.innerHTML = filtered.slice(0, 50).map(med => {
    const displayName = `${med.name}${med.generic && med.generic !== med.name ? ` (${med.generic})` : ''}`;
    return `<div class="dropdown-item" onclick="selectMedication('${med.name.replace(/'/g, "\\'")}', '${(med.generic || '').replace(/'/g, "\\'")}', '${(med.strength || '').replace(/'/g, "\\'")}', '${(med.form || '').replace(/'/g, "\\'")}')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">${displayName}</div>`;
  }).join('');
  
  if (filtered.length === 0 && input.value.trim()) {
    dropdown.innerHTML = `<div style="padding: 10px; color: #666;">No matches found. Click "Add New Medication" to create one.</div>`;
  }
  
  dropdown.style.display = filtered.length > 0 || input.value.trim() ? 'block' : 'none';
};

// Filter medications as user types
window.filterMedications = function(value) {
  showMedicationDropdown();
};

// Select medication from dropdown
window.selectMedication = function(name, generic, strength, form) {
  document.getElementById('med-name').value = name;
  document.getElementById('med-generic').value = generic || name;
  
  // Parse strength options (comma-separated)
  const strengths = strength ? strength.split(',').map(s => s.trim()) : [];
  const strengthInput = document.getElementById('med-strength');
  const strengthDropdown = document.getElementById('strength-dropdown');
  
  if (strengths.length > 0) {
    strengthDropdown.innerHTML = strengths.map(s => 
      `<div class="dropdown-item" onclick="document.getElementById('med-strength').value='${s.replace(/'/g, "\\'")}'; document.getElementById('strength-dropdown').style.display='none';" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">${s}</div>`
    ).join('');
    strengthInput.placeholder = `Select from: ${strengths.join(', ')}`;
  }
  
  // Set form
  const formSelect = document.getElementById('med-form');
  if (form && formSelect) {
    const formLower = form.toLowerCase();
    const options = Array.from(formSelect.options);
    const matchingOption = options.find(opt => opt.value.toLowerCase() === formLower || opt.text.toLowerCase() === formLower);
    if (matchingOption) {
      formSelect.value = matchingOption.value;
    } else {
      // Add new form option if not in list
      const newOption = document.createElement('option');
      newOption.value = formLower;
      newOption.textContent = form;
      formSelect.appendChild(newOption);
      formSelect.value = formLower;
    }
  }
  
  document.getElementById('medication-dropdown').style.display = 'none';
};

// Show strength dropdown
window.showStrengthDropdown = function() {
  const dropdown = document.getElementById('strength-dropdown');
  const input = document.getElementById('med-strength');
  const medName = document.getElementById('med-name').value;
  
  if (!dropdown || !input) return;
  
  const allMeds = getAllMedications();
  const selectedMed = allMeds.find(m => m.name.toLowerCase() === medName.toLowerCase());
  
  if (selectedMed && selectedMed.strength) {
    const strengths = selectedMed.strength.split(',').map(s => s.trim());
    dropdown.innerHTML = strengths.map(s => 
      `<div class="dropdown-item" onclick="document.getElementById('med-strength').value='${s.replace(/'/g, "\\'")}'; document.getElementById('strength-dropdown').style.display='none';" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">${s}</div>`
    ).join('');
    dropdown.style.display = 'block';
  } else {
    // Show all unique strengths from database
    const allStrengths = new Set();
    allMeds.forEach(m => {
      if (m.strength) {
        m.strength.split(',').forEach(s => allStrengths.add(s.trim()));
      }
    });
    
    const filter = input.value.toLowerCase();
    const filtered = Array.from(allStrengths).filter(s => s.toLowerCase().includes(filter));
    
    dropdown.innerHTML = filtered.slice(0, 30).map(s => 
      `<div class="dropdown-item" onclick="document.getElementById('med-strength').value='${s.replace(/'/g, "\\'")}'; document.getElementById('strength-dropdown').style.display='none';" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='white'">${s}</div>`
    ).join('');
    dropdown.style.display = filtered.length > 0 ? 'block' : 'none';
  }
};

// Show generic suggestions
window.showGenericSuggestions = function() {
  const input = document.getElementById('med-generic');
  const medName = document.getElementById('med-name').value;
  
  if (medName && !input.value) {
    const allMeds = getAllMedications();
    const selectedMed = allMeds.find(m => m.name.toLowerCase() === medName.toLowerCase());
    if (selectedMed && selectedMed.generic) {
      input.value = selectedMed.generic;
    }
  }
};

// Show form suggestions
window.showFormSuggestions = function() {
  // Form is already a dropdown, no action needed
};

// Show add custom medication modal
window.showAddCustomMedicationModal = function() {
  const modal = document.createElement('div');
  modal.id = 'custom-med-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center;';
  modal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
      <h2 style="margin: 0 0 20px 0;">Add New Medication</h2>
      <form id="custom-med-form" onsubmit="saveNewCustomMedication(event)">
        <div style="margin-bottom: 15px;">
          <label>Medication Name *</label>
          <input type="text" id="custom-med-name" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label>Generic Name *</label>
          <input type="text" id="custom-med-generic" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label>Strength * (comma-separated, e.g., 5mg, 10mg, 20mg)</label>
          <input type="text" id="custom-med-strength" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label>Form *</label>
          <select id="custom-med-form" required style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="">Select...</option>
            <option value="tablet">Tablet</option>
            <option value="capsule">Capsule</option>
            <option value="syrup">Syrup</option>
            <option value="injection">Injection</option>
            <option value="cream">Cream</option>
            <option value="ointment">Ointment</option>
            <option value="drops">Drops</option>
            <option value="inhaler">Inhaler</option>
          </select>
        </div>
        <div style="margin-bottom: 15px;">
          <label>Category</label>
          <input type="text" id="custom-med-category" placeholder="e.g., Antibiotic, Analgesic" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;">
        </div>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button type="submit" style="flex: 1; padding: 10px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer;">Save</button>
          <button type="button" onclick="closeCustomMedModal()" style="flex: 1; padding: 10px; background: #ccc; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Close on outside click
  modal.onclick = function(e) {
    if (e.target === modal) {
      closeCustomMedModal();
    }
  };
};

// Save new custom medication
window.saveNewCustomMedication = function(event) {
  event.preventDefault();
  
  const medication = {
    name: document.getElementById('custom-med-name').value.trim(),
    generic: document.getElementById('custom-med-generic').value.trim(),
    strength: document.getElementById('custom-med-strength').value.trim(),
    form: document.getElementById('custom-med-form').value.trim(),
    category: document.getElementById('custom-med-category').value.trim() || 'Other',
    interactions: [],
    contraindications: []
  };
  
  if (!medication.name || !medication.generic || !medication.strength || !medication.form) {
    alert('Please fill in all required fields.');
    return;
  }
  
  // Save to custom medications
  saveCustomMedication(medication);
  
  // Update form fields
  document.getElementById('med-name').value = medication.name;
  document.getElementById('med-generic').value = medication.generic;
  document.getElementById('med-strength').value = medication.strength.split(',')[0].trim();
  document.getElementById('med-form').value = medication.form;
  
  // Refresh dropdowns
  showMedicationDropdown();
  
  closeCustomMedModal();
  alert('✅ Medication added to database!');
};

// Close custom medication modal
window.closeCustomMedModal = function() {
  const modal = document.getElementById('custom-med-modal');
  if (modal) {
    modal.remove();
  }
};

// Handle add medication
async function handleAddMedication(event) {
  event.preventDefault();
  
  const val = (id) => document.getElementById(id)?.value?.trim() || null;
  const num = (id) => { const v = document.getElementById(id)?.value; return v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null; };
  const medicationData = {
    name: document.getElementById('med-name').value,
    generic_name: val('med-generic') || document.getElementById('med-name').value,
    strength: document.getElementById('med-strength').value,
    form: document.getElementById('med-form').value,
    route: document.getElementById('med-route').value,
    initial_stock: parseInt(document.getElementById('med-initial-stock').value),
    minimum_stock: parseInt(document.getElementById('med-min-stock').value),
    maximum_stock: parseInt(document.getElementById('med-max-stock').value),
    cost_per_unit: num('med-cost'),
    selling_price_per_unit: num('med-price'),
    batch_number: val('med-batch'),
    expiry_date: val('med-expiry'),
    registration_number: val('med-registration'),
    manufacturer: val('med-manufacturer'),
    country_of_origin: val('med-country'),
    sku: val('med-sku'),
    ndc: val('med-ndc'),
    barcode: val('med-barcode'),
    shelf_location: val('med-shelf'),
    warehouse_location: val('med-warehouse'),
    reorder_point: num('med-reorder-point'),
    reorder_quantity: num('med-reorder-qty'),
    pack_size: num('med-pack-size'),
    unit_of_purchase: val('med-unit-purchase'),
    lead_time_days: num('med-lead-time'),
    therapeutic_category: val('med-category'),
    atc_code: val('med-atc'),
    storage_conditions: val('med-storage'),
    controlled_substance: val('med-controlled'),
    prescription_only: document.getElementById('med-prescription-only')?.checked || false,
    cold_chain: document.getElementById('med-cold-chain')?.checked || false,
    tax_exempt: document.getElementById('med-tax-exempt')?.checked || false,
    special_handling: val('med-special-handling')
  };
  
  try {
    await window.addMedicationToInventory(medicationData);
    alert('✅ Medication added to inventory successfully!');
    document.getElementById('add-medication-form-element').reset();
    loadInventory();
  } catch (error) {
    alert('Error adding medication: ' + error.message);
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('#medication-dropdown') && !e.target.closest('#med-name')) {
    const dropdown = document.getElementById('medication-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }
  if (!e.target.closest('#strength-dropdown') && !e.target.closest('#med-strength')) {
    const dropdown = document.getElementById('strength-dropdown');
    if (dropdown) dropdown.style.display = 'none';
  }
});

// Approve prescription (pharmacist) – moves to accountant for invoicing
async function approvePrescriptionFromCard(prescriptionId, buttonEl) {
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Approving…';
  }
  try {
    await window.approvePrescription(prescriptionId);
    if (buttonEl) {
      buttonEl.textContent = 'Approved';
      buttonEl.classList.remove('btn-primary');
      buttonEl.classList.add('btn-success');
    }
    loadDashboard();
  } catch (error) {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = 'Approve';
    }
    alert('Error: ' + error.message);
  }
}

// Reject / Return prescription (e.g. contraindications, allergies, patient unable to afford)
async function rejectPrescriptionFromCard(prescriptionId, buttonEl) {
  const reason = prompt('Reason for reject/return (e.g. allergy, contraindication, patient unable to afford):') || '';
  if (reason === null) return; // cancelled
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Rejecting…';
  }
  try {
    await window.updatePrescriptionStatus(prescriptionId, 'rejected', reason);
    alert('Prescription marked as rejected/returned.');
    loadDashboard();
  } catch (error) {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = 'Reject / Return';
    }
    alert('Error: ' + error.message);
  }
}

// Sent out (patient will fill at outside pharmacy – e.g. not in local inventory)
async function sentOutPrescriptionFromCard(prescriptionId, buttonEl) {
  const notes = prompt('Notes (e.g. printed for outside pharmacy, medication not in inventory):') || '';
  if (notes === null) return; // cancelled
  if (buttonEl) {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Marking sent out…';
  }
  try {
    await window.updatePrescriptionStatus(prescriptionId, 'sent_out', notes);
    alert('Prescription marked as sent out.');
    loadDashboard();
  } catch (error) {
    if (buttonEl) {
      buttonEl.disabled = false;
      buttonEl.textContent = 'Sent out';
    }
    alert('Error: ' + error.message);
  }
}

// Start processing prescription
async function startProcessing(prescriptionId) {
  try {
    await window.updatePrescriptionStatus(prescriptionId, 'in-process');
    alert('✅ Prescription moved to in-process');
    loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Mark prescription as dispensed (completed)
async function markAsDispensed(prescriptionId) {
  if (!confirm('Mark this prescription as dispensed?')) {
    return;
  }
  try {
    await window.updatePrescriptionStatus(prescriptionId, 'completed');
    alert('✅ Prescription marked as dispensed');
    loadDashboard();
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// Legacy alias
async function markAsFilled(prescriptionId) {
  return markAsDispensed(prescriptionId);
}

// Dispense medication – legacy wrapper; do NOT overwrite window.dispenseMedication (pharmacy-manager)
// In-process tab uses btn-dispense-line which calls pharmacy-manager directly with object payload

// Adjust stock
async function adjustStock(inventoryId, medicationName, currentStock) {
  const newStock = prompt(`Adjust stock for ${medicationName}\n\nCurrent stock: ${currentStock}\n\nEnter new stock level:`, currentStock);
  
  if (!newStock || isNaN(newStock)) {
    return;
  }
  
  const reason = prompt('Reason for adjustment:') || 'Manual adjustment';
  
  try {
    await window.updateInventoryStock(inventoryId, parseInt(newStock), reason);
    alert('✅ Stock updated successfully!');
    loadInventory();
  } catch (error) {
    alert('Error updating stock: ' + error.message);
  }
}

// Scroll to alerts section
window.scrollToAlerts = function() {
  const alertsContainer = document.getElementById('stock-alerts-container');
  if (alertsContainer) {
    alertsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Highlight the alerts section briefly
    alertsContainer.style.transition = 'background-color 0.3s';
    alertsContainer.style.backgroundColor = '#fff3cd';
    setTimeout(() => {
      alertsContainer.style.backgroundColor = '';
    }, 2000);
  }
};

// Export functions to window for onclick handlers
window.switchTab = switchTab;
window.handleAddMedication = handleAddMedication;
window.approvePrescriptionFromCard = approvePrescriptionFromCard;
window.rejectPrescriptionFromCard = rejectPrescriptionFromCard;
window.sentOutPrescriptionFromCard = sentOutPrescriptionFromCard;
window.startProcessing = startProcessing;
window.markAsFilled = markAsFilled;
window.adjustStock = adjustStock;
window.scrollToAlerts = scrollToAlerts;

window.addToQueueFromPatientRecord = async function(buttonEl) {
  const card = buttonEl && buttonEl.closest && buttonEl.closest('.prescription-card');
  if (!card) return;
  const indexStr = card.getAttribute('data-incoming-index');
  if (indexStr == null || indexStr === '') return;
  const list = window.__pharmacyIncomingPrescriptions;
  if (!Array.isArray(list)) return;
  const prescription = list[parseInt(indexStr, 10)];
  if (!prescription || !prescription._fromPatientRecord) return;
  const patientId = prescription.patient_id;
  const patientName = prescription.patient_name || patientId;
  try {
    buttonEl.disabled = true;
    buttonEl.textContent = 'Adding…';
    await window.addPatientRecordPrescriptionToQueue(patientId, patientName, prescription);
    alert('Added to pharmacy queue. You can now use Start Processing.');
    loadDashboard();
  } catch (err) {
    console.error(err);
    alert('Failed to add to queue: ' + (err.message || err));
  } finally {
    buttonEl.disabled = false;
    buttonEl.textContent = 'Add to pharmacy queue';
  }
};
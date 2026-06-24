'use strict';

/**
 * PrescribeIT / eRx queue and dispense workflow helpers.
 */
function summarizeErxQueue(prescriptions) {
  return (prescriptions || [])
    .filter((p) => {
      const erx = p.erx_status;
      const external = p.pharmacy_status === 'external';
      return (
        external ||
        erx === 'queued' ||
        erx === 'transmitted' ||
        erx === 'renewal_requested' ||
        erx === 'dispensed' ||
        (p.status === 'signed' && !erx && external)
      );
    })
    .map((p) => ({
      id: p.id,
      patient_id: p.patient_id,
      prescription_number: p.prescription_number,
      status: p.status,
      pharmacy_status: p.pharmacy_status,
      erx_status: p.erx_status || (p.pharmacy_status === 'external' ? 'queued' : null),
      erx_pharmacy_name: p.erx_pharmacy_name,
      erx_dispense_status: p.erx_dispense_status,
      erx_transmitted_at: p.erx_transmitted_at,
      critical: false
    }));
}

function applyDispenseFeedback(prescription, feedback) {
  if (!feedback?.parsed) {
    return { updated: false, error: feedback?.error || 'Invalid dispense feedback' };
  }
  return {
    updated: true,
    patch: {
      erx_dispense_status: feedback.pharmacyStatus || feedback.status,
      erx_status: feedback.status === 'completed' || feedback.pharmacyStatus === 'filled' ? 'dispensed' : prescription.erx_status,
      pharmacy_status: feedback.pharmacyStatus === 'filled' ? 'filled' : prescription.pharmacy_status,
      filled_at: feedback.whenHandedOver || prescription.filled_at,
      erx_meta: {
        ...(prescription.erx_meta || {}),
        lastDispense: {
          at: new Date().toISOString(),
          performer: feedback.performer,
          prescriptionRef: feedback.prescriptionRef,
          status: feedback.status
        }
      }
    }
  };
}

function matchPrescriptionByDispense(prescriptions, feedback) {
  if (!feedback?.prescriptionRef) return null;
  const ref = String(feedback.prescriptionRef);
  const num = ref.includes('/') ? ref.split('/').pop() : ref;
  return (prescriptions || []).find(
    (p) =>
      String(p.prescription_number || '') === num ||
      String(p.id) === num ||
      ref.includes(String(p.prescription_number || '')) ||
      ref.includes(String(p.id))
  );
}

module.exports = {
  summarizeErxQueue,
  applyDispenseFeedback,
  matchPrescriptionByDispense
};

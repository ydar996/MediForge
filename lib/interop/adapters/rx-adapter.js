'use strict';

const { buildMedicationRequest } = require('../fhir/resources');
const { enrichMedications } = require('../terminology/ccdd');
const { loadConfig } = require('../config');

function prescriptionToMedicationRequest({ patient, prescription, config }) {
  const cfg = config || loadConfig();
  const medications = enrichMedications(prescription.medications, cfg);
  return buildMedicationRequest({
    patientId: patient.id,
    prescriptionNumber: prescription.prescription_number || prescription.id,
    medications,
    prescriberId: prescription.prescriber_id || prescription.created_by,
    authoredOn: prescription.signature_date || prescription.created_at
  });
}

/**
 * Infoway / national eRx open standard payload (April 2026 profile)
 * Wraps FHIR MedicationRequest with Canadian extensions
 */
function prescriptionToInfowayPayload({ patient, prescription, config }) {
  const cfg = config || loadConfig();
  const medRequest = prescriptionToMedicationRequest({ patient, prescription, config: cfg });
  return {
    profile: 'http://infoway-inforoute.ca/fhir/StructureDefinition/ca-medication-transmission-v2',
    province: cfg.province || 'ON',
    consentObtained: prescription.consent_erx !== false,
    resource: medRequest,
    routing: {
      destination: cfg.rx?.pharmacyEndpoint || cfg.fhir?.rxEndpoint,
      messageType: 'MedicationRequest'
    }
  };
}

function attachPharmacyDestination(payload, pharmacy) {
  if (!pharmacy) return payload;
  return {
    ...payload,
    routing: {
      ...(payload.routing || {}),
      destination: pharmacy.fhirEndpoint || pharmacy.endpoint || payload.routing?.destination,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name
    }
  };
}

function prescriptionToCancelledPayload({ patient, prescription, config, reason }) {
  const base = prescriptionToInfowayPayload({ patient, prescription, config });
  const resource = {
    ...base.resource,
    status: 'cancelled',
    statusReason: reason ? { text: reason } : { text: 'Cancelled by prescriber' }
  };
  return {
    ...base,
    messageType: 'cancel',
    resource
  };
}

function prescriptionToRenewalPayload({ patient, prescription, config, requestedBy }) {
  const base = prescriptionToInfowayPayload({ patient, prescription, config });
  const priorRef = `MedicationRequest/${prescription.prescription_number || prescription.id}`;
  const resource = {
    ...base.resource,
    status: 'active',
    intent: 'order',
    basedOn: [{ reference: priorRef }],
    extension: [
      ...(base.resource.extension || []),
      {
        url: 'http://infoway-inforoute.ca/fhir/StructureDefinition/renewal-request',
        valueBoolean: true
      }
    ],
    note: requestedBy ? [{ text: `Renewal requested by ${requestedBy}` }] : [{ text: 'Renewal request' }]
  };
  return {
    ...base,
    messageType: 'renewal',
    resource,
    priorPrescriptionRef: priorRef
  };
}

function generateRxFhirPreview({ patient, prescription, config, pharmacy }) {
  let payload = prescriptionToInfowayPayload({ patient, prescription, config });
  payload = attachPharmacyDestination(payload, pharmacy);
  return payload;
}

function parseMedicationDispenseFeedback(fhirResource) {
  const res = fhirResource.resourceType === 'Bundle'
    ? fhirResource.entry?.find((e) => e.resource?.resourceType === 'MedicationDispense')?.resource
    : fhirResource;

  if (!res || res.resourceType !== 'MedicationDispense') {
    return { parsed: false, error: 'Not a MedicationDispense resource' };
  }

  return {
    parsed: true,
    prescriptionRef: res.authorizingPrescription?.[0]?.reference,
    status: res.status,
    whenHandedOver: res.whenHandedOver,
    performer: res.performer?.[0]?.actor?.reference,
    pharmacyStatus: res.status === 'completed' ? 'filled' : res.status
  };
}

module.exports = {
  prescriptionToMedicationRequest,
  prescriptionToInfowayPayload,
  attachPharmacyDestination,
  prescriptionToCancelledPayload,
  prescriptionToRenewalPayload,
  generateRxFhirPreview,
  parseMedicationDispenseFeedback
};

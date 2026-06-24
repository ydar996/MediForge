# MediForge Interoperability Documentation

**Version:** 1.0  
**Date:** June 2026  
**Standards:** HL7 v2.5, FHIR R4, DICOMweb, LOINC/pCLOCD, SNOMED CT, CCDD  
**Canada focus:** Ontario OLIS, DIRs, Infoway FHIR, national eRx open standard (post-PrescribeIT)

---

## Overview

MediForge interoperability layer enables **bidirectional** lab, imaging, and prescription exchange via configurable adapters. Core code lives in:

| Path | Purpose |
|------|---------|
| `lib/interop/` | HL7, FHIR, DICOM, terminology, adapters (Node + Netlify) |
| `netlify/functions/interop-gateway.js` | Secure server gateway (MLLP, FHIR OAuth, DICOMweb) |
| `js/interop-client.js` | Browser client |
| `js/interop-hooks.js` | Auto-transmit after order/Rx save |
| `config/interoperability.json` | Default configuration |
| `config/interoperability.ontario.example.json` | Ontario example |
| `interop-dashboard.html` | Admin/test UI |

**Gap analysis:** see `interoperability-gaps.md`

---

## Quick start

### 1. Database migration

Run in Supabase SQL Editor:

```
supabase/migrations/20260611000000_interoperability_tables.sql
```

Creates: `interop_messages`, `patient_identifiers`, `interop_endpoints`

### 2. Configuration

Copy `config/interoperability.ontario.example.json` values into `config/interoperability.json` or store per-org in `interop_endpoints.config`.

Set `enabled: true` only after endpoints are verified.

### 3. Netlify environment variables

| Variable | Purpose |
|----------|---------|
| `INTEROP_GATEWAY_API_KEY` | Protects gateway (optional in dev) |
| `INTEROP_FHIR_CLIENT_ID` | Infoway/OLIS OAuth client |
| `INTEROP_FHIR_CLIENT_SECRET` | OAuth secret |
| `INTEROP_DICOM_TOKEN` | PACS bearer token |
| `SUPABASE_URL` | Message audit logging |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role for `interop_messages` |

### 4. Include scripts in clinical pages

```html
<script src="js/interop-client.js"></script>
<script src="js/interop-hooks.js"></script>
```

Lab/imaging orders and signed external prescriptions auto-call the gateway when saved.

### 5. Run tests

```powershell
npm run test:interop
```

---

## Workflows

### Lab: order → result

1. **Outbound:** Doctor saves lab order → `MediForgeInterop.transmitLabOrder()`
2. Gateway generates **ORM^O01** (or **OML^O21**) with LOINC/pCLOCD codes
3. If MLLP host configured + `enabled:true`, sends via TLS MLLP and returns ACK
4. **Inbound:** LIS sends **ORU^R01** to gateway `ingestOru` action
5. Parser maps OBX → `orders.results` JSONB; critical flags trigger UI alert

### Imaging: order → report + images

1. Outbound: **FHIR ServiceRequest** or **HL7 ORM** with SNOMED modality
2. Inbound report: **FHIR DiagnosticReport** bundle
3. Images: **DICOMweb STOW-RS** upload or **WADO-RS** link stored in `orders.results._imaging`

### Prescriptions: eRx

1. Signed prescription (external pharmacy) → **FHIR MedicationRequest** with CCDD/DIN
2. Wrapped in Infoway transmission profile (`prescriptionToInfowayPayload`)
3. Inbound **MedicationDispense** updates pharmacy status (adapter stub)

---

## Gateway API

**POST** `/.netlify/functions/interop-gateway`

```json
{
  "action": "transmitLabOrder",
  "organizationId": "uuid",
  "patient": { "id": "...", "phn": "1234567890", "firstName": "Jane", "lastName": "Doe", "dob": "1985-03-15", "gender": "F" },
  "order": { "serial_number": "LAB-MEC-001", "selected_items": [{ "name": "FBS" }] }
}
```

| Action | Description |
|--------|-------------|
| `transmitLabOrder` | HL7 ORM or FHIR ServiceRequest |
| `ingestOru` | Parse ORU^R01, return chart payload + ACK |
| `transmitImagingOrder` | Imaging order outbound |
| `transmitPrescription` | MedicationRequest / Infoway payload |
| `dicomweb` | QIDO/WADO/STOW/C-FIND proxy |
| `matchPatient` | PHN + demographic matching |
| `generateLabHl7` | Preview HL7 without send |
| `parseOru` | Parse ORU only |
| `config` | Non-secret config status |

Header: `X-Interop-Key: <INTEROP_GATEWAY_API_KEY>` when configured.

---

## Sample messages

| File | Type |
|------|------|
| `tests/samples/hl7/orm-o01-lab-order.hl7` | Lab order |
| `tests/samples/hl7/oru-r01-lab-result.hl7` | Lab result |
| `tests/samples/hl7/orm-o01-imaging-order.hl7` | Imaging order |
| `tests/samples/fhir/service-request-lab.json` | FHIR order |
| `tests/samples/fhir/diagnostic-report-lab.json` | FHIR results |
| `tests/samples/fhir/medication-request-rx.json` | eRx |
| `tests/samples/dicom/qido-study-response.json` | DICOMweb QIDO |

---

## Ontario / OLIS notes

- Patient ID: Ontario PHN via `http://ehealthontario.ca/fhir/NamingSystem/id-on-patient-hcn`
- Store PHN in `patient_identifiers` table
- OLIS FHIR profiles referenced in `lib/interop/fhir/resources.js` meta.profile
- Production OLIS requires Infoway onboarding, conformance testing, and consent management
- MLLP endpoints are typically provided by integration partner:not public internet

Reference: [Simplifier Ontario FHIR guides](https://simplifier.net/organizations/ontariohealth)

---

## Conformance & production checklist

- [ ] Infoway FHIR conformance certificate (province-specific)
- [ ] OLIS / DIS test environment credentials
- [ ] Licensed LOINC + pCLOCD + CCDD code files loaded
- [ ] MLLP TLS certificates installed
- [ ] PACS DICOMweb endpoints tested (QIDO/WADO/STOW)
- [ ] Patient consent workflow for OLIS query
- [ ] Audit log retention policy (`interop_messages`)
- [ ] BAA with lab/pharmacy/PACS vendors

---

## Architecture

```
Clinical UI (lab-order, imaging-order, prescription)
        ↓
js/interop-hooks.js → js/interop-client.js
        ↓
Netlify interop-gateway.js
        ↓
lib/interop/adapters → HL7 MLLP | FHIR REST | DICOMweb
        ↓
External: OLIS / LIS / PACS / Infoway Rx
        ↓
Inbound ORU/DiagnosticReport → orders.results / alerts
```

---

## Extending adapters

Add province-specific mapping in `config/interoperability.json`:

```json
"terminology": {
  "labMappings": { "Custom Test": { "loinc": "XXXX-X", "pclocd": "XXXX-X" } }
}
```

Register org endpoint in `interop_endpoints` with `adapter_type: 'lab_hl7'` and custom `config` JSON.

---

## Support

Technical: support@eworkchop.com  
Internal gap tracker: `interoperability-gaps.md`

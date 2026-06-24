# MediForge Connection Guide

**Purpose:** Step-by-step onboarding for connecting a Canadian clinic to provincial labs, imaging repositories, e-prescribing, and payers.

MediForge does **not** connect directly to every lab or pharmacy. Clinics connect to **provincial hubs** and national services. This guide explains who to contact, what certifications are required, and how to flip the switch in MediForge once approved.

---

## Architecture overview

```
Clinic (MediForge)
    │
    ├── Labs ──────────► Provincial lab hub (e.g. OLIS in Ontario)
    ├── Imaging ───────► DIR / PACS (DICOMweb + FHIR)
    ├── e-Prescribing ─► Infoway national eRx service (FHIR MedicationRequest)
    └── Billing ───────► Provincial payer portal (MCEDT, Teleplan, HLINK)
```

**Code entry points:**

| Layer | Path |
|-------|------|
| Unified service | `lib/integrations/IntegrationService.js` |
| Public alias | `src/integrations/index.js` |
| Gateway (server) | `netlify/functions/interop-gateway.js` |
| Browser client | `js/interop-client.js` |
| Workflow hooks | `js/interop-hooks.js`, `js/integration-workflow-hooks.js` |
| Master config | `config/integrations.json` |
| Province registry | `config/canada-provinces.json` |
| Province overlays | `config/provinces/on.json`, `bc.json`, `ab.json` |

---

## Step 1: Choose your province

1. Open `config/integrations.json` and set `"defaultProvince": "ON"` (or `BC`, `AB`, etc.).
2. Edit the matching file in `config/provinces/` with endpoints provided by your integration partner.
3. Set `"enabled": true` only after sandbox testing passes.

Dashboard (future): Facility Configuration → **Integration Province** toggle.

---

## Step 2: Ontario (priority)

### Labs: OLIS

| Item | Detail |
|------|--------|
| **Hub** | Ontario Labs Information System (OLIS) |
| **Messages** | HL7 ORM^O01 / OML^O21 outbound; ORU^R01 inbound |
| **FHIR** | ServiceRequest, DiagnosticReport, Observation |
| **Patient ID** | OHIP PHN (10 digits) + version code |
| **Who to contact** | [Ontario Health](https://www.ontariohealth.ca/): Digital Services; integration often via certified EMR vendor path |
| **Certification** | [OntarioMD](https://www.ontariomd.ca/) EMR certification and OLIS conformance |
| **Security** | PHIPA compliance, OAuth2 (FHIR), MLLP over TLS, audit logging |

**Real-world steps:**

1. Complete OntarioMD EMR certification (or partner with a certified integrator).
2. Sign OLIS integration agreement with Ontario Health / eHealth Ontario successor org.
3. Receive sandbox MLLP host + FHIR base URL + OAuth client credentials.
4. Paste values into `config/provinces/on.json` (never commit secrets: use Netlify env vars).
5. Set Netlify environment variables:
   - `INTEROP_FHIR_CLIENT_ID`
   - `INTEROP_FHIR_CLIENT_SECRET`
   - `INTEROP_GATEWAY_API_KEY` (optional gateway lock)
   - `INTEROP_DEFAULT_PROVINCE=ON`
6. Run `npm run test:integrations` and test on `interop-dashboard.html`.

### Imaging: Ontario DIR

| Item | Detail |
|------|--------|
| **Hub** | Diagnostic Imaging Repository (regional DIR) |
| **Protocols** | DICOMweb (QIDO-RS, WADO-RS, STOW-RS); legacy C-FIND/C-MOVE via DIMSE gateway |
| **Orders** | FHIR ServiceRequest or HL7 ORM |
| **Who to contact** | Regional hospital / Ontario Health imaging program |

Configure `dicomweb` roots in `config/provinces/on.json`. Use `INTEROP_DICOM_TOKEN` for bearer auth.

### e-Prescribing: Infoway

| Item | Detail |
|------|--------|
| **Standard** | Infoway national ePrescribing (post-PrescribeIT program) |
| **Messages** | FHIR R4 MedicationRequest outbound; MedicationDispense feedback inbound |
| **Drug codes** | Health Canada DPD / CCDD via `lib/interop/terminology/ccdd.js` |
| **Who to contact** | [Canada Health Infoway](https://www.infoway-inforoute.ca/): partner onboarding |

### Billing: OHIP / MCEDT

| Item | Detail |
|------|--------|
| **Portal** | Medical Claims Electronic Data Transfer (MCEDT) |
| **Transport** | Provincial web services with client certificate |
| **Who to contact** | Ministry of Health: OHIP billing; need valid OHIP billing number |
| **Patient payments** | Cash, check, bank transfer, Interac e-Transfer, Zelle (where applicable), card: configured in `config/billing-payers.json` |

---

## Step 3: British Columbia

| Domain | Hub | Contact |
|--------|-----|---------|
| Labs | PLIS (PHSA) | Provincial Health Services Authority |
| Imaging | BC Provincial Imaging Network | PHSA / regional health authority |
| Rx | Infoway national eRx | Canada Health Infoway |
| Billing | MSP Teleplan | BC Ministry of Health |

Config file: `config/provinces/bc.json`

---

## Step 4: Alberta

| Domain | Hub | Contact |
|--------|-----|---------|
| Labs | Alberta Netcare Laboratory | Alberta Health |
| Imaging | Alberta DIR | Alberta Health Services |
| Rx | Infoway national eRx | Canada Health Infoway |
| Billing | AHCIP / HLINK | Alberta Health |

Config file: `config/provinces/ab.json`

---

## Security and privacy requirements

- **PHIPA / PIPEDA**: all message audit trails stored in `interop_messages` (Supabase).
- **Consent**: OLIS queries require documented patient consent (`config` → `security.requireConsent`).
- **Credentials**: store in Netlify env vars, not in git.
- **VPN / mTLS**: many provincial MLLP endpoints require VPN or mutual TLS certificates issued after approval.
- **Audit**: all outbound/inbound flows logged via `lib/integrations/audit-logger.js`.

---

## Enabling integrations in MediForge

### Configuration checklist

```json
// config/integrations.json
{
  "defaultProvince": "ON",
  "enabled": true,
  "workflow": {
    "autoTransmitLabOrders": true,
    "autoTransmitImagingOrders": true,
    "autoTransmitSignedPrescriptions": true,
    "registerPatientIdentifiersOnSave": true
  }
}
```

### Netlify environment variables

| Variable | Purpose |
|----------|---------|
| `INTEROP_FHIR_CLIENT_ID` | FHIR OAuth client ID |
| `INTEROP_FHIR_CLIENT_SECRET` | FHIR OAuth secret |
| `INTEROP_DICOM_TOKEN` | DICOMweb bearer token |
| `INTEROP_GATEWAY_API_KEY` | Optional gateway authentication |
| `INTEROP_DEFAULT_PROVINCE` | Default province code (ON, BC, AB) |
| `SUPABASE_URL` | Audit log persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | Audit log persistence |

### Workflow behaviour (automatic)

| Event | Integration action |
|-------|-------------------|
| Patient registered (add-patient) | PHN stored in `patient_identifiers`; patient matching |
| Lab order saved | HL7 ORM or FHIR ServiceRequest via gateway |
| Imaging order saved | FHIR ServiceRequest or HL7 ORM |
| Prescription signed | FHIR MedicationRequest to Infoway endpoint |
| Invoice created | Claim draft + optional `submitClaim` to provincial portal |
| Remittance received | `processRemittance` reconciles patient balance |

---

## Testing

```bash
npm run test:integrations   # IntegrationService unit tests
npm run test:clinical       # Interop + integrations + billing
```

Sample messages: `tests/samples/hl7/`, `tests/samples/fhir/`, `tests/samples/billing/`

Admin test UI: `/interop-dashboard.html`

---

## Certification summary

| Province | Clinical certification | Billing enrollment |
|----------|------------------------|-------------------|
| Ontario | OntarioMD EMR + OLIS conformance | OHIP billing number + MCEDT |
| BC | PITO / provincial EMR standards | MSP Teleplan Data Centre ID |
| Alberta | Alberta Netcare conformance | AHCIP HLINK credentials |

---

## Related documentation

- `MEDIFORGE-INTEROPERABILITY-DOCS.md`: HL7/FHIR/DICOM technical reference
- `MEDIFORGE-BILLING-AND-PAYMENTS-DOCS.md`: Payer engine and patient payments
- `interoperability-gaps.md`: Known gaps vs production connectivity

---

**Last updated:** June 2026

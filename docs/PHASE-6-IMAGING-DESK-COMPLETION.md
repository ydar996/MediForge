# Phase 6 Completion: Imaging Desk & ConnectingOntario Hooks (Software)

**Date:** June 2026  
**Plan reference:** `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` Phase 6

Phase 6 delivers the **software foundation** for Ontario DIR-style diagnostic imaging: outbound ORM/FHIR orders, inbound report ingest queue, DICOMweb links on orders, ConnectingOntario launch stub, and SMART-on-FHIR contextual launch stub. Live DIR/PACS production onboarding remains **blocked until partner credentials**.

## Task status

| ID | Task | Status | Evidence |
|----|------|--------|----------|
| 6.1 | Imaging order catalog (67 studies) + OHIP codes | Done | Existing imaging module |
| 6.2 | HL7/FHIR imaging order outbound | Partial | `external-imaging-orders`, gateway `generateImagingHl7/Fhir` |
| 6.3 | Structured imaging report ingest | Partial | `/imaging-results-queue`, `ingestImagingReport` |
| 6.4 | DICOMweb image storage links in chart | Partial | `attachDicomStudy`, chart viewer WADO link |
| 6.5 | ConnectingOntario / DI query hooks | Partial | `connecting-ontario.js`, interop dashboard |
| 6.6 | Contextual viewer launch (SMART-on-FHIR) | Partial | `smart-launch.js`, interop dashboard |
| 6.7 | DIR/PACS production onboarding | Blocked | Partner process |

## New in Phase 6

- **Libraries:** `imaging-results-workflow.js`, `connecting-ontario.js`, `smart-launch.js`
- **Staff UI:** `/imaging-results-queue`, `/external-imaging-orders`
- **Gateway:** `generateImagingHl7`, `generateImagingFhir`, `ingestImagingReport`, `connectingOntarioLaunch`, `smartLaunch`, `attachDicomStudy`
- **Hooks:** `ingestImagingAndApply`, `exportImagingOrderHl7/Fhir`, `launchConnectingOntario`, `launchSmartFhir`, `attachDicomStudyToOrder`
- **Tests:** `tests/interop/phase6-imaging.test.js` (51 interop tests total)

## Phase 0–5 polish (this sprint)

- **Terminology:** `docs/TERMINOLOGY-MAPPING-STATUS.md` (LOINC/pCLOCD/CCDD mapping vs licensed datasets)
- **eRx workflow:** `prescriptions.js` routes external pharmacy to provincial queue with consent messaging
- **Interop client:** fixed missing `generateLabHl7`; added imaging/CO/SMART client methods

## Owner / clinic actions

1. Complete DIR / PACS vendor onboarding when ready for sandbox.
2. Configure `connectingOntario.viewerBaseUrl` and DICOMweb endpoints in org integration settings.
3. Replace stub launch URLs with live ConnectingOntario / SMART credentials after enrollment.

## Blocked (partner credentials)

- Live RIS/DIR order transmit and report feed
- Production ConnectingOntario viewer SSO
- Full enterprise terminology datasets (see `TERMINOLOGY-MAPPING-STATUS.md`)

---

*Not a DIR certification claim. For investor summary see `/ontario-readiness` and `/investor-letter`.*

# Provincial Integration Runbook

**Audience:** MediForge engineers and clinic IT  
**Scope:** OLIS, MCEDT, PrescribeIT, DIR/imaging, HRM, DHDR, ConnectingOntario

## Quick links

| Desk | URL | Consent type |
|------|-----|--------------|
| Lab results | `/lab-results-queue` | `olis_query` |
| eRx | `/erx-queue` | `prescribeit_erx` |
| Imaging | `/imaging-results-queue` | (order-linked) |
| HRM inbox | `/hrm-inbox` | `hrm_query` |
| Claims | `/claims-queue` | n/a |
| Hub settings | `/provincial-hub-settings` | n/a |
| Interop dashboard | `/interop-dashboard` | n/a |

## Environment checklist

1. **Supabase migrations** applied (audit, interop, consents, billing, eRx, HRM).
2. **Netlify env:** `INTEROP_GATEWAY_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, province FHIR/MLLP vars as available.
3. **Org settings:** `organizations.settings.provincialHubs` or Provincial Hub Settings UI.
4. **Patient consents** enabled on chart before live provincial actions.

## Gateway actions (POST `/.netlify/functions/interop-gateway`)

Common actions: `parseOru`, `ingestOru`, `transmitLabOrder`, `simulateRxTransmit`, `ingestImagingReport`, `connectingOntarioLaunch`, `smartLaunch`, `ingestHrmReport`, `queryDhdr`.

Authorization: header `X-Interop-Key: $INTEROP_GATEWAY_API_KEY` when key is set.

## Failure triage

1. Open `/interop-dashboard` → Integration failures panel.
2. Query `interop_messages` where `status = 'failed'` for the org.
3. Check consent codes: `OLIS_CONSENT_REQUIRED`, `ERX_CONSENT_REQUIRED`, `HRM_CONSENT_REQUIRED`, `DHDR_CONSENT_REQUIRED`.
4. Verify hub URLs are not `REPLACE_*` stubs in org settings.

## Load smoke test

```bash
node scripts/load-test-interop.mjs 50 https://mediforge.netlify.app/.netlify/functions/interop-gateway
```

## Credential-gated (owner / partner)

- MOH MCEDT live upload
- Infoway OLIS / PrescribeIT production endpoints
- DIR/PACS production
- Ontario Health HRM inbound
- DHDR production FHIR with provincial SSO
- ConnectingOntario viewer SSO

## Related docs

- `MEDIFORGE-INTEROPERABILITY-DOCS.md`
- `PHASE-7-HRM-DHDR-COMPLETION.md`
- `PHASE-8-ENGINEERING-COMPLETION.md`
- `docs/compliance/ENCRYPTION-KEY-MANAGEMENT.md`

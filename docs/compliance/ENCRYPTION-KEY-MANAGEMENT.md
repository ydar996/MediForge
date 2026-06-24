# Encryption key management (operational runbook)

**Updated:** June 2026  
**Scope:** Optional AES-256 field-level encryption in MediForge (Phase 1.10)

## What is encrypted

When enabled per organization, selected patient fields may be encrypted at rest using AES-256-GCM. Keys are derived from organization setup material entered during encryption setup in the admin UI.

## Key responsibilities

| Role | Action |
|------|--------|
| Clinic admin | Complete encryption setup; store recovery phrase offline |
| Owner | Approve who may reset encryption; document in PHIPA pack |
| Support | Never request recovery phrase by email |

## Setup flow (in product)

1. Admin opens encryption setup from organization settings.
2. System generates key material; admin records recovery phrase on paper.
3. Encrypted fields are written on next save for opted-in data classes.

## Recovery

1. Use the recovery UI with the offline recovery phrase.
2. If phrase is lost, encrypted fields cannot be decrypted: plan re-entry from backups or source documents.
3. Log recovery events in audit trail.

## Rotation

- Rotation is manual today: decrypt with old phrase, re-enable setup with new phrase.
- Document rotation date in `docs/compliance/` change log when performed.

## Integration payloads

HL7/FHIR messages in transit should use TLS (MLLP TLS, HTTPS gateway). Payload encryption at rest in `interop_messages` follows Supabase project encryption at rest.

---

*Legal review of custody and key-handling clauses remains an owner action (counsel).*

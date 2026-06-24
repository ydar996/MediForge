# Data Custody and Portability: MediForge

**Document type:** Data ownership, export, and offboarding  
**Audience:** Clinic owners, administrators, OntarioMD readiness reviewers  
**Version:** Phase 0 (June 2026)

---

## 1. Summary

**The clinic owns its patient data.** MediForge provides software and hosting to store and process that data on the clinic's behalf. The clinic remains the health information custodian under PHIPA. MediForge does not sell patient data or use it for unrelated commercial purposes.

This document explains ownership, export options, and offboarding when a clinic stops using MediForge.

---

## 2. Data ownership

| Principle | Detail |
|-----------|--------|
| **Custodian** | The registered healthcare organization (clinic) is the custodian of PHI in its MediForge organization |
| **Controller instructions** | MediForge processes data only to provide EMR services described in registration terms and clinic configuration |
| **No secondary use** | Patient data is not used for advertising or unrelated analytics without explicit clinic consent and legal basis |
| **Intellectual property** | MediForge owns the application code, UI, and platform infrastructure. The clinic owns the clinical content it enters |

Each clinic is identified by a unique **organization** record with its own users, patients, and settings.

---

## 3. Portability: export options

MediForge supports multiple export paths so clinics can move data, respond to patient requests, or maintain backups.

### 3.1 Full organizational backup (JSON)

**Location:** Dashboard → Data Management & Backup  

| Method | Description |
|--------|-------------|
| **Download Backup (Direct)** | Available to authorized roles (e.g. physicians may bypass approval in configured workflows) |
| **Request Backup Download** | Staff submit a request; an approver must authorize before download |

The backup includes organization metadata and core datasets (patients, appointments, users, and related records depending on configuration). Large exports are logged in **`audit_logs`** for accountability.

**Optional encryption:** Backups may be downloaded with password-based encryption when enabled in the backup workflow.

### 3.2 Individual patient record export

From the patient chart, authorized users can export a **full patient record** as JSON, including demographics, clinical history, diagnoses, medications, allergies, visits, orders, and document metadata.

Document **file contents** may require a full organizational backup for complete binary retrieval.

### 3.3 Patient list export (CSV)

Export searchable patient demographics and list fields to CSV for reporting or migration planning.

### 3.4 Import / export tools

The **Import/Export Data** module supports structured data movement (including bulk patient import from CSV/Excel). Clinics migrating **to** MediForge use the same tools in reverse where applicable.

### 3.5 Interoperability formats (roadmap)

Ontario readiness work includes **FHIR R4** chart export and HL7-style exports for interoperability evidence. Confirm availability in release notes before relying on these for production migration.

### 3.6 Restore from backup

Clinics can **restore from backup file** for disaster recovery or sandbox testing. Restore overwrites organization-scoped data in the target environment. Use only in controlled circumstances with administrator approval.

---

## 4. Access controls on export

To reduce unauthorized bulk disclosure:

- Backup downloads often require an **approved download request**  
- Large exports trigger **audit events** and may flag bulk-export monitoring  
- Role-based access limits who can initiate exports  

Clinics should align export permissions with their privacy policies and employment agreements.

---

## 5. Clinic offboarding

When a clinic terminates MediForge service, follow this outline.

### Phase A: Before termination date

1. **Designate an export owner** (clinic administrator or privacy lead).  
2. **Export all data:**  
   - Full organizational backup (encrypted if policy requires)  
   - Any patient-specific exports needed for open requests  
   - Audit log extract if required for retention  
3. **Verify completeness:** Spot-check patient counts, recent encounters, and billing records.  
4. **Migrate to successor EMR** using exported files or agreed interoperability format.  
5. **Document** export date, file locations, and verification sign-off.

### Phase B: Account wind-down

1. Clinic administrator notifies MediForge support of termination date.  
2. **Disable new clinical entry** (optional grace period by agreement).  
3. **Revoke staff and portal user access** on the agreed date.  
4. Platform operator **deactivates organization** access per contract.

### Phase C: Data retention and deletion

Retention after offboarding is governed by:

- PHIPA and clinic record-retention policies  
- Contractual terms between clinic and MediForge  
- Legal hold if litigation or investigation applies  

**Default expectation:** After the agreed retention period, MediForge will **delete or anonymize** organization PHI from production systems unless the clinic requests extended archival in writing or law requires longer retention.

Clinics should request **written confirmation of deletion** when required for their compliance files.

---

## 6. Patient-directed requests

When a patient asks the clinic for access to their record:

1. The **clinic** verifies identity and handles the request under PHIPA.  
2. Staff use MediForge export or print tools to produce the record.  
3. Release method (secure portal, encrypted media, in person) is chosen by the custodian.

MediForge tools support the clinic; they do not replace custodian decision-making.

---

## 7. Multi-environment note

MediForge may operate **production**, **staging**, and **development** environments with separate Supabase projects. **Production** holds live PHI. Staging and dev should use synthetic or de-identified data unless explicitly approved otherwise.

Exports from production should not be restored into dev/staging without de-identification or contractual authorization.

---

## 8. Responsibilities matrix

| Task | Clinic (custodian) | MediForge (provider) |
|------|---------------------|----------------------|
| Own PHI content | Yes | No |
| Authorize export / offboarding | Yes | Support with tools |
| Respond to patient PHIPA requests | Yes | Provide technical assistance |
| Secure credentials and roles | Yes | Provide platform controls |
| Delete PHI after retention period | Request / confirm | Execute per agreement |
| Maintain audit trail during active use | Review logs | Provide append-only logging |

---

## 9. Related documents

| Document | Topic |
|----------|-------|
| `PHIPA-PRIVACY-OVERVIEW.md` | Privacy controls |
| `BREACH-NOTIFICATION-PROCEDURE.md` | Incident response |
| `DISASTER-RECOVERY-SUMMARY.md` | Backup and restore |
| `DATA-RESIDENCY-CANADA.md` | Where data is stored |

---

**Document owner:** MediForge platform operator  
**Clinic action:** Test a backup export before go-live; document internal retention and migration procedures.

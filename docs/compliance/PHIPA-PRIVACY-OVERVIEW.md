# PHIPA Privacy Overview: MediForge

**Document type:** Operational privacy summary for Ontario clinics  
**Audience:** Clinic owners, privacy officers, OntarioMD readiness reviewers  
**Version:** Phase 0 (June 2026)  
**Legal note:** This document supports internal evidence gathering. It does not replace legal counsel or a formal Privacy Impact Assessment.

---

## 1. Purpose

This document describes how MediForge handles **personal health information (PHI)** under Ontario's *Personal Health Information Protection Act, 2004* (PHIPA). MediForge is a cloud-hosted electronic medical record (EMR) platform used by healthcare organizations (clinics) to document and manage patient care.

Under PHIPA, the **clinic** (health information custodian) remains accountable for PHI in its custody. MediForge acts as an **information technology service provider** that processes PHI on the clinic's instructions, as described in registration terms and clinic agreements.

---

## 2. What counts as PHI in MediForge

MediForge stores and processes PHI when clinics use it for patient care. Examples include:

| Category | Examples in MediForge |
|----------|----------------------|
| Identifiers | Name, date of birth, health card number, patient ID, contact details |
| Clinical records | Diagnoses (ICD-10-CA / ICD-11), allergies, medications, immunizations, vital signs |
| Encounters | SOAP notes, visit history, referrals, preventive care gaps |
| Orders and results | Lab and imaging orders, in-clinic lab results, portal result release |
| Documents | PDFs and images attached to the patient chart |
| Billing | Invoices, fee codes, payer-related identifiers linked to care |
| Portal activity | Patient login, medication pickup confirmation, messages (when enabled) |

Administrative data (staff usernames, clinic settings, non-clinical configuration) is handled with the same security controls but is not PHI unless it identifies a patient.

---

## 3. Roles and access

MediForge uses **role-based access control (RBAC)**. Each staff member receives a role assigned by the clinic administrator. Users see only the modules and data their role allows.

### Clinic roles (typical)

| Role | Primary access |
|------|----------------|
| **Administrator** | User management, clinic settings, security tools, backup and export (subject to approval workflows) |
| **Doctor / Nurse Practitioner** | Full clinical chart, prescribing, orders, notes, results review |
| **Nurse / Clinical staff** | Chart updates, vitals, preventive care, inpatient workflows (when enabled) |
| **Reception / Staff** | Registration, scheduling, demographics (limited clinical write access) |
| **Billing staff** | Invoices, payments, fee schedules, billing reports |
| **Lab scientist** | In-clinic lab queue and result entry (when lab module is on) |
| **Pharmacist** | Prescription review, allergy checks, dispensing (when pharmacy module is on) |
| **Patient** | Separate portal login: own appointments, medications, released results, and summaries only |

### Platform operator

A separate **platform administrator** login exists for the MediForge product owner. It is used for cross-organization support, legal agreement management, and platform settings. It is not intended for routine clinical use. Platform access should be limited, logged, and governed by internal policy.

### Access principles

- **Least privilege:** Users receive the minimum access needed for their job.
- **Organization scope:** All clinical data is tied to an `organization_id`. One clinic cannot query another clinic's patients through normal application flows.
- **Session timeout:** Inactive sessions time out (default two hours) to reduce unattended access.
- **Account lockout:** Repeated failed logins trigger lockout; administrators can unlock accounts.

Authentication uses **Supabase Auth** (industry-standard password hashing). Passwords are not stored in plain text in the application.

---

## 4. Where PHI is stored

| Layer | Description |
|-------|-------------|
| **Primary database** | Supabase (PostgreSQL): patients, encounters, orders, billing, audit logs, and related tables |
| **Authentication** | Supabase Auth: staff and patient portal credentials |
| **Optional local cache** | Browser storage for offline-capable workflows; syncs to Supabase when online |
| **Static application** | Netlify hosts HTML, JavaScript, and CSS. Application files do not contain patient data |

Clinics should confirm production data residency in **`DATA-RESIDENCY-CANADA.md`**.

---

## 5. Encryption

### Encryption in transit

All browser and API traffic uses **HTTPS (TLS)**. Netlify enforces strict transport security headers on the public site.

### Encryption at rest (infrastructure)

Supabase encrypts database storage at rest using provider-managed encryption (AES-256 class). Backups and replicas inherit the same provider controls.

### Optional application-layer encryption

MediForge includes an **optional encryption service** (`js/encryption.js`) that clinics may enable for additional protection of sensitive fields:

- **Algorithm:** AES-256-GCM  
- **Key derivation:** PBKDF2 with SHA-256 (100,000 iterations)  
- **Key handling:** A clinic-controlled master password derives the key per session. The master password is **not** stored by MediForge.  
- **Backward compatibility:** If encryption is not enabled or initialization fails, the system continues to operate without breaking existing workflows.

Clinics choosing optional encryption must maintain their master password and recovery procedures. Loss of the master password may make encrypted fields unrecoverable.

---

## 6. Tenant isolation

MediForge is **multi-tenant**: many clinics share one platform, but patient data is isolated per organization.

| Control | Implementation |
|---------|------------------|
| **Row Level Security (RLS)** | PostgreSQL policies restrict rows by authenticated user and organization membership |
| **Organization ID on records** | Clinical tables include `organization_id`; queries scope to the logged-in user's organization |
| **Separate patient portal context** | Portal users access only records linked to their patient identity within their clinic |
| **Audit separation** | Audit log entries include `organization_id` so clinics can review their own activity |

Isolation is enforced at the database policy layer, not only in the user interface.

---

## 7. Audit logs

MediForge maintains an **`audit_logs`** table in Supabase for accountability and compliance evidence.

### What is logged

Examples include (not exhaustive):

- User login and logout (including failed attempts where captured)
- Patient chart access and exports
- Patient create, update, and bulk import events
- Billing and report exports
- Backup downloads and large data exports
- Security-relevant configuration changes

Each entry typically includes: timestamp, username, role, action type, organization, optional IP address and user agent, and structured details (JSON).

### Append-only integrity

Database triggers block **UPDATE** and **DELETE** on `audit_logs` for application roles. Logs are **append-only**: new events are inserted; existing rows are not edited or removed through normal clinic user access. This supports PHIPA accountability and OntarioMD audit expectations.

A helper function **`log_patient_chart_access`** allows consistent logging when staff open patient charts.

### Retention

Operational retention should align with clinic policy and PHIPA requirements. MediForge does not automatically purge audit logs for active organizations. Clinics and the platform operator should agree on retention and archival during offboarding (see **`DATA-CUSTODY-AND-PORTABILITY.md`**).

### Review

Clinic administrators can use security and audit tools in the application to review activity for their organization. Platform operators may access cross-organization logs only under documented support and incident procedures.

---

## 8. Patient rights and clinic responsibilities

Under PHIPA, patients generally have rights to access and correct their records, subject to legal exceptions. MediForge supports clinics operationally through:

- Printable patient summaries and chart exports  
- Full patient record export (JSON) from the patient chart  
- Bulk patient list export (CSV)  
- Patient portal (when enabled) for self-service viewing of released information  

**The clinic** must respond to patient requests, verify identity, and apply any legal limits. MediForge provides tools; the custodian remains responsible for PHIPA compliance in practice.

---

## 9. Subprocessors and third parties

| Provider | Role | PHI exposure |
|----------|------|--------------|
| **Supabase** | Database, authentication, storage API | Stores PHI entered by clinics |
| **Netlify** | Static site and serverless functions hosting | Processes requests; PHI passes through HTTPS to Supabase, not stored in site files |
| **CDN / edge** | Content delivery for static assets | Serves non-PHI application code; confirm edge routing in residency checklist |

Clinics should review current subprocessor terms and ensure agreements (including PHIPA agent agreements where required) are in place before go-live.

---

## 10. Known gaps and Phase 0 scope

This Phase 0 document reflects the **current production architecture**. Items planned or in progress (not yet certification evidence):

- Formal OntarioMD certification  
- Live provincial integrations (OLIS, HRM, PrescribeIT, MCEDT)  
- ONE ID federated login  
- Independent third-party privacy audit  

Updates to this document should be recorded when material privacy controls change.

---

## 11. Related documents

| Document | Topic |
|----------|-------|
| `BREACH-NOTIFICATION-PROCEDURE.md` | Privacy breach response |
| `DATA-CUSTODY-AND-PORTABILITY.md` | Ownership, export, offboarding |
| `DISASTER-RECOVERY-SUMMARY.md` | Backup and restore |
| `DATA-RESIDENCY-CANADA.md` | Canadian data location |
| `../../SECURITY-POLICY.md` | Broader security program |

---

**Document owner:** MediForge platform operator  
**Clinic action:** Designate a privacy contact; confirm optional encryption choice; review residency checklist before production PHI.

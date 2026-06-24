# MediForge: Complete Capabilities Guide

**Version:** June 2026  
**Audience:** Partners, investors, clinic leaders, healthcare staff: anyone who wants the full picture in plain language.  
**Shareable web version (with pictures):** https://mediforge.netlify.app/capabilities

This document is the **detailed companion** to the capabilities webpage. Share the **URL** with external audiences: not this file path.

---

## What MediForge is

MediForge is a **web-based electronic health record and clinic management platform**. Clinics use it in a browser to run day-to-day operations: patients, visits, orders, prescriptions, billing, and optional hospital, lab, and pharmacy workflows.

Each clinic is a **separate organization** on the platform. Data does not mix between clinics unless you are the platform owner overseeing the whole product.

---

## 1. Getting started & clinic setup

### Register a new clinic (Canada-ready)

- Online self-registration for a **new organization**
- Canadian addresses and postal codes
- Legal agreements accepted at signup
- First user becomes clinic administrator
- Organization code generated for staff to join later

### Join an existing clinic

- Staff register with an **organization code** from their administrator
- Role assigned (doctor, nurse, admin, biller, etc.)

### Clinic configuration (administrator)

- Turn **in-house laboratory** on or off
- Turn **in-house pharmacy** on or off
- Turn **in-patient / hospital services** on or off
- Choose diagnosis standard: **ICD-10-CA** (Canadian default) or **ICD-11**
- Configure clinic hours and schedule templates
- Appointment reminder settings
- Manual patient numbering (custom ID format) on/off
- Require emergency contact on/off
- Weight units: kilograms or pounds
- Medical specialty selection for the organization
- Patient portal setup wizard

---

## 2. People & access

### Staff roles

Each role sees a tailored dashboard:

| Role | Typical access |
|------|----------------|
| Administrator | Users, settings, security, all modules |
| Doctor / clinician | Charts, notes, orders, prescriptions |
| Nurse | Vitals, chart updates, preventive care |
| Lab scientist | In-clinic lab queue and result entry |
| Pharmacist | Prescriptions and dispensing |
| Biller / accountant | Invoices, payments, cash register |
| Reception | Patients, appointments, intake |

### Security

- Secure login with session timeout
- Account lockout and admin unlock
- **Role-based access**: staff only see what they need
- **Audit log**: who did what, when
- **Security dashboard** for the clinic
- Optional **field-level encryption** with recovery workflow
- Signed **legal agreements** stored per user
- **Physician credential verification** (regulator + diploma upload)

### Patient portal (separate login)

Patients get their own secure login when the clinic enables the portal.

---

## 3. Patient management

### Finding and listing patients

- Fast search by name, number, date of birth, phone
- Pagination for large lists
- Export patient list to spreadsheet (CSV)

### Registering patients

- Full demographics: name, DOB, gender, address, contacts
- Canadian health card / insurance fields
- **Race** field (optional, for quality reporting)
- **Practice fields:** enrolled physician, status enrolment, date joined practice, assigned MRP, card effective dates
- Emergency contact
- Manual medications (when not prescribed in-system)
- Document attachments (PDF, images)

### Bulk and online registration

- **Bulk import** from CSV or Excel: map foreign column headers, optional keep legacy patient IDs
- **Patient self-intake**: send a link; patient fills form online
- **Intake approval queue**: staff review and approve before chart goes live

### Historical and unstructured data

- **Pre-EMR / unstructured records**: attach scanned paper history before full digitization
- **Deleted patients**: soft delete with recovery and audit trail

### The patient chart (everything in one place)

| Chart section | What you store |
|---------------|----------------|
| Demographics | Identity, contact, insurance, practice enrolment |
| Medical history | Past conditions and surgeries |
| Problem / diagnosis list | Active and resolved: ICD-10-CA or ICD-11 codes |
| Allergies | Allergen, reaction, severity |
| Medications | Active and historical |
| Immunizations | Vaccines, dates, lot numbers |
| Vital signs | BP, pulse, temp, weight, height, BMI: with trends |
| Visits & encounters | Linked to appointments and notes |
| Orders | Lab and imaging with status |
| Referrals | To specialists with urgency |
| Appointments | History and upcoming |
| Preventive gaps | Overdue screenings/vaccines with proof files |
| Documents | Uploaded files |
| Patient summary | Printable handoff document |
| Full record export | Portability for transfers or requests |

---

## 4. Clinical documentation & workflows

### SOAP clinical notes

- Subjective, Objective, Assessment, Plan
- Chief complaint, exam findings, treatment plan
- Linked to patient and visit
- Preventive gap review during the visit
- Lock note when complete

### Encounters & visit summaries

- Encounter list per patient
- **Visit summaries** auto-published to patient portal after checkout or note lock

### Prescriptions

- **Health Canada drug database** search
- Dosage, frequency, duration
- **Drug interaction alerts**
- Print and track prescriptions
- Pharmacy pickup confirmation via patient portal

### Lab orders

- **176+ catalog tests** across hematology, chemistry, microbiology, molecular/PCR, endocrinology, and more
- **Search bar** and **category filter**
- **Ordering note** per test (prints on requisition)
- **Ontario L-codes** (and multi-province fee codes) for Canada billing mode
- Print lab requisition
- **External lab orders dashboard** for send-out workflow
- **In-house lab scientist dashboard** with structured templates for 40+ test types when on-site lab is enabled

### Imaging orders

- **67 imaging studies**: X-ray, ultrasound, CT, MRI, mammography, cardiology (ECG, echo, stress, Holter), nuclear medicine, sleep studies, PFT, and more
- Search, categories, ordering notes
- **OHIP imaging fee codes** for Ontario
- Print imaging requisition

### Referrals

- Referral letters with clinical context and urgency
- Specialist registry management
- Track referral from chart

### Care planning & inpatient documentation

- Care plans for chronic conditions
- **Rounds documentation** for ward care
- Lab intervention notes linked to orders

---

## 5. Appointments & schedule

- Book, edit, cancel appointments
- **Daily schedule calendar**
- **View by provider**: each doctor’s column
- Clinic-wide schedule configuration
- Upcoming appointments list
- **SMS reminder text** copy helper for staff
- Appointment reminder settings (when configured)
- Link appointments to clinical notes and checkout

---

## 6. Preventive care & clinical alerts

- **Preventive care gaps**: age/sex-based screening reminders (e.g. vaccines, cancer screening)
- Mark gap as addressed with **proof attachment** (PDF/image)
- **Preventive gaps summary report** for the clinic
- **Blood pressure alerts dashboard** for out-of-range readings

---

## 7. Billing & payments

### Day-to-day billing

- Service catalog and fee schedule
- **Canadian dollars (CAD)** default; multi-currency support
- Create invoice from clinical visit
- **Quick checkout** and payment receipt
- Outstanding balance tracking
- Payment history

### Cash register

- Open/close daily session
- Track cash in and out
- Discrepancy reporting

### Provincial & insurance billing (Canada)

- Ontario **L-codes** for lab tests
- Ontario **OHIP codes** for imaging
- Maps for BC, Alberta, Quebec
- **Claim drafts** for provincial payers (live government submission requires clinic credentials)

### Subscriptions

- Clinic subscription management (platform plans)

---

## 8. Laboratory module (in-clinic)

When enabled:

- Lab scientist work queue
- Structured entry for 40+ test types (CBC, panels, urinalysis, serology, etc.)
- Doctor lab results dashboard
- Payment confirmation option before result release
- External lab order tracking

---

## 9. Pharmacy module

When enabled:

- Pharmacy dashboard
- View and dispense prescriptions
- Allergy check before dispensing
- Accountant/pharmacy invoicing
- Inventory-oriented workflow

---

## 10. In-patient & hospital care

When enabled:

- Admissions dashboard
- Formal admission form
- Bed and ward management
- Configure wards, rooms, beds
- Inpatient dashboard and vitals
- Discharge summaries

---

## 11. Patient portal (patient-facing)

| Area | What patients can do |
|------|----------------------|
| Dashboard | Home screen after login |
| Profile | View and update contact info |
| Appointments | See upcoming visits |
| Medications | View Rx; tap **“I picked this up”** |
| Test results | Track order status; view results after doctor review |
| Visit summaries | Read summaries from completed visits |
| Messages | Secure messages with clinic |
| Documents | Access shared documents |
| Change password | Self-service password update |

**Results workflow:** Order Sent → Awaiting Provider Review → Reviewed (patient can open results and comments). Patients can print order copies anytime.

---

## 12. Communication & teamwork

- Internal **messaging** between staff
- **Tasks** and notifications
- Unread message indicator on dashboard

---

## 13. Reports & analytics

| Report | Purpose |
|--------|---------|
| General reports | Clinic operational summaries |
| Preventive gaps summary | Population-level gap tracking; i4C-style indicator mapping for Ontario quality reporting readiness |
| Conditions breakdown | Diagnosis distribution |
| Condition stats | Detailed condition analytics |
| Blood group summary | Population blood type overview |
| Audit log | Compliance and accountability |
| Deleted patients | Recovery oversight |

---

## 14. Data management & backup

- Download backup (direct)
- Request backup download (approved workflow)
- Restore from backup file
- Import/export data tools
- Export patients CSV
- Storage usage monitoring
- Full patient record export

---

## 15. Offline & mobile

- **Works offline** for many tasks: document, prescribe, manage patients when internet drops
- Automatic sync when connection returns
- **Progressive Web App**: install on phone/tablet like an app
- Responsive design for desktop, tablet, phone

---

## 16. Interoperability & standards (foundation)

Built for Canadian practice:

| Standard | Use in MediForge |
|----------|------------------|
| ICD-10-CA | Canadian diagnosis coding (default) |
| ICD-11 | International diagnosis coding (optional) |
| Health Canada drugs | Prescribing search |
| HL7-style export | Patient data export format |
| FHIR / HL7 libraries | Integration architecture for labs, imaging, claims; FHIR R4 patient chart Bundle export from chart |
| LOINC / terminology helpers | Lab and clinical coding support |

---

## 16a. Ontario EMR readiness (Phase 0 & Phase 1 complete, June 2026)

Shareable and in-app evidence for Ontario provincial connectivity and OntarioMD certification path. **Not** OntarioMD-certified; live OLIS/MCEDT/PrescribeIT still need partner credentials. Documented readiness ~50–60%.

| Feature | Detail |
|---------|--------|
| Investor readiness page | `/ontario-readiness`: pillar scores (~50–60%), roadmap, honest boundaries |
| CPP patient summary | `/cpp-patient-summary`: Ontario CPP-aligned summary from chart |
| FHIR R4 chart export | Patient details: download chart as FHIR R4 Bundle |
| Structured consent capture | `/patient-consents`: portal, data sharing, research consent types |
| OHIP claim file export | Invoice details: export OHIP claim draft file |
| Compliance pack | `docs/compliance/`: PHIPA, breach, custody, DR, data residency |
| Gap report & implementation plan | `ONTARIOMD-GAP-REPORT.md`, `ONTARIO-EMR-IMPLEMENTATION-PLAN.md` |
| Clinical image viewer | `js/chart-image-viewer.js` on patient documents |
| Consent management (org) | `/consent-management` registry for administrators |
| Interop gateway audit | Append-only `interop_messages`; all gateway actions logged |
| PHIPA policy pack index | `docs/compliance/PHIPA-POLICY-PACK-INDEX.md` |
| Investor letter | `/investor-letter` shareable update |

**Companion page:** keep `/capabilities` and this guide in sync (**`AGENT-HANDOVER.md`** Rule #3).

---

## 17. Platform administration (product owner)

Separate login for MediForge platform owner:

- View all registered organizations
- Suspend or reactivate clinics
- Platform-wide legal agreements
- Subscription and plan management
- Cross-clinic oversight
- Physician verification queue (platform level)
- Security logs

---

## 18. Honest boundaries (what is not live for every clinic yet)

- **Live provincial connections** (OLIS lab network, hospital report inbox, e-prescribing to all pharmacies, OHIP claim auto-submit): prepared in software; needs provincial credentials and agreements per clinic.
- **OntarioMD certification**: Phase 0 internal evidence complete; formal application not submitted.
- Some modules (pharmacy, inpatient, in-house lab) are **optional**: each clinic turns on what it needs.

---

## How this document compares to other MediForge pages

| Document / page | Best for | How it differs from this guide |
|-----------------|----------|--------------------------------|
| **This guide** (`capabilities` page) | Sharing with anyone: fullest, current, with real screenshots | Most complete; June 2026 feature set |
| **At a Glance** (internal md) | Quick internal summary | Shorter; fewer modules listed |
| **brochure.html** | Marketing one-pager; PDF download | Shorter overview; stock photos; fewer 2026 features (no bulk import detail, portal results workflow, fee codes, schedule-by-provider, etc.) |
| **key-features.html** | Feature checklist for prospects | Detailed cards but **outdated** vs current build: missing ICD-10-CA, Health Canada Rx, bulk import, intake approval, Ontario L-codes, expanded imaging catalog, portal order review, physician verification, backup request workflow, and more |
| **USER-MANUAL.md** | Staff how-to (“click here”) | Instructions, not a capabilities showcase |
| **MEDIFORGE-BROCHURE-CONTENT.md** | Source text for brochure PDF | Marketing tables; not updated for every 2026 release |

**Recommendation:** Share **`https://mediforge.netlify.app/capabilities`** with people asking what MediForge can do. Use **brochure** for a printable marketing PDF. Use **user manual** for staff training.

---

*MediForge: built for modern primary care, specialty clinics, and hospital-attached practices. Powered by Work Chop Inc.*

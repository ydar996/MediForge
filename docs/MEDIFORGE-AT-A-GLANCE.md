# MediForge at a Glance

**What this is:** A plain-language guide to everything MediForge can do **today** (June 2026).  
**Who it’s for:** Anyone: clinic owners, doctors, nurses, reception, investors, partners, or family members who want to understand the product without reading technical manuals.

**Not the same as:**
- **[USER-MANUAL.md](USER-MANUAL.md)**: step-by-step instructions for staff (“click here, then there”).
- **[MEDIFORGE-BROCHURE-CONTENT.md](../MEDIFORGE-BROCHURE-CONTENT.md)**: marketing source material (denser, table format).
- **[key-features.html](../key-features.html)** / **[brochure.html](../brochure.html)**: web pages for the public site.

---

## In one sentence

**MediForge is a secure, web-based clinic system** that helps healthcare teams register patients, document visits, order tests, prescribe medications, bill for services, and: when you turn it on: let patients see their own information online.

You use it in a normal web browser (Chrome, Edge, Safari, Firefox). No special software to install on every computer, though it can also work like an app on phones and tablets.

---

## Who uses MediForge?

| Role | What they do in MediForge |
|------|---------------------------|
| **Doctors & nurse practitioners** | Examine patients, write notes, order labs and imaging, prescribe, refer to specialists |
| **Nurses & clinical staff** | Vitals, chart updates, preventive care tracking, inpatient care |
| **Reception & admin** | Register patients, book appointments, manage intake forms |
| **Billing staff** | Invoices, payments, receipts, insurance-style claims (drafts) |
| **Lab staff** | Enter and review lab results (when the clinic runs its own lab workflow) |
| **Pharmacists** | View prescriptions, check allergies, dispense (when pharmacy module is on) |
| **Clinic administrator** | Add staff, set roles, configure the clinic, security settings |
| **Patients** | Portal for appointments, medications, test results, visit summaries (when enabled) |
| **Platform owner** | Oversees all clinics on the system (separate admin login) |

Each person sees only what their **role** allows. One clinic cannot see another clinic’s patients.

---

## Getting started

### Register a new clinic (Canada-first)

A new organization can **sign up online**, enter clinic details (Canadian address and postal code supported), accept legal agreements, and start using the system. The first person becomes the clinic administrator.

Staff can **join an existing clinic** with an organization code from their administrator.

### Log in securely

Staff log in with username and password. Sessions can time out for security. Locked accounts can be unlocked by an administrator.

Patients use a **separate patient portal login** when the clinic enables it.

---

## Patient management

Everything about a person’s care lives in one **patient chart**.

### Find and register patients

- Search by name, patient number, date of birth, or phone
- Add new patients with full contact and demographic details
- **Bulk import** many patients at once from a spreadsheet (CSV or Excel): useful when moving from paper or another system
- **Patient self-intake**: send a link so new patients fill in their details online; staff review and approve before the chart goes live
- Optional fields for Canadian practice: health card info, enrolled physician, date joined practice, race (for quality reporting), and more
- Attach documents (PDFs, images) to the chart
- Export patient lists or a **full record export** when needed

### What’s inside a patient chart

Each chart is organized into clear sections:

| Section | What it holds |
|---------|----------------|
| **Demographics & contact** | Name, address, phone, emergency contact, insurance |
| **Medical history** | Past conditions and surgeries |
| **Problem / diagnosis list** | Active and resolved diagnoses with standard medical codes (**ICD-10-CA** or **ICD-11**) |
| **Allergies** | Allergens, reactions, severity |
| **Medications** | Current and past prescriptions; manual entry supported |
| **Immunizations** | Vaccines given, dates, lot numbers |
| **Vital signs** | Blood pressure, pulse, weight, height, BMI: with trends over time |
| **Visits & encounters** | History of appointments and clinical encounters |
| **Orders** | Lab and imaging orders and their status |
| **Referrals** | Letters and tracking to specialists |
| **Preventive care gaps** | Reminders for screenings or vaccines the patient may still need: with proof attachments |
| **Patient summary** | Printable overview for referrals or patient requests |

---

## Clinical work: documenting care

### Clinical notes (SOAP format)

Doctors and clinicians write structured visit notes:

- **S**: what the patient said (subjective)
- **O**: exam findings and test results (objective)
- **A**: assessment / diagnosis
- **P**: plan (treatment, follow-up, orders)

Notes link to the patient’s chart and can include preventive care gap review during the visit.

### Prescriptions

- Search **Health Canada’s drug database** when prescribing
- Dosage and frequency on the prescription
- **Drug interaction alerts** before signing
- Print or track prescriptions; pharmacy workflow when enabled
- Patients can confirm **medication pickup** through the portal

### Lab orders

- Choose from a **large catalog** of lab tests (blood work, microbiology, hormones, and more)
- **Search** and filter by category (e.g. hematology, chemistry, microbiology)
- Add an **ordering note** for the lab (saved on the requisition and printout)
- Correct **Ontario lab fee codes (L-codes)** shown for billing reference in Canada mode
- Print requisition forms for external labs

### Imaging orders

- Order X-rays, ultrasound, CT, MRI, cardiology tests (ECG, echo, stress test, Holter), mammography, sleep studies, and more
- **Search** and filter by category (X-Ray, Ultrasound, CT, MRI, Cardiology, etc.)
- Ordering notes on each study
- Correct **OHIP imaging fee codes** for Ontario clinics
- Print imaging requisition forms

### Referrals

- Create referral letters with urgency level and clinical context
- Track referral status from the patient chart

---

## Appointments & schedule

- Book, change, and cancel appointments
- **Daily schedule view** with optional **filter by provider** (each doctor’s column)
- Link appointments to clinical notes and check-out
- Appointment reminders (when configured)

When a visit is **checked out** or a note is **locked**, visit summaries can flow to the **patient portal** automatically.

---

## Billing & payments

MediForge is built **Canada-first** (Canadian dollars by default) with support for other provinces and billing modes.

| Capability | Detail |
|------------|--------|
| **Services & pricing** | Configure clinic fee schedule |
| **Invoices & checkout** | Bill at visit; take payment; print receipt |
| **Cash register** | Track daily cash transactions |
| **Provincial fee codes** | Ontario OHIP-style codes for labs and imaging; multi-province map for Canada |
| **Insurance / payer workflow** | Draft claims for provincial billing (live submission to government systems requires separate credentials) |
| **Reports** | Financial summaries for the clinic |

---

## Patient portal

When the clinic turns it on, patients log in to their own secure area:

| Feature | What patients can do |
|---------|----------------------|
| **Appointments** | See upcoming visits |
| **Medications** | View prescriptions; confirm **“I picked this up”** |
| **Test results** | See order status (sent → awaiting review → reviewed); view results after the doctor releases them |
| **Visit summaries** | Read summaries after visits are completed |
| **Messages** | Communicate with the clinic (when enabled) |
| **Print orders** | View or print copies of lab/imaging requisitions |

---

## Laboratory module (in-clinic lab)

For clinics that **perform tests on site** (not only send to LifeLabs/Dynacare):

- Lab scientist **dashboard**: queue of orders waiting for results
- **Structured templates** for dozens of test types (CBC, chemistry panels, urinalysis, serology, etc.)
- Enter results with validation; doctors view results from the chart
- Billing step can be tied to lab workflow

---

## Pharmacy module

When enabled for the organization:

- Pharmacist dashboard for incoming prescriptions
- **Allergy check** before dispensing
- Dispensing and inventory tracking
- Invoicing for pharmacy sales

---

## In-patient care (hospitals & wards)

Optional module for organizations that admit patients:

- Admissions and bed management
- Ward dashboards and rounds documentation
- Vitals tracking for inpatients
- Discharge summaries
- Configure wards, rooms, and beds

---

## Communication & teamwork

- **Internal messaging** between staff
- **Tasks** assigned to team members
- Notifications for important events (when configured)

---

## Reports, quality & prevention

- **Preventive care gaps**: surfaces overdue screenings, vaccines, or follow-ups; staff can mark addressed and attach proof
- **Audit logs**: record of who did what in the system (for accountability and compliance)
- **Security dashboard**: clinic-level security monitoring tools
- Export and reporting for administrators

---

## Works when the internet is weak or down

MediForge uses a **hybrid design**: it prefers live cloud storage but can **keep working offline** for many tasks, then sync when connection returns. That helps rural clinics, travel, or brief outages.

*(See [HOW-TO-USE-OFFLINE-CAPABILITIES.md](../HOW-TO-USE-OFFLINE-CAPABILITIES.md) for staff details.)*

---

## Security & privacy (built in)

| Protection | What it means in plain language |
|------------|--------------------------------|
| **Separate clinics** | Your data is isolated from other organizations |
| **Role-based access** | Nurses, doctors, and billers see only what they need |
| **Encrypted connection** | Data travels securely over the internet (HTTPS) |
| **Cloud storage** | Patient records stored in a managed database (Supabase), not loose files on one PC |
| **Audit trail** | Important actions are logged |
| **Legal agreements** | Registration includes terms staff and clinics accept |
| **Optional encryption tools** | Extra protection for sensitive fields when configured |

---

## Platform administration (product owner)

A separate **platform login** exists for the owner of MediForge itself (not individual clinics):

- View all registered organizations
- Platform-wide settings and legal agreements
- Subscription / plan management (when enabled)
- Cross-clinic oversight: not day-to-day clinical use

---

## Canada & international readiness

| Area | Today |
|------|--------|
| **Currency** | Canadian dollars (CAD) default |
| **Addresses** | Canada registration and postal codes |
| **Diagnosis codes** | ICD-10-CA (Canadian) and ICD-11 |
| **Prescribing** | Health Canada drug search |
| **Lab / imaging billing codes** | Ontario L-codes and OHIP imaging codes; maps for BC, AB, QC |
| **USA mode** | CPT codes for labs/imaging where billing mode is set to USA |
| **Ontario readiness (Phases 0–4 software)** | Gap report, compliance pack, MCEDT claims desk, OLIS lab desk, evidence binder, FHIR/CPP/consents, investor pages at `/ontario-readiness` and `/investor-letter` (~60–70% documented readiness) |

---

## What MediForge is still growing toward

Being honest helps set expectations:

- **Live connections** to Ontario provincial systems (OLIS lab network, hospital report inbox, e-prescribing to pharmacies, OHIP claim submission): architecture exists; **live provincial credentials** are a next step, not yet flipped on for every clinic.
- **OntarioMD certification**: Phases 0–4 software evidence is in the product and docs; formal certification (Stage 5) not started yet. Evidence binder and self-assessment pages live.
- Some brochure features depend on **clinic configuration** (pharmacy, inpatient, portal): not every clinic turns every module on.

---

## Quick reference: main areas of the app

| Area | Plain description |
|------|-------------------|
| Dashboard | Home screen: buttons to every module |
| Patients | Search, charts, bulk import, intake approval |
| Clinical note | SOAP documentation during a visit |
| Lab / imaging orders | Searchable catalogs with notes and fee codes |
| Prescriptions | Drug search, interactions, print |
| Appointments | Booking and daily schedule |
| Billing | Invoices, payments, receipts |
| Messages | Staff communication |
| Patient portal | Patient-facing website |
| Lab scientist | In-clinic result entry |
| Pharmacy | Dispensing workflow |
| In-patient | Beds, admissions, discharge |
| Admin / security | Users, roles, clinic settings |

---

## Where to learn more

This guide is the written companion to the shareable webpage. **Give people the link**: not file paths:

**https://mediforge.netlify.app/capabilities**

| If you want… | Use… |
|--------------|------|
| Share with partners (best) | **/capabilities** webpage |
| Printable marketing PDF | **/brochure** |
| Staff step-by-step training | User manual on the live site |

---

**MediForge**: secure clinic management in the browser, built for modern primary care and specialty practices.

*Document version: June 2026. Reflects production feature set including Ontario EMR readiness Phases 0–4 (software), MCEDT claims desk, and OLIS-ready lab desk.*

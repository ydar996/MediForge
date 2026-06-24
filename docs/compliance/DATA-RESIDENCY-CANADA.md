# Data Residency: Canada

**Document type:** Data location and verification checklist  
**Audience:** Clinic owners, platform operator, OntarioMD readiness reviewers  
**Version:** Phase 0 (June 2026)

---

## 1. Policy statement

**MediForge is designed for Canadian clinics.** Production personal health information (PHI) **should be stored and processed in Canada** unless the clinic and platform operator agree otherwise in writing.

This document states:

- Where PHI is expected to reside  
- What may leave Canada at the edge (CDN)  
- How the owner verifies production configuration  

---

## 2. Components and expected location

| Component | Provider | PHI stored? | Expected region |
|-----------|----------|-------------|-----------------|
| **Primary database** | Supabase (PostgreSQL) | Yes | **Canada** (e.g. AWS `ca-central-1`) |
| **Authentication** | Supabase Auth | Yes (credentials, metadata) | Same Supabase project region |
| **File / object storage** | Supabase Storage (if used) | Yes (documents) | Same Supabase project region |
| **Web application** | Netlify | No PHI at rest in site files | Build and deploy from connected Git; static assets on Netlify CDN |
| **Serverless functions** | Netlify Functions | Transient processing only | Executes on Netlify infrastructure; PHI in transit to Supabase |
| **Browser cache** | End-user device | Yes (when offline sync enabled) | Clinic-controlled devices in Canada |

---

## 3. Owner confirmation required: production Supabase region

**Action required:** The platform owner must confirm the **production** Supabase project region before citing this document as evidence.

Until confirmed, treat production region as **TBD**.

### How to confirm production region

1. Log in to [Supabase Dashboard](https://supabase.com/dashboard).  
2. Open the **production** project (e.g. MediForge-Prod).  
3. Go to **Settings** → **General**.  
4. Read **Region** (target: **Canada (Central)** / `ca-central-1` or equivalent Canadian region).  
5. Record in the confirmation table below.

### Production confirmation record

| Field | Value |
|-------|-------|
| Production project name | *[Owner to complete]* |
| Project reference ID | *[Owner to complete]* |
| Region displayed in dashboard | *[Owner to complete]* |
| Confirmed Canadian region? (Yes/No) | *[Owner to complete]* |
| Confirmed by (name) | *[Owner to complete]* |
| Confirmation date | *[Owner to complete]* |

**Staging and Dev:** Should use the **same region** as production unless there is a documented reason otherwise (see `docs/SUPABASE-DEV-STAGING-SETUP.md`).

---

## 4. Netlify and CDN considerations

Netlify serves the MediForge **application code** (HTML, JavaScript, CSS) through a **content delivery network (CDN)**. CDN edge nodes may exist outside Canada.

| Data type | Typical CDN exposure |
|-----------|---------------------|
| Application source files | Cached globally; **no patient records** |
| API responses containing PHI | Not cached as static assets; sent over HTTPS directly to Supabase from the browser |
| Netlify Function requests | May route through Netlify's network; minimize PHI in function payloads |

**Risk posture:** CDN distribution of static assets is standard for web applications and does not place the primary PHI database outside Canada when Supabase is in a Canadian region. Clinics with strict contractual residency clauses should review Netlify's data processing terms with legal counsel.

---

## 5. Data in transit

All clinic and patient access uses **HTTPS (TLS)** between browser and:

- Netlify (application load)  
- Supabase (`*.supabase.co` API and realtime channels)  

Content Security Policy on the Netlify site restricts connect targets to approved domains including Supabase.

---

## 6. Verification checklist

Complete this checklist for OntarioMD / PHIPA evidence. Retain signed or dated copies.

### Supabase (production)

- [ ] Production project identified and documented  
- [ ] Region confirmed as Canadian (`ca-central-1` or current Supabase Canada offering)  
- [ ] Staging and Dev regions documented and aligned with policy  
- [ ] No production PHI copied to non-Canadian projects without approval  
- [ ] Supabase organization billing and access limited to authorized personnel  
- [ ] Database backups remain within Supabase's region for the selected project (per Supabase plan documentation)

### Netlify (production site)

- [ ] Production site name / URL documented (e.g. `mediforge.netlify.app` or custom domain)  
- [ ] Site linked to approved Git branch / deploy pipeline  
- [ ] Environment variables point production build to **production** Supabase URL only  
- [ ] Reviewed Netlify DPA / privacy terms for Canadian clinic suitability  
- [ ] Confirmed static deploy artifacts contain no embedded patient data  

### Application configuration

- [ ] `js/supabase-env.js` (or inject script output) uses production Supabase URL for prod deploys  
- [ ] No patient backup JSON committed to Git repositories  
- [ ] Clinic advised that browser offline cache may hold PHI on local devices (physical security required)

### Clinic operational

- [ ] Clinic devices accessing MediForge are located in Canada (or approved cross-border policy)  
- [ ] Export files stored on clinic systems remain under custodian control in Canada  
- [ ] Subprocessor list shared with clinic privacy officer  

---

## 7. If production is not in Canada

If the owner confirms production Supabase is **outside Canada**:

1. **Stop** citing this document as "Canadian residency confirmed."  
2. Assess PHIPA and contractual impact with legal counsel.  
3. Plan migration to a Canadian Supabase region (Supabase project migration or new project + data export/import).  
4. Update this document after migration with new confirmation record.

---

## 8. Subprocessors summary

| Vendor | Function | Residency note |
|--------|----------|----------------|
| Supabase | Database, auth, storage | **Set by project region at creation** |
| Netlify | Hosting, CDN, functions | US-based company; CDN global; review DPA |
| Paystack (if billing enabled) | Payments | Separate terms; typically no PHI in payment metadata |

Notify clinics when material subprocessor or region changes occur.

---

## 9. Related documents

| Document | Topic |
|----------|-------|
| `PHIPA-PRIVACY-OVERVIEW.md` | Privacy controls |
| `DISASTER-RECOVERY-SUMMARY.md` | Backup and provider resilience |
| `DATA-CUSTODY-AND-PORTABILITY.md` | Export and ownership |
| `../SUPABASE-DEV-STAGING-SETUP.md` | Creating aligned dev/staging projects |

---

**Document owner:** MediForge platform operator  
**Next action:** Owner completes Section 3 confirmation table for production Supabase region.

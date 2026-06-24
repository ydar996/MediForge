# MediForge compliance documentation

**Status:** Phase 0 and Phase 1 complete (June 2026). Suitable for OntarioMD readiness evidence. Legal review recommended before certification submission.

**Purpose:** Operational and policy documents describing how MediForge handles personal health information (PHI) for Ontario clinics under PHIPA. These documents support internal evidence gathering; they do **not** replace legal counsel or a formal Privacy Impact Assessment.

---

## Document index

| Document | Status | Purpose |
|----------|--------|---------|
| [PHIPA-PRIVACY-OVERVIEW.md](./PHIPA-PRIVACY-OVERVIEW.md) | Complete | How MediForge handles PHI, roles, encryption, audit logs, tenant isolation |
| [BREACH-NOTIFICATION-PROCEDURE.md](./BREACH-NOTIFICATION-PROCEDURE.md) | Complete | Steps if a privacy breach occurs |
| [DATA-CUSTODY-AND-PORTABILITY.md](./DATA-CUSTODY-AND-PORTABILITY.md) | Complete | Clinic owns data, export options, offboarding |
| [DISASTER-RECOVERY-SUMMARY.md](./DISASTER-RECOVERY-SUMMARY.md) | Complete | Backup, restore, Supabase and Netlify resilience |
| [DATA-RESIDENCY-CANADA.md](./DATA-RESIDENCY-CANADA.md) | Complete | Where data is stored; Supabase region confirmation checklist |
| [PHIPA-POLICY-PACK-INDEX.md](./PHIPA-POLICY-PACK-INDEX.md) | Complete | Master index for diligence reviewers |

--- before citing as evidence

1. **Confirm production Supabase region** in `DATA-RESIDENCY-CANADA.md` (Section 3).  
2. Add clinic-specific contacts to `BREACH-NOTIFICATION-PROCEDURE.md`.  
3. Schedule legal review of all five documents.  
4. Re-read after material platform changes (new subprocessors, region migration, major security features).

---

## Related material (outside this folder)

| Location | Topic |
|----------|-------|
| [../../SECURITY-POLICY.md](../../SECURITY-POLICY.md) | Broader security program |
| [../ONTARIOMD-READINESS-PLAN.md](../ONTARIOMD-READINESS-PLAN.md) | OntarioMD sprint plan and acceptance criteria |
| [../ONTARIO-EMR-IMPLEMENTATION-PLAN.md](../ONTARIO-EMR-IMPLEMENTATION-PLAN.md) | Ontario EMR roadmap |

---

**Last updated:** June 23, 2026

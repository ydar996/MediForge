# Disaster Recovery Summary: MediForge

**Document type:** Backup, restore, and hosting resilience  
**Audience:** Clinic administrators, platform operator, OntarioMD readiness reviewers  
**Version:** Phase 0 (June 2026)

---

## 1. Purpose

This document summarizes how MediForge protects against data loss and service interruption. It covers:

- Clinic-level backup and restore features  
- Supabase (database) resilience  
- Netlify (application hosting) resilience  
- Operational recovery objectives  

This is a **summary** for evidence and planning, not a full enterprise DR runbook.

---

## 2. Architecture overview

```
Clinic browsers (HTTPS)
        |
        v
   Netlify CDN / Functions  ---- static app, serverless APIs
        |
        v
   Supabase  ---- PostgreSQL, Auth, Storage (PHI)
```

Patient data lives primarily in **Supabase**. The MediForge user interface is served from **Netlify**. Brief offline use is supported via browser caching and sync when connectivity returns.

---

## 3. Recovery objectives (targets)

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | Up to 24 hours for platform DB backups; near-zero for clinic-initiated backups | Supabase daily backups plus optional clinic exports |
| **RTO** (Recovery Time Objective) | 4 to 24 hours for major platform incident | Depends on Supabase/Netlify incident scope |
| **Clinic-local RTO** | Minutes to hours for restore from clinic backup file | Requires valid backup and administrator action |

Actual times depend on incident severity, provider status, and whether a recent clinic export exists.

---

## 4. Supabase resilience

MediForge production PHI is stored in a **Supabase project** (PostgreSQL).

### Provider-managed protections

| Feature | Benefit |
|---------|---------|
| **Automated daily backups** | Supabase Pro (and above) includes scheduled database backups |
| **Point-in-time recovery (PITR)** | Available on eligible plans: restore to a timestamp within retention window |
| **Replication and infrastructure redundancy** | Managed by Supabase within the selected region |
| **Encryption at rest** | Provider-managed disk encryption |

### Platform operator responsibilities

- Monitor Supabase status and backup configuration for production  
- Test restore procedures in **non-production** before relying on them in an incident  
- Document production project reference, region, and plan tier in internal runbooks  
- Apply schema migrations in a controlled pipeline (dev → staging → production)

### Clinic responsibilities

- Maintain **periodic organizational backups** downloaded through MediForge (see Section 5)  
- Store backup files securely (encrypted storage, access-controlled)  
- Do not rely solely on browser local storage for long-term retention  

---

## 5. Clinic-level backup and restore

MediForge includes first-party backup tools in the application.

### Backup

| Capability | Description |
|------------|-------------|
| **Full organizational backup** | JSON export of organization-scoped data |
| **Approval workflow** | Requests and approvals for sensitive downloads |
| **Optional encryption** | Password-protected backup files |
| **Audit logging** | Backup and export events recorded in `audit_logs` |

**Recommended practice:** Monthly encrypted organizational backup stored off-site; additional backup before major migrations or offboarding.

### Restore

| Capability | Description |
|------------|-------------|
| **Restore from backup file** | Administrator uploads JSON backup to repopulate organization data |
| **Undo last restore** | Safety feature where implemented: revert recent restore operation |

Restore is destructive to current organization-scoped data in the target environment. Always confirm environment (production vs staging) before restoring.

### Offline / sync

The hybrid offline design allows limited continued use when connectivity fails. Data syncs to Supabase when online. Offline cache is **not** a substitute for formal backup.

---

## 6. Netlify resilience

The MediForge **static application** (HTML, JavaScript, CSS) is deployed to Netlify.

### Provider-managed protections

| Feature | Benefit |
|---------|---------|
| **Global CDN** | Cached static assets served from edge locations |
| **Automatic HTTPS** | TLS certificates managed by Netlify |
| **Atomic deploys** | Roll back to prior deploy if a release causes outage |
| **Build pipeline** | Pre-deploy checks (`npm run check`) reduce broken releases |

### Application vs data

Netlify hosts **code**, not the primary patient database. If Netlify is unavailable:

- Users cannot load the web application  
- **PHI in Supabase remains intact**  
- Recovery is redeploy or rollback once Netlify service restores  

Serverless **Netlify Functions** (e.g. appointment reminders, security proxy endpoints) follow Netlify availability. Critical clinical persistence still depends on Supabase.

---

## 7. Disaster scenarios and response

### Scenario A: Accidental deletion within clinic (user error)

1. Stop further changes.  
2. Check audit logs for scope and time.  
3. Restore from most recent **clinic organizational backup** if needed.  
4. If no clinic backup, escalate to platform operator for Supabase PITR (if enabled and within window).

### Scenario B: Supabase regional outage

1. Monitor [Supabase status](https://status.supabase.com).  
2. Communicate expected downtime to affected clinics.  
3. Offline-capable clients may allow read/write locally until sync resumes.  
4. No clinic action can restore Supabase infrastructure: wait for provider recovery.

### Scenario C: Netlify outage or bad deploy

1. Monitor [Netlify status](https://www.netlifystatus.com).  
2. Platform operator rolls back deploy or waits for provider recovery.  
3. PHI unaffected in Supabase; clinics should avoid unverified mirror sites.

### Scenario D: Ransomware or credential compromise

Follow **`BREACH-NOTIFICATION-PROCEDURE.md`**. Restore from clean backup only after containment and credential reset.

### Scenario E: Complete clinic loss (fire, closure)

Custodian retains responsibility for records. Prior **encrypted organizational backups** and export files enable migration to another EMR.

---

## 8. Testing schedule (recommended)

| Test | Owner | Frequency |
|------|-------|-----------|
| Download and verify organizational backup | Clinic administrator | Monthly |
| Restore backup to staging environment | Platform operator or clinic IT | Quarterly |
| Supabase PITR drill (non-prod) | Platform operator | Annually |
| Netlify rollback drill | Platform operator | Annually or after major infra change |

Record test date, result, and corrective actions.

---

## 9. Dependencies and limitations

- Recovery from Supabase PITR requires eligible plan and operator access.  
- Clinic backup JSON may not include every binary document unless full backup configuration includes them.  
- Multi-region active-active failover is **not** part of Phase 0 architecture.  
- Third-party email or SMS providers used for reminders have separate availability profiles.

---

## 10. Related documents

| Document | Topic |
|----------|-------|
| `DATA-CUSTODY-AND-PORTABILITY.md` | Export and offboarding |
| `DATA-RESIDENCY-CANADA.md` | Region and data location |
| `PHIPA-PRIVACY-OVERVIEW.md` | Security and audit controls |
| `../../DEPLOYMENT-ENVIRONMENTS.md` | Dev, staging, production environments |

---

**Document owner:** MediForge platform operator  
**Clinic action:** Perform at least one successful backup download and verify file integrity before relying on MediForge for live PHI.

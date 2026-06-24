# Breach Notification Procedure: MediForge

**Document type:** Privacy breach response procedure  
**Audience:** Clinic administrators, privacy officers, MediForge platform operator  
**Version:** Phase 0 (June 2026)  
**Legal note:** PHIPA breach obligations rest primarily with the **health information custodian** (the clinic). This procedure describes coordinated steps when a breach involves MediForge. Legal counsel and the Information and Privacy Commissioner of Ontario (IPC) guidance should be consulted for specific incidents.

---

## 1. Purpose

This procedure defines steps to take when there is a **privacy breach**: unauthorized access, collection, use, disclosure, or loss of personal health information (PHI) in or through MediForge.

Goals:

- Contain harm quickly  
- Preserve evidence for investigation  
- Meet PHIPA notification duties where applicable  
- Restore secure operations  
- Document lessons learned  

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Privacy breach** | Any unauthorized access to, or collection, use, or disclosure of PHI, or loss of PHI |
| **Custodian** | The clinic (health information custodian) accountable under PHIPA |
| **Agent / IT provider** | MediForge platform operator processing PHI on the custodian's behalf |
| **IPC** | Information and Privacy Commissioner of Ontario |

A breach may involve staff misuse, stolen credentials, misdirected export, vendor incident, or technical failure.

---

## 3. Roles and contacts

| Role | Responsibility |
|------|----------------|
| **Clinic privacy lead / administrator** | First response at clinic; notifies patients and IPC as required; coordinates with MediForge |
| **MediForge platform operator** | Technical containment, log preservation, root-cause support, custodian notification |
| **Affected users** | Report suspicious activity immediately |

**Suggested contacts (update with clinic-specific details):**

| Party | Contact |
|-------|---------|
| MediForge security / incidents | security@eworkchop.com |
| MediForge general support | support@eworkchop.com |
| Clinic privacy officer | *[Clinic to complete]* |
| IPC (Ontario) | [ipc.on.ca](https://ipc.on.ca) |

Each clinic should append local escalation names and after-hours numbers to its internal copy of this procedure.

---

## 4. Severity classification (initial triage)

Use the highest applicable level:

| Level | Examples |
|-------|----------|
| **Critical** | Confirmed unauthorized access to many patient records; ransomware; database exposure; stolen admin credentials used in production |
| **High** | Limited unauthorized chart access; mis-sent export to wrong recipient; confirmed patient portal cross-access |
| **Medium** | Policy violation without confirmed external disclosure; failed control with no evidence of access |
| **Low** | Near-miss, misconfiguration caught before exposure |

When in doubt, classify **up** until investigation clarifies scope.

---

## 5. Response steps

### Step 1: Detect and report (immediate)

**Who:** Any staff member, administrator, or platform monitor  
**When:** As soon as a breach is suspected or confirmed  

Actions:

1. Do not delete evidence or "test" further access.  
2. Report to the clinic privacy lead and clinic administrator.  
3. Report to MediForge at **security@eworkchop.com** if the incident involves the platform, credentials, exports, or unknown system access.  
4. Record: date/time discovered, who reported, what was observed, affected patients (if known).

---

### Step 2: Contain (within 1 hour for Critical/High)

**Who:** Clinic administrator + MediForge platform operator  

Actions:

1. **Disable compromised accounts:** Lock affected user accounts in MediForge; force password reset.  
2. **Revoke sessions:** Sign out active sessions where tools allow.  
3. **Stop ongoing disclosure:** Cancel pending exports; recall mis-sent files if possible.  
4. **Restrict access:** Temporarily limit backup download or bulk export if abuse is suspected.  
5. **Platform-level action:** MediForge may disable organization access, rotate API keys, or block IPs under incident policy.  
6. **Preserve logs:** Do not purge audit logs. Export relevant `audit_logs` entries for the incident window.  

Document every containment action with timestamp and responsible person.

---

### Step 3: Assess scope (within 24 hours)

**Who:** Clinic privacy lead with MediForge technical support  

Determine:

| Question | How MediForge helps |
|----------|---------------------|
| Which patients are affected? | Audit logs, access timestamps, export logs |
| What PHI was involved? | Chart sections accessed, export type, portal events |
| Who accessed it? | Usernames, roles, IP addresses (where logged) |
| Was data exfiltrated? | Backup/export events, bulk export flags |
| Root cause? | Credential theft, misconfiguration, insider, vendor issue |

Produce a written **incident summary**: timeline, scope, data categories, number of individuals (estimate if needed), and likely cause.

---

### Step 4: Notify (as required by PHIPA)

**Who:** Clinic (custodian) with legal advice  

PHIPA requires custodians to notify affected individuals and the IPC when PHI is stolen, lost, or accessed/used/disclosed without authority, **unless** the custodian is satisfied on reasonable grounds that the breach will not cause harm (document the rationale if relying on this).

Typical notification elements:

- Description of what happened  
- PHI involved  
- Steps the clinic has taken  
- Steps individuals can take to reduce harm  
- Contact for questions  

**MediForge role:** Provide factual technical information, log extracts, and remediation status to the custodian. MediForge does not notify patients on the clinic's behalf unless explicitly agreed in writing.

**Timing:** Follow current IPC guidance and legal advice. Treat statutory deadlines as mandatory once scope is understood.

---

### Step 5: Remediate and recover

Actions may include:

- Password resets for all affected staff  
- Review and tighten role assignments (least privilege)  
- Patch configuration or deploy fixes  
- Re-enable services only after verification  
- Enhanced monitoring on affected organization  

MediForge will document platform-side fixes and share summary with affected custodians.

---

### Step 6: Post-incident review (within 30 days)

**Who:** Clinic privacy lead + MediForge  

1. Root cause analysis (5 Whys or equivalent)  
2. Control gaps identified  
3. Corrective actions with owners and dates  
4. Update policies, training, or technical controls  
5. Retain incident file per clinic retention policy  

---

## 6. Evidence preservation checklist

Preserve the following for investigation:

- [ ] Audit log export for incident date range  
- [ ] List of affected user accounts and role changes  
- [ ] Export / backup download requests and approvals  
- [ ] Email or ticket correspondence  
- [ ] Screenshots or descriptions from reporter  
- [ ] MediForge incident ticket number and timeline  
- [ ] Notification letters and IPC submission copies (custodian)  

---

## 7. Using MediForge audit tools during an investigation

1. Clinic administrator opens security / audit views for their organization.  
2. Filter by date range around the incident.  
3. Search for actions such as: `user_login`, `patient_chart_viewed`, `data_export_backup`, `data_export_patient`, failed login events.  
4. Request platform operator assistance for cross-system logs or Supabase-level review if clinic tools are insufficient.  
5. Request a **point-in-time** database assessment only through authorized platform procedures (may require service role access).

Audit logs are **append-only** at the database layer to support integrity of evidence.

---

## 8. Communication templates (outline)

Clinics should prepare templates in advance. Suggested sections:

**Internal staff alert:** Brief description, do not discuss externally, report further sightings to privacy lead.

**Affected individual letter:** Plain language, no unnecessary clinical detail, offer contact channel.

**IPC notification:** Factual summary, number of individuals, PHI types, containment, custodian contact.

MediForge can provide a **technical appendix** (timelines, systems affected, remediation) for custodian submissions.

---

## 9. Training and testing

| Activity | Frequency |
|----------|-----------|
| Staff awareness: report suspicious access | At onboarding and annually |
| Tabletop breach exercise (clinic + MediForge contact) | Annually recommended |
| Review of this procedure | Annually or after material platform change |

---

## 10. Related documents

| Document | Topic |
|----------|-------|
| `PHIPA-PRIVACY-OVERVIEW.md` | Privacy controls and audit logging |
| `DATA-CUSTODY-AND-PORTABILITY.md` | Export and offboarding |
| `DISASTER-RECOVERY-SUMMARY.md` | Recovery from data loss |
| `../../SECURITY-POLICY.md` | Security incident classification |

---

**Document owner:** MediForge platform operator  
**Clinic action:** Add local contacts; align with clinic privacy program; confirm IPC reporting process with legal counsel.

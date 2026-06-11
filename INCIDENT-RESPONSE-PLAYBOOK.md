# 🚨 Incident Response Playbook - MediForge

**Version:** 1.0  
**Last Updated:** November 15, 2025  
**Status:** Active

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Contacts](#key-contacts)
3. [Incident Severity Levels](#incident-severity-levels)
4. [Common Security Incidents](#common-security-incidents)
5. [Response Procedures](#response-procedures)
6. [Runbooks](#runbooks)
7. [Escalation Procedures](#escalation-procedures)
8. [Post-Incident Review](#post-incident-review)

---

## 📖 Overview

This playbook provides step-by-step procedures for responding to security incidents in the MediForge platform. All incidents should be handled promptly and documented for future reference.

### **Principles:**
- **Safety First:** Protect patient data and system integrity
- **Document Everything:** All actions and decisions must be logged
- **Communicate Clearly:** Keep stakeholders informed
- **Learn and Improve:** Review incidents to prevent recurrence

---

## 👥 Key Contacts

### **Platform Administrators**

| Role | Contact Method | Availability | Escalation Level |
|------|---------------|--------------|------------------|
| **Platform Owner** | Primary Email | 24/7 for Critical | Level 1 |
| **Security Administrator** | Secondary Email | Business Hours | Level 2 |
| **Technical Support** | Support Email | Business Hours | Level 3 |

**Contact Information:**
- **Primary Email:** yinka@eworkchop.com
- **Secondary Email:** security@eworkchop.com
- **Support Email:** support@mediforge.app
- **Emergency Phone:** [To be configured - add your emergency contact number]

### **External Contacts**

| Service | Contact Method | Purpose |
|---------|---------------|---------|
| **Supabase Support** | support@supabase.io | Database/Infrastructure Issues |
| **Netlify Support** | support@netlify.com | Hosting/Deployment Issues |
| **Domain Registrar** | [Provider Support] | DNS/Domain Issues |

---

## 🚦 Incident Severity Levels

### **CRITICAL (Severity 1)**
- **Response Time:** Immediate (within 15 minutes)
- **Examples:**
  - Data breach or unauthorized data access
  - Complete system outage
  - Ransomware attack
  - Critical patient data loss

### **HIGH (Severity 2)**
- **Response Time:** 1 hour
- **Examples:**
  - Multiple account lockouts
  - Failed login attacks
  - Suspicious activity patterns
  - Performance degradation affecting operations

### **MEDIUM (Severity 3)**
- **Response Time:** 4 hours
- **Examples:**
  - Single account lockout (legitimate user)
  - Minor security policy violations
  - Rate limiting triggers
  - Non-critical system errors

### **LOW (Severity 4)**
- **Response Time:** 24 hours
- **Examples:**
  - Informational security events
  - Non-security related issues
  - Performance optimizations

---

## 🔒 Common Security Incidents

### **1. Account Lockout**
- **Description:** User account locked due to failed login attempts
- **Detection:** Security dashboard, user report, audit logs
- **Runbook:** [See Account Lockout Runbook](#account-lockout-runbook)

### **2. Failed Login Attack**
- **Description:** Multiple failed login attempts from same IP/user
- **Detection:** Security monitoring dashboard, audit logs
- **Runbook:** [See Failed Login Attack Runbook](#failed-login-attack-runbook)

### **3. Unauthorized Access Attempt**
- **Description:** Attempt to access data without proper permissions
- **Detection:** Audit logs, security dashboard
- **Runbook:** [See Unauthorized Access Runbook](#unauthorized-access-runbook)

### **4. Data Breach / Leakage**
- **Description:** Patient data accessed or exposed without authorization
- **Detection:** Audit logs, user reports, security monitoring
- **Runbook:** [See Data Breach Runbook](#data-breach-runbook)

### **5. Rate Limiting Trigger**
- **Description:** User or IP blocked due to excessive requests
- **Detection:** Security dashboard, user report
- **Runbook:** [See Rate Limiting Runbook](#rate-limiting-runbook)

### **6. RPC Failure / API Error**
- **Description:** Critical database function failures
- **Detection:** Error logs, user reports, system monitoring
- **Runbook:** [See RPC Failure Runbook](#rpc-failure-runbook)

---

## 📝 Response Procedures

### **Step 1: Initial Detection**
1. Identify the incident type
2. Assess severity level
3. Document initial observations:
   - What happened?
   - When did it happen?
   - Who/what was affected?
   - How was it detected?

### **Step 2: Immediate Response**
1. **If CRITICAL:**
   - Notify platform owner immediately
   - Begin mitigation steps
   - Document all actions

2. **If HIGH/MEDIUM:**
   - Follow appropriate runbook
   - Monitor situation
   - Document actions

3. **If LOW:**
   - Document in incident log
   - Schedule for review
   - Monitor trend

### **Step 3: Investigation**
1. Review relevant logs:
   - Audit logs (`audit_logs` table)
   - Rate limit logs (`rate_limits` table)
   - Security dashboard data
   - Supabase dashboard logs

2. Gather evidence:
   - Screenshots
   - Log excerpts
   - User reports
   - System metrics

3. Identify root cause:
   - What triggered the incident?
   - Is it ongoing?
   - What is the scope?

### **Step 4: Containment**
1. Stop the threat (if ongoing)
2. Isolate affected systems/accounts
3. Prevent further damage
4. Document containment actions

### **Step 5: Resolution**
1. Restore normal operations
2. Verify system integrity
3. Unlock legitimate users (if applicable)
4. Document resolution steps

### **Step 6: Communication**
1. **Internal:** Notify team members
2. **Users:** Inform affected users (if required)
3. **Stakeholders:** Brief management (for HIGH/CRITICAL)
4. **Regulatory:** Notify authorities if data breach (follow compliance requirements)

### **Step 7: Documentation**
1. Complete incident report
2. Update audit logs
3. Document lessons learned
4. Update playbooks if needed

---

## 📚 Runbooks

### **Account Lockout Runbook**

**Scenario:** User account locked due to failed login attempts

**Steps:**

1. **Verify Legitimacy:**
   ```sql
   -- Check lockout details
   SELECT * FROM rate_limits 
   WHERE identifier = '<username>' 
   AND type = 'login' 
   AND permanent_lock = true;
   ```

2. **Review Attempt History:**
   - Go to `/security-logs`
   - Filter by username
   - Review failed login attempts

3. **If Legitimate User:**
   - Navigate to `/org-user-management` (org admin) or `/platform-dashboard` (platform admin)
   - Click "🔓 Unlock Account"
   - Verify user identity
   - Reset password if needed
   - Document unlock action

4. **If Suspicious Activity:**
   - DO NOT unlock immediately
   - Investigate IP address and user agent
   - Check for patterns (multiple IPs, different locations)
   - Document investigation
   - Escalate if needed

5. **Prevention:**
   - Educate user on password security
   - Recommend password change
   - Monitor for recurring issues

**Documentation:**
- Log unlock action in audit logs
- Note reason for lockout
- Record who unlocked and when

---

### **Failed Login Attack Runbook**

**Scenario:** Multiple failed login attempts from same IP/user

**Steps:**

1. **Identify Pattern:**
   ```sql
   -- Check failed login attempts
   SELECT username, ip_address, timestamp, details
   FROM audit_logs
   WHERE action = 'login_failed'
   AND timestamp > NOW() - INTERVAL '1 hour'
   ORDER BY timestamp DESC;
   ```

2. **Analyze Attack:**
   - Check IP address geolocation
   - Review user agent strings
   - Count attempts per IP/user
   - Determine if automated (bot) or manual

3. **Immediate Actions:**
   - **If Ongoing:** Account should auto-lock (rate limiting active)
   - **Manual Block:** Consider IP blocking at Netlify/Cloudflare level if severe
   - **Monitor:** Continue monitoring for 24 hours

4. **Investigation:**
   - Check if account exists
   - Verify if password reset was attempted
   - Look for credential stuffing patterns
   - Review security dashboard for other anomalies

5. **Response:**
   - **Account Locked:** Confirm lockout is working
   - **Account Doesn't Exist:** Ignore (failed reconnaissance)
   - **Pattern Continues:** Consider IP blocking

6. **Documentation:**
   - Record attack pattern
   - Document IP address(es)
   - Note duration and frequency
   - Update threat intelligence

---

### **Unauthorized Access Runbook**

**Scenario:** Attempt to access data without proper permissions

**Steps:**

1. **Verify Incident:**
   ```sql
   -- Check unauthorized access attempts
   SELECT * FROM audit_logs
   WHERE action LIKE '%unauthorized%' OR action LIKE '%access_attempt%'
   AND timestamp > NOW() - INTERVAL '24 hours'
   ORDER BY timestamp DESC;
   ```

2. **Assess Impact:**
   - What data was accessed?
   - Was access successful or blocked?
   - Who attempted access?
   - What was their role?

3. **Immediate Actions:**
   - **If Successful:** 
     - Revoke user permissions immediately
     - Review data access logs
     - Assess data exposure
     - Escalate to CRITICAL
   - **If Blocked:**
     - Document attempt
     - Investigate user
     - Review permissions
     - Monitor for recurrence

4. **Investigation:**
   - Review user's role and permissions
   - Check audit logs for other suspicious activity
   - Verify if user should have access
   - Check if account was compromised

5. **Remediation:**
   - **Fix Permissions:** Correct role assignments
   - **User Education:** Train user on proper access procedures
   - **Account Review:** Verify account security
   - **System Review:** Check for permission gaps

6. **Documentation:**
   - Document access attempt
   - Record remediation steps
   - Update access control policies if needed

---

### **Data Breach Runbook**

**Scenario:** Patient data accessed or exposed without authorization

**⚠️ CRITICAL - IMMEDIATE RESPONSE REQUIRED**

**Steps:**

1. **Immediate Actions (Within 15 Minutes):**
   - Isolate affected accounts/systems
   - Revoke all access for suspected accounts
   - Begin evidence collection
   - Notify platform owner immediately

2. **Investigation (Within 1 Hour):**
   ```sql
   -- Check all access to affected data
   SELECT * FROM audit_logs
   WHERE organization_id = '<affected_org_id>'
   AND timestamp BETWEEN '<start_time>' AND '<end_time>'
   ORDER BY timestamp DESC;
   ```

3. **Assess Scope:**
   - How many records accessed?
   - What type of data (PHI, PII)?
   - Timeframe of breach
   - Method of access
   - Current status (ongoing or stopped)

4. **Containment:**
   - Lock all affected accounts
   - Change passwords for affected users
   - Review and fix access controls
   - Verify breach is stopped

5. **Notification (If Required):**
   - **Regulatory:** Check local data protection laws
   - **Patients:** If required by law, notify affected patients
   - **Authorities:** Report to data protection authority if mandated
   - **Internal:** Notify management and legal team

6. **Remediation:**
   - Fix security gaps
   - Strengthen access controls
   - Implement additional monitoring
   - Review and update security policies

7. **Documentation:**
   - Complete detailed incident report
   - Document all actions taken
   - Create timeline of events
   - Prepare compliance documentation

---

### **Rate Limiting Runbook**

**Scenario:** User or IP blocked due to excessive requests

**Steps:**

1. **Verify Block:**
   ```sql
   -- Check rate limit status
   SELECT * FROM rate_limits
   WHERE type = 'login' OR type = 'intake'
   AND (permanent_lock = true OR locked_until > NOW())
   ORDER BY updated_at DESC;
   ```

2. **Determine Cause:**
   - **Login:** Too many failed attempts → Legitimate user or attack?
   - **Intake:** Too many form submissions → Legitimate or spam?

3. **If Legitimate User (Login):**
   - Verify user identity
   - Unlock account via `/org-user-management` or `/platform-dashboard`
   - Reset password if needed
   - Educate user on password security

4. **If Legitimate User (Intake):**
   - Verify submission was needed
   - Clear rate limit for user
   - Review intake form for issues
   - Monitor for abuse

5. **If Attack:**
   - **DO NOT UNLOCK**
   - Document attack pattern
   - Monitor for escalation
   - Consider IP blocking if severe

6. **Prevention:**
   - Review rate limit thresholds
   - Adjust if too restrictive or too permissive
   - Monitor patterns
   - Update thresholds based on legitimate usage

---

### **RPC Failure Runbook**

**Scenario:** Critical database function failures

**Steps:**

1. **Identify Failure:**
   - Check Netlify function logs
   - Review Supabase dashboard logs
   - Check user error reports
   - Review audit logs for errors

2. **Determine Scope:**
   - Which RPC is failing?
   - How many users affected?
   - Is it affecting all users or specific scenarios?
   - When did it start?

3. **Investigation:**
   ```sql
   -- Check recent errors (if logged)
   SELECT * FROM audit_logs
   WHERE action LIKE '%error%' OR action LIKE '%fail%'
   AND timestamp > NOW() - INTERVAL '1 hour'
   ORDER BY timestamp DESC;
   ```

4. **Common Causes:**
   - **Database Connection Issues:** Check Supabase status
   - **Parameter Errors:** Verify RPC inputs
   - **Permission Issues:** Check RLS policies
   - **Timeout:** Check query performance
   - **Schema Changes:** Verify migrations applied

5. **Resolution:**
   - **Connection Issues:** Wait for Supabase recovery
   - **Parameter Errors:** Fix client-side code
   - **Permission Issues:** Review and fix RLS policies
   - **Performance:** Optimize slow queries
   - **Schema:** Apply missing migrations

6. **Verification:**
   - Test RPC manually
   - Verify affected functionality works
   - Monitor for recurrence
   - Check error rates

7. **Prevention:**
   - Add better error handling
   - Improve input validation
   - Add retry logic
   - Monitor RPC performance

---

## 📞 Escalation Procedures

### **Escalation Matrix**

| Severity | Initial Response | Escalate To | Escalation Time |
|----------|-----------------|-------------|-----------------|
| **CRITICAL** | Platform Owner | External Security Firm | 30 minutes |
| **HIGH** | Security Admin | Platform Owner | 2 hours |
| **MEDIUM** | Technical Support | Security Admin | 8 hours |
| **LOW** | Automated Monitoring | Technical Support | 24 hours |

### **When to Escalate:**

1. **Escalate UP if:**
   - Incident exceeds response capabilities
   - Data breach confirmed
   - Legal/compliance issues arise
   - Multiple systems affected
   - Resolution requires external expertise

2. **Escalate DOWN if:**
   - Initial severity assessment was incorrect
   - Issue resolved quickly
   - False positive detected

---

## 📊 Post-Incident Review

### **Review Timeline**

- **Immediate (Within 24 hours):** Quick summary of what happened
- **Detailed (Within 1 week):** Complete incident report
- **Lessons Learned (Within 2 weeks):** Update playbooks and procedures

### **Review Questions**

1. **What Happened?**
   - Timeline of events
   - Root cause analysis
   - Impact assessment

2. **What Went Well?**
   - Effective response steps
   - Good decisions made
   - Helpful tools/resources

3. **What Could Improve?**
   - Response time issues
   - Communication gaps
   - Missing procedures
   - Tool limitations

4. **Action Items:**
   - Immediate fixes needed
   - Long-term improvements
   - Process updates
   - Training needs

### **Incident Report Template**

```markdown
# Incident Report: [INCIDENT-ID]

**Date:** [Date]
**Severity:** [CRITICAL/HIGH/MEDIUM/LOW]
**Status:** [RESOLVED/INVESTIGATING/MONITORING]

## Summary
[Brief description of incident]

## Timeline
- [Time]: Event occurred
- [Time]: Detected
- [Time]: Response initiated
- [Time]: Resolved

## Impact
- Affected Systems: [List]
- Affected Users: [Count/List]
- Data Affected: [Type/Amount]

## Root Cause
[Analysis of what caused the incident]

## Response Actions
1. [Action taken]
2. [Action taken]
3. [Action taken]

## Resolution
[How incident was resolved]

## Prevention
[Steps to prevent recurrence]

## Lessons Learned
[Key takeaways]
```

---

## 🔄 Maintenance

### **Regular Updates Required:**

- **Monthly:** Review and update key contacts
- **Quarterly:** Review all runbooks for accuracy
- **After Each Incident:** Update relevant runbooks
- **Annually:** Complete playbook review and update

### **Version History**

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2025-11-15 | Initial playbook creation | Platform Team |

---

## 📞 Emergency Contacts

**Platform Owner:** yinka@eworkchop.com  
**Emergency Hotline:** [To be configured - add your emergency contact number]  
**Support Email:** support@mediforge.app  
**Security Team:** security@eworkchop.com  

**⚠️ For CRITICAL incidents, contact Platform Owner immediately.**

---

**END OF PLAYBOOK**


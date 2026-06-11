# 📊 Supabase Built-in Log Monitoring Guide

**Purpose:** Monitor security events using Supabase's built-in logging (no external services required)

---

## 🎯 Quick Start

### **Access Supabase Logs**

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Logs** → **API Logs** or **Postgres Logs**

---

## 🔍 Useful Log Queries

### **1. Failed Login Attempts**

**Location:** Supabase Dashboard → Logs → API Logs

**What to Look For:**
- HTTP status code: `401` (Unauthorized)
- Path: `/auth/v1/token` with `grant_type=password`
- Error messages: "Invalid login credentials"

**Filter Query:**
```
status_code:401 AND path:/auth/v1/token
```

### **2. RPC Function Failures**

**Location:** Supabase Dashboard → Logs → Postgres Logs

**What to Look For:**
- Error messages containing function names
- Common errors:
  - `function "get_patients_for_org" does not exist`
  - `permission denied for function`
  - `syntax error`

**Monitor These Functions:**
- `check_rate_limit`
- `record_rate_limit_attempt`
- `unlock_account`
- `get_audit_logs`
- `get_patients_for_org`
- `get_organizations_with_owner`

### **3. Unusual Access Patterns**

**What to Monitor:**
- Multiple requests from same IP in short time
- Requests from new/unusual IP addresses
- Requests with unusual user agents
- Requests during off-hours (if applicable)

**Location:** API Logs → Filter by IP address or user agent

---

## 📈 Setting Up Alerts (Supabase Dashboard)

### **Method 1: Manual Monitoring**

1. **Set Up Daily Checks:**
   - Check Logs dashboard daily
   - Review failed login attempts
   - Check for RPC errors
   - Monitor rate limit triggers

2. **Weekly Review:**
   - Analyze patterns
   - Review security dashboard data
   - Check for trends

### **Method 2: Email Notifications (Supabase Project Settings)**

1. Go to **Project Settings** → **Notifications**
2. Configure email alerts for:
   - **Critical Errors:** Database connection issues
   - **Performance Issues:** Slow queries
   - **API Errors:** Failed authentication

**Note:** Supabase's built-in notifications are limited. For advanced alerting, consider Logflare (see separate guide).

---

## 🔐 Security Event Queries

### **Query 1: Failed Logins in Last 24 Hours**

**In Your Application:**
- Navigate to: `/security-logs`
- Filter by: "Failed Logins"
- Time range: "Last 24 Hours"

**In Supabase Dashboard:**
- Logs → API Logs
- Filter: `status_code:401 AND timestamp:>NOW()-24h`

### **Query 2: Rate Limit Triggers**

**In Your Application:**
- Navigate to: `/security-monitoring`
- Check "Locked Accounts" stat card
- Review locked accounts table

**Direct SQL (if you have database access):**
```sql
SELECT * FROM rate_limits
WHERE permanent_lock = true
OR (locked_until IS NOT NULL AND locked_until > NOW())
ORDER BY updated_at DESC;
```

### **Query 3: Unauthorized Access Attempts**

**In Your Application:**
- Navigate to: `/audit-log-details?filter=unauthorized_access_attempt`
- Review unauthorized access events

**Direct SQL:**
```sql
SELECT * FROM audit_logs
WHERE action LIKE '%unauthorized%' OR action LIKE '%access_attempt%'
AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

---

## 🚨 When to Investigate

### **Immediate Investigation Required:**
- 10+ failed logins from same IP in 1 hour
- Multiple account lockouts within minutes
- RPC failures affecting user operations
- Unusual error patterns

### **Monitor and Review:**
- Occasional failed logins (1-5 per hour)
- Single account lockouts (legitimate users)
- Non-critical RPC warnings
- Normal rate limiting activity

---

## 📝 Best Practices

1. **Daily Checks:** Review security dashboard every morning
2. **Weekly Analysis:** Review patterns and trends
3. **Document Findings:** Note any anomalies
4. **Follow Playbook:** Use INCIDENT-RESPONSE-PLAYBOOK.md for incidents

---

## 🔄 Next Steps (Optional)

For advanced monitoring, consider:
- **Logflare Integration:** Advanced log queries and dashboards
- **Email Alerts:** Automated notifications for critical events
- **Webhook Notifications:** Real-time alerts to Slack/Discord

See separate guides for implementation.

---

**Note:** This guide uses Supabase's built-in logging, which is **FREE** and requires **NO additional setup**. For advanced features, Logflare is optional but not required for basic monitoring.


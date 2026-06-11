# 🔍 Logflare Setup Guide (Optional Advanced Monitoring)

**Status:** Optional - Supabase built-in logs are sufficient for basic monitoring  
**Cost:** Free tier available, paid plans for advanced features  
**Complexity:** Medium - requires Supabase dashboard configuration

---

## 🤔 What is Logflare?

**Logflare** is a log management platform that Supabase acquired. It provides:

- **Advanced Log Queries:** More powerful search and filtering
- **Custom Dashboards:** Visualize your logs
- **Real-time Alerts:** Get notified immediately of issues
- **Long-term Storage:** Keep logs longer than default retention

**IMPORTANT:** You **DO NOT NEED** Logflare for basic monitoring. Supabase's built-in logs are sufficient. Only set this up if you need:
- Advanced query capabilities
- Custom alert rules
- Long-term log retention
- Multiple project aggregation

---

## ✅ Prerequisites

- Supabase project with admin access
- Basic understanding of SQL/log queries
- Optional: Logflare account (free tier available)

---

## 📋 Setup Steps (If You Want to Proceed)

### **Option 1: Using Supabase Dashboard (Simplest)**

Logflare is integrated into Supabase, so you can access it through:

1. **Supabase Dashboard → Logs**
   - This already shows Logflare-powered logs
   - No additional setup needed
   - Basic queries available

### **Option 2: Standalone Logflare (Advanced)**

1. **Create Logflare Account:**
   - Go to: https://logflare.app
   - Sign up for free account
   - Connect your Supabase project

2. **Enable Logflare in Supabase:**
   - Go to Supabase Dashboard → Settings → Integrations
   - Enable Logflare integration
   - Copy API keys

3. **Configure Log Sources:**
   - API Logs
   - Postgres Logs
   - Auth Logs

4. **Set Up Queries:**
   - Create saved queries for:
     - Failed logins
     - RPC failures
     - Rate limit triggers
     - Unauthorized access

5. **Configure Alerts:**
   - Set alert rules for:
     - 10+ failed logins per hour
     - Critical RPC failures
     - Unusual access patterns

---

## 🎯 Recommended Queries

### **Query 1: Failed Login Attempts**
```
status_code:401 AND path:/auth/v1/token
```

### **Query 2: Rate Limit Triggers**
```
action:rate_limit_exceeded OR action:account_lockout
```

### **Query 3: RPC Errors**
```
error:* AND function:check_rate_limit OR function:get_audit_logs
```

---

## ⚠️ Recommendation

**For MediForge, we recommend:**

1. **Start with Supabase Built-in Logs** (FREE, already working)
   - Use the SUPABASE-MONITORING-GUIDE.md
   - Monitor through your security dashboards (`/security-monitoring`, `/security-logs`)

2. **Add Logflare Later** (if needed)
   - Only if you need advanced features
   - After you've established baseline monitoring
   - If you need long-term log retention

3. **Focus on Application-Level Monitoring** (what we've built)
   - Security dashboards
   - Audit logs
   - Rate limiting
   - Account management

---

## 🔗 Resources

- **Logflare Documentation:** https://logflare.app/docs
- **Supabase Logs Guide:** https://supabase.com/docs/guides/platform/logs
- **Logflare Pricing:** Free tier includes basic features

---

**Bottom Line:** You can achieve excellent security monitoring **WITHOUT** Logflare by using:
1. Supabase built-in logs (dashboard)
2. Your security dashboards (`/security-monitoring`, `/security-logs`)
3. Audit logs in your database
4. Rate limiting system

Logflare is an **optional enhancement**, not a requirement.


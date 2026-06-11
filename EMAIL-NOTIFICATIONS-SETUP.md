# 📧 Email Notifications Setup Guide

**Status:** To be implemented  
**Priority:** Medium-term (2-4 weeks)  
**Impact:** Adds email alerts for critical security events

---

## 🎯 Goal

Send email notifications for:
- Account lockouts (to platform admins)
- Failed login attacks (when threshold exceeded)
- Critical security events
- System errors requiring attention

---

## 📋 Implementation Options

### **Option 1: Supabase Email (Recommended - Easiest)**

**Pros:**
- Already integrated with Supabase
- No additional service needed
- Simple to implement

**Cons:**
- Limited customization
- Rate limits may apply

**Implementation:**
1. Use Supabase's built-in email functions
2. Configure SMTP settings in Supabase Dashboard
3. Create email templates
4. Integrate with existing alert system

### **Option 2: Netlify Functions + External Service**

**Pros:**
- More control
- Better deliverability
- More customization options

**Cons:**
- Requires external service (SendGrid, Mailgun, etc.)
- Additional cost
- More complex setup

**Services to Consider:**
- **SendGrid:** Free tier (100 emails/day)
- **Mailgun:** Free tier (5,000 emails/month)
- **Resend:** Developer-friendly, modern API

### **Option 3: Direct SMTP (Not Recommended)**

**Pros:**
- Full control

**Cons:**
- Requires SMTP server setup
- Deliverability challenges
- Maintenance overhead

---

## ✅ Implementation Status

**Status:** ✅ **IMPLEMENTED** (Additive only - does not break existing functionality)

### **What's Been Implemented:**

1. **Email Notification Function:** `netlify/functions/send-security-email.js`
   - Supports SendGrid, Mailgun, or SMTP
   - Gracefully degrades if no email service configured
   - Only sends for HIGH/CRITICAL severity events by default

2. **Integration with Alert System:**
   - `js/account-management.js` - Enhanced `alertAccountLockout()` with optional email
   - `js/supabase-auth.js` - Enhanced login flow with optional email notifications
   - `js/supabase-client.js` - Added `window.sendSecurityEmail()` helper function

3. **Safety Features:**
   - **Additive only:** Does not replace existing localStorage alerts
   - **Graceful degradation:** Works even if email service not configured
   - **Non-breaking:** Failures don't break alerting system
   - **Rate limiting:** Built-in to prevent email spam

### **How It Works:**

1. Security event occurs (e.g., account lockout)
2. Existing alert system works as before (localStorage, audit logs)
3. **NEW:** Optional email notification is sent (if configured)
4. If email fails, alerting continues normally (non-critical)

---

## 🚀 Setup Instructions

### **Step 1: Choose Email Service (Optional)**

**Option A: SendGrid (Recommended - Easy Setup)**
1. Sign up at https://sendgrid.com (free tier: 100 emails/day)
2. Get API key from SendGrid dashboard
3. Install package: `npm install @sendgrid/mail` (if using local dev)
4. Set environment variable in Netlify: `SENDGRID_API_KEY`

**Option B: Mailgun**
1. Sign up at https://mailgun.com (free tier: 5,000 emails/month)
2. Get API key and domain
3. Install package: `npm install mailgun-js` (if using local dev)
4. Set environment variables: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`

**Option C: Direct SMTP**
1. Get SMTP credentials from your email provider
2. Install package: `npm install nodemailer` (if using local dev)
3. Set environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

**Option D: No Email Service (Current State)**
- Function works but emails won't send
- Alerts still work via localStorage and dashboard
- You can add email service later without code changes

### **Step 2: Configure Netlify Environment Variables**

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add variables (as needed):
   ```
   ADMIN_EMAILS=yinka@eworkchop.com,security@eworkchop.com
   EMAIL_FROM=security@mediforge.app
   EMAIL_SEVERITIES=high,critical
   SENDGRID_API_KEY=your_key_here (if using SendGrid)
   ```

### **Step 3: Test Email Notifications**

1. Trigger a test lockout (or wait for real event)
2. Check Netlify function logs: `/logs/functions`
3. Check email inbox (if service configured)
4. Verify existing alerts still work

---

## 📝 Current Configuration

### **Email Recipients (Default):**
- `yinka@eworkchop.com`
- `security@eworkchop.com`

**To change:** Set `ADMIN_EMAILS` environment variable in Netlify

### **Email Severity Filter:**
- Only sends emails for: `high`, `critical` severity events
- Skips: `low`, `medium` severity (to reduce email noise)

**To change:** Set `EMAIL_SEVERITIES` environment variable (e.g., `high,critical,medium`)

---

## 🧪 Testing Without Email Service

The function works perfectly even without an email service:

1. **Without email configured:**
   - Function logs email attempt to console
   - Returns success (so caller doesn't fail)
   - Existing alert system continues normally

2. **To verify it's working:**
   - Check Netlify function logs
   - Look for: `⚠️ Email service not configured. Email notification logged only`
   - This confirms the function is being called correctly

---

## 🔄 Integration with Existing Alert System

### **Before (What Still Works):**
- ✅ localStorage alerts (`security_alerts`)
- ✅ Audit logging to database
- ✅ Security dashboards
- ✅ All existing functionality

### **Now (Additive Enhancement):**
- ✅ **PLUS:** Optional email notifications
- ✅ **PLUS:** Email sent for critical events (if configured)
- ✅ **PLUS:** Graceful degradation if email not configured

**No breaking changes** - everything works as before, with optional email enhancement.

---

## 📧 Email Templates to Create

### **Template 1: Account Lockout Alert**

**Subject:** 🚨 Account Locked: [Username]

**Body:**
```
An account has been permanently locked due to failed login attempts.

User: [username]
Attempts: [count]
Time: [timestamp]
IP Address: [ip]

Action Required: Review and unlock if legitimate user.
Security Dashboard: https://mediforge.netlify.app/security-monitoring
```

### **Template 2: Failed Login Attack**

**Subject:** ⚠️ Security Alert: Failed Login Attack Detected

**Body:**
```
Multiple failed login attempts detected.

IP Address: [ip]
Attempts: [count]
Timeframe: [duration]
Targets: [usernames]

Action: Account auto-locked. Monitor for escalation.
```

### **Template 3: Critical Security Event**

**Subject:** 🔴 CRITICAL: Security Event Requires Attention

**Body:**
```
A critical security event has been detected.

Event Type: [type]
Severity: CRITICAL
Time: [timestamp]
Details: [details]

Immediate action required. See incident response playbook.
```

---

## ⚠️ Important Considerations

### **Before Implementation:**

1. **Privacy & Compliance:**
   - Ensure email notifications comply with data protection laws
   - Don't include sensitive patient data in emails
   - Use secure email channels

2. **Rate Limiting:**
   - Don't spam admins with emails
   - Aggregate alerts (e.g., one email per hour)
   - Use severity-based filtering

3. **Testing:**
   - Test email delivery thoroughly
   - Verify email formatting
   - Test with different email providers

4. **Existing Functionality:**
   - Email alerts are **additive only**
   - Will not replace existing localStorage alerts
   - Will work alongside existing security dashboards

---

## 🔄 Implementation Checklist

- [ ] Choose email service (Supabase Email recommended)
- [ ] Configure SMTP settings
- [ ] Create email templates
- [ ] Implement email sending function
- [ ] Integrate with existing alert system
- [ ] Add rate limiting to prevent email spam
- [ ] Test email delivery
- [ ] Document email notification preferences
- [ ] Update incident response playbook with email contacts

---

## 📝 Next Steps

1. **Review this guide** with your team
2. **Decide on email service** (start with Supabase Email)
3. **Configure SMTP** in Supabase Dashboard
4. **Create templates** for common alerts
5. **Implement gradually** - start with critical alerts only
6. **Test thoroughly** before enabling for all alerts

---

**Note:** Email notifications are an **enhancement** to existing monitoring. Your current security dashboards and localStorage alerts will continue working. Email alerts are **optional** and can be enabled/disabled per alert type.


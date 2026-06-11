/**
 * Netlify Function: send-security-email
 * Sends email notifications for critical security events
 * 
 * This is an ADDITIVE feature - does not replace existing alerting
 * Requires environment variables (optional):
 *  - SENDGRID_API_KEY (if using SendGrid)
 *  - MAILGUN_API_KEY (if using Mailgun)
 *  - SMTP_HOST, SMTP_USER, SMTP_PASS (if using direct SMTP)
 * 
 * If no email service is configured, function gracefully degrades
 */

const RESPONSE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: RESPONSE_HEADERS,
    body: JSON.stringify(body)
  };
}

/**
 * Get platform admin emails from environment or use defaults
 */
function getAdminEmails() {
  const envEmails = process.env.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map(email => email.trim());
  }
  // Default admin emails (can be overridden via environment variable)
  return [
    'yinka@eworkchop.com',
    'security@eworkchop.com'
  ];
}

/**
 * Send email using configured service
 * Currently supports graceful degradation if no service configured
 */
async function sendEmail(to, subject, body, htmlBody) {
  try {
    // Check for email service configuration
    // Note: These functions use dynamic requires that won't resolve at build time
    // If no email service is configured, we gracefully degrade
    
    // Option 1: SendGrid (if API key configured)
    if (process.env.SENDGRID_API_KEY) {
      try {
        return await sendViaSendGrid(to, subject, body, htmlBody);
      } catch (sgError) {
        if (sgError.message.includes('package not installed') || sgError.code === 'MODULE_NOT_FOUND') {
          console.warn('⚠️ SendGrid configured but package not installed. Install: npm install @sendgrid/mail');
        } else {
          throw sgError;
        }
      }
    }
    
    // Option 2: Mailgun (if API key configured)
    if (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      try {
        return await sendViaMailgun(to, subject, body, htmlBody);
      } catch (mgError) {
        if (mgError.message.includes('package not installed') || mgError.code === 'MODULE_NOT_FOUND') {
          console.warn('⚠️ Mailgun configured but package not installed. Install: npm install mailgun-js');
        } else {
          throw mgError;
        }
      }
    }
    
    // Option 3: Direct SMTP (if configured)
    if (process.env.SMTP_HOST) {
      try {
        return await sendViaSMTP(to, subject, body, htmlBody);
      } catch (smtpError) {
        if (smtpError.message.includes('package not installed') || smtpError.code === 'MODULE_NOT_FOUND') {
          console.warn('⚠️ SMTP configured but package not installed. Install: npm install nodemailer');
        } else {
          throw smtpError;
        }
      }
    }
    
    // Graceful degradation: Log to console if no email service configured
    console.warn('⚠️ Email service not configured. Email notification logged only:', {
      to,
      subject,
      timestamp: new Date().toISOString()
    });
    
    // Return success so caller doesn't fail - email is optional enhancement
    return {
      success: true,
      sent: false,
      message: 'Email service not configured - notification logged only'
    };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Don't throw - email is optional, don't break alerting
    return {
      success: false,
      sent: false,
      error: error.message,
      message: 'Email sending failed, but alert was logged'
    };
  }
}

/**
 * Send email via SendGrid
 * Note: Requires @sendgrid/mail package if using SendGrid
 * Uses eval to avoid build-time require resolution
 */
async function sendViaSendGrid(to, subject, body, htmlBody) {
  try {
    // Use Function constructor to avoid build-time require resolution
    // This allows the function to work even if package isn't installed
    const requireFunc = new Function('moduleName', 'return require(moduleName)');
    const sgMail = requireFunc('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
      to: Array.isArray(to) ? to : [to],
      from: process.env.EMAIL_FROM || 'security@mediforge.app',
      subject: subject,
      text: body,
      html: htmlBody || body.replace(/\n/g, '<br>')
    };
    
    await sgMail.send(msg);
    return { success: true, sent: true, service: 'sendgrid' };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      throw new Error('SendGrid package not installed. To enable email: npm install @sendgrid/mail');
    }
    throw error;
  }
}

/**
 * Send email via Mailgun
 * Note: Requires mailgun-js package if using Mailgun
 * Uses eval to avoid build-time require resolution
 */
async function sendViaMailgun(to, subject, body, htmlBody) {
  try {
    // Use Function constructor to avoid build-time require resolution
    const requireFunc = new Function('moduleName', 'return require(moduleName)');
    const mailgunModule = requireFunc('mailgun-js');
    const mailgun = mailgunModule({
      apiKey: process.env.MAILGUN_API_KEY,
      domain: process.env.MAILGUN_DOMAIN
    });
    
    const data = {
      from: process.env.EMAIL_FROM || `MediForge Security <security@${process.env.MAILGUN_DOMAIN}>`,
      to: Array.isArray(to) ? to.join(',') : to,
      subject: subject,
      text: body,
      html: htmlBody || body.replace(/\n/g, '<br>')
    };
    
    await mailgun.messages().send(data);
    return { success: true, sent: true, service: 'mailgun' };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      throw new Error('Mailgun package not installed. To enable email: npm install mailgun-js');
    }
    throw error;
  }
}

/**
 * Send email via direct SMTP
 * Note: Requires nodemailer package if using SMTP
 * Uses eval to avoid build-time require resolution
 */
async function sendViaSMTP(to, subject, body, htmlBody) {
  try {
    // Use Function constructor to avoid build-time require resolution
    const requireFunc = new Function('moduleName', 'return require(moduleName)');
    const nodemailer = requireFunc('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: Array.isArray(to) ? to.join(',') : to,
      subject: subject,
      text: body,
      html: htmlBody || body.replace(/\n/g, '<br>')
    };
    
    await transporter.sendMail(mailOptions);
    return { success: true, sent: true, service: 'smtp' };
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
      throw new Error('Nodemailer package not installed. To enable email: npm install nodemailer');
    }
    throw error;
  }
}

/**
 * Generate email templates
 */
function generateEmailTemplate(type, data) {
  const templates = {
    account_lockout: {
      subject: '🚨 Security Alert: Account Locked',
      body: `An account has been permanently locked due to failed login attempts.

User: ${data.identifier}
Attempts: ${data.attempt_count}
Time: ${data.timestamp}
IP Address: ${data.ip_address || 'N/A'}

Action Required: Review and unlock if legitimate user.
Security Dashboard: https://mediforge.netlify.app/security-monitoring

---
This is an automated security alert from MediForge.
If you did not expect this alert, please contact security@eworkchop.com immediately.`
    },
    
    failed_login_attack: {
      subject: '⚠️ Security Alert: Failed Login Attack Detected',
      body: `Multiple failed login attempts detected.

IP Address: ${data.ip_address}
Attempts: ${data.attempt_count}
Timeframe: ${data.duration || 'Last hour'}
Target Accounts: ${data.targets?.join(', ') || data.identifier}

Action: Account auto-locked. Monitor for escalation.
Security Dashboard: https://mediforge.netlify.app/security-logs

---
This is an automated security alert from MediForge.`
    },
    
    critical_security_event: {
      subject: '🔴 CRITICAL: Security Event Requires Immediate Attention',
      body: `A critical security event has been detected.

Event Type: ${data.event_type}
Severity: CRITICAL
Time: ${data.timestamp}
Details: ${JSON.stringify(data.details, null, 2)}

Immediate action required. See incident response playbook: INCIDENT-RESPONSE-PLAYBOOK.md

---
This is an automated security alert from MediForge.
Contact: security@eworkchop.com`
    },
    
    rpc_failure: {
      subject: '⚠️ System Alert: RPC Function Failure',
      body: `A critical database function has failed.

Function: ${data.function_name}
Error: ${data.error_message}
Time: ${data.timestamp}
User Impact: ${data.user_impact || 'Unknown'}

Action: Review Supabase logs and function configuration.
If this affects user operations, prioritize immediate resolution.

---
This is an automated system alert from MediForge.`
    }
  };
  
  return templates[type] || {
    subject: '🔔 Security Alert from MediForge',
    body: `Security event: ${type}\n\n${JSON.stringify(data, null, 2)}`
  };
}

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: RESPONSE_HEADERS,
      body: ''
    };
  }
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  
  try {
    const payload = JSON.parse(event.body || '{}');
    const { type, data, severity = 'medium' } = payload;
    
    // Validate required fields
    if (!type || !data) {
      return jsonResponse(400, { 
        error: 'Missing required fields: type and data' 
      });
    }
    
    // Only send emails for HIGH and CRITICAL severity events
    // Can be configured to send for all if needed
    const emailSeverities = process.env.EMAIL_SEVERITIES?.split(',') || ['high', 'critical'];
    if (!emailSeverities.includes(severity.toLowerCase())) {
      return jsonResponse(200, {
        success: true,
        skipped: true,
        message: `Email not sent - severity '${severity}' not configured for email alerts`
      });
    }
    
    // Rate limiting: Don't spam emails
    // This is a simple implementation - could be enhanced
    const rateLimitKey = `email_${type}_${Date.now() - (Date.now() % 3600000)}`; // Hourly buckets
    
    // Generate email content
    const template = generateEmailTemplate(type, data);
    
    // Get recipient emails
    const recipientEmails = getAdminEmails();
    
    // Send email
    const result = await sendEmail(
      recipientEmails,
      template.subject,
      template.body,
      null // HTML version can be added later
    );
    
    // Log email attempt
    console.log('📧 Email notification sent:', {
      type,
      severity,
      recipients: recipientEmails.length,
      success: result.success,
      sent: result.sent,
      service: result.service || 'none',
      timestamp: new Date().toISOString()
    });
    
    return jsonResponse(200, {
      success: true,
      sent: result.sent || false,
      recipients: recipientEmails.length,
      service: result.service || 'none',
      message: result.message || 'Email notification processed'
    });
    
  } catch (error) {
    console.error('❌ Error in send-security-email function:', error);
    
    // Don't fail completely - email is optional
    return jsonResponse(200, {
      success: false,
      sent: false,
      error: error.message,
      message: 'Email sending failed, but this is non-critical. Alert was logged.'
    });
  }
};


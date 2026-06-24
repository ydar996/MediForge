/**
 * Netlify Function: claims-batch-daily
 * Processes draft OHIP claims for batch MCEDT submission when integration is enabled.
 * Trigger: GET/POST /.netlify/functions/claims-batch-daily?key=CRON_SECRET
 */

const CRON_SECRET = process.env.CRON_SECRET || process.env.CLAIMS_BATCH_CRON_SECRET;
const billing = require('../../lib/billing');
const { IntegrationService } = require('../../lib/integrations/IntegrationService');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const base = SUPABASE_URL.replace(/\/$/, '');
  const res = await fetch(`${base}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'return=representation',
      ...options.headers
    }
  });
  if (!res.ok) return null;
  return res.json();
}

exports.handler = async (event) => {
  if (CRON_SECRET) {
    const key = event.queryStringParameters?.key;
    if (key !== CRON_SECRET) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
  }

  try {
    const drafts =
      (await supabaseFetch(
        '/insurance_claims?status=eq.draft&payer_code=eq.OHIP&select=*&limit=100'
      )) || [];

    const service = new IntegrationService({ supabase: null });
    const batch = billing.claimsWorkflow.buildBatchFromClaimRecords(drafts, {
      billingNumber: process.env.OHIP_DEFAULT_BILLING_NUMBER || ''
    });
    const result = await service.batchSubmitClaims({
      claimRecords: drafts,
      submitter: { billingNumber: process.env.OHIP_DEFAULT_BILLING_NUMBER || '' },
      organizationId: 'system',
      userId: 'claims-batch-daily'
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        draftCount: drafts.length,
        queued: result.queued,
        submitted: result.submitted,
        claimCount: batch.claims?.length || 0
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

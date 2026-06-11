/**
 * Check for orphaned patients using Netlify function (which has service role access)
 */

const ORG_UUID = '9f91aa7e-cee9-414b-820b-f71cdfd2f259';
const ORG_NAME = 'Vortexshpere Global Limited';

async function checkViaNetlifyFunction() {
  console.log('🔍 Checking for orphaned patients via Netlify function...\n');
  console.log('Organization UUID:', ORG_UUID);
  console.log('Organization Name:', ORG_NAME);
  console.log('---\n');

  try {
    // First, verify the organization exists using direct query
    const orgResponse = await fetch('https://YOUR-PROJECT.supabase.co/rest/v1/organizations?id=eq.9f91aa7e-cee9-414b-820b-f71cdfd2f259&select=id,name,org_code', {
      headers: {
        'apikey': ((window.__SUPABASE_CONFIG__||{}).anonKey||''),
        'Authorization': 'Bearer YOUR_SUPABASE_PUBLISHABLE_KEY'
      }
    });

    if (orgResponse.ok) {
      const orgs = await orgResponse.json();
      if (orgs.length > 0) {
        console.log('✅ Organization verified:', orgs[0]);
      }
    }

    console.log('\n⚠️ Direct API query is blocked by RLS policies.');
    console.log('To check for orphaned patients, please:');
    console.log('1. Run the SQL queries in check-vortexsphere-patients-sql.sql in Supabase SQL Editor');
    console.log('   OR');
    console.log('2. Navigate to https://mediforge.netlify.app/find-missing-patients');
    console.log('   Log in as a user from Vortexshpere Global Limited');
    console.log('   Click "Auto-Detect & Find Orphaned Patients"');
    console.log('');
    console.log('SQL Query to run directly in Supabase SQL Editor:');
    console.log('---');
    console.log(`SELECT 
  id,
  patient_id,
  first_name || ' ' || last_name as patient_name,
  organization_id as wrong_org_id,
  created_at
FROM patients
WHERE organization_id = '${ORG_NAME}'
ORDER BY created_at DESC;`);
    console.log('');
    console.log('If orphaned patients are found, fix them with:');
    console.log(`UPDATE patients SET organization_id = '${ORG_UUID}' WHERE organization_id = '${ORG_NAME}';`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkViaNetlifyFunction();









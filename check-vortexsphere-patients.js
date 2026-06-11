/**
 * Script to check for orphaned patients for Vortexshpere Global Limited
 * Organization details provided:
 * - ID: 9f91aa7e-cee9-414b-820b-f71cdfd2f259
 * - Name: Vortexshpere Global Limited (or Vortexsphere Global Limited)
 * - Org Code: ORGJYA32DNP
 * - Country: Nigeria
 * - Status: active
 * - Created: 11/15/2025, 1:07:12 PM
 * - Owner: Vsgcare
 */

const SUPABASE_URL = ((window.__SUPABASE_CONFIG__||{}).url||'');
const SUPABASE_ANON_KEY = ((window.__SUPABASE_CONFIG__||{}).anonKey||'');

const ORG_UUID = '9f91aa7e-cee9-414b-820b-f71cdfd2f259';
const ORG_NAME_VARIANTS = [
  'Vortexshpere Global Limited',
  'Vortexsphere Global Limited',
  'Vortexshpere Global Limited', // exact match
];

async function checkOrphanedPatients() {
  console.log('🔍 Checking for orphaned patients for Vortexshpere Global Limited...\n');
  console.log('Organization UUID:', ORG_UUID);
  console.log('Organization Name Variants:', ORG_NAME_VARIANTS.join(', '));
  console.log('---\n');

  try {
    // Method 1: Query via Supabase REST API (check for patients with org name as organization_id)
    const orgNameEncoded = encodeURIComponent(ORG_NAME_VARIANTS[0]);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=*&organization_id=eq.${orgNameEncoded}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const patients = await response.json();
    
    console.log(`\n📊 SEARCH RESULTS:\n`);
    console.log(`Found ${patients.length} patients with organization_id = "${ORG_NAME_VARIANTS[0]}" (WRONG - using org name instead of UUID)\n`);

    if (patients.length > 0) {
      console.log('⚠️ ORPHANED PATIENTS FOUND:\n');
      console.log('These patients need to be fixed:\n');
      
      patients.forEach((patient, index) => {
        console.log(`${index + 1}. Patient ID: ${patient.patient_id || patient.id}`);
        console.log(`   Name: ${patient.first_name} ${patient.last_name}`);
        console.log(`   Current organization_id (WRONG): ${patient.organization_id}`);
        console.log(`   Should be: ${ORG_UUID}`);
        console.log(`   Created: ${new Date(patient.created_at).toLocaleString()}`);
        console.log('');
      });

      console.log('\n✅ FIX REQUIRED:');
      console.log(`UPDATE patients SET organization_id = '${ORG_UUID}' WHERE organization_id = '${ORG_NAME_VARIANTS[0]}';`);
      console.log(`\nThis will fix ${patients.length} patient(s).\n`);

      // Also check for patients with correct UUID
      const uuidEncoded = encodeURIComponent(ORG_UUID);
      const correctResponse = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=*&organization_id=eq.${uuidEncoded}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });

      if (correctResponse.ok) {
        const correctPatients = await correctResponse.json();
        console.log(`✅ Found ${correctPatients.length} patients with CORRECT organization UUID`);
        if (correctPatients.length > 0) {
          console.log('These patients are correctly associated:\n');
          correctPatients.forEach((patient, index) => {
            console.log(`${index + 1}. ${patient.first_name} ${patient.last_name} (ID: ${patient.patient_id || patient.id})`);
          });
        }
      }
    } else {
      console.log('✅ No orphaned patients found! All patients appear to have correct organization_id.\n');
      
      // Check if there are any patients at all with correct UUID
      const uuidEncoded = encodeURIComponent(ORG_UUID);
      const correctResponse = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=*&organization_id=eq.${uuidEncoded}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });

      if (correctResponse.ok) {
        const correctPatients = await correctResponse.json();
        console.log(`✅ Found ${correctPatients.length} patients with CORRECT organization UUID`);
        if (correctPatients.length > 0) {
          console.log('These patients are correctly associated:\n');
          correctPatients.forEach((patient, index) => {
            console.log(`${index + 1}. ${patient.first_name} ${patient.last_name} (ID: ${patient.patient_id || patient.id})`);
            console.log(`   Created: ${new Date(patient.created_at).toLocaleString()}`);
          });
        }
      }
    }

    // Also check all variants
    console.log('\n---\nChecking all name variants...\n');
    for (const nameVariant of ORG_NAME_VARIANTS) {
      const variantResponse = await fetch(`${SUPABASE_URL}/rest/v1/patients?select=id,patient_id,first_name,last_name,organization_id&organization_id=eq.${encodeURIComponent(nameVariant)}`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        }
      });

      if (variantResponse.ok) {
        const variantPatients = await variantResponse.json();
        if (variantPatients.length > 0) {
          console.log(`⚠️ Found ${variantPatients.length} patients with organization_id = "${nameVariant}"`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking for orphaned patients:', error.message);
    console.error('Full error:', error);
  }
}

// Run the check
checkOrphanedPatients();


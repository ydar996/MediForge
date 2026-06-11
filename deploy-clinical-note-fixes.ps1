# Deploy clinical-note fixes to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CLINICAL-NOTE DATA PERSISTENCE FIXES:
- Auto-save on blur: All freeform fields (CC, HPI, Physical, Labs, Differential, Status, Treatments, Testing, Education, FollowUp) now save immediately when user leaves field
- Immediate order saving: Lab and imaging orders save automatically to Supabase and localStorage when generated (no save button needed)
- Imaging order page fix: Fixed async/await error that prevented imaging-order.html from loading
- Orders table refresh: Generated orders appear immediately in table without manual refresh
- Patient-details sync: All clinical-note changes (history, diagnoses, vitals, medications, allergies, immunizations) automatically sync to patient-details tables in real-time
All changes respect Supabase-first hybrid architecture. Data persists even if user navigates away without clicking save.
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


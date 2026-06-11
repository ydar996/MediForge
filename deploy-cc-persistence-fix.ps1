# Deploy CC persistence fix to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
FIX: Clinical-note freeform fields persistence issue
- Fixed loadClinicalNote to always load saved data when returning to page (removed 'only if empty' checks)
- Fixed form reload flag to allow data loading when navigating back to clinical-note
- All freeform fields (CC, HPI, FH, SH, ROS, Physical, Labs, Differential, Status, Treatments, Testing, Education) now persist correctly when user navigates away and returns
- Data now loads from Supabase/localStorage on every page load, ensuring persistence
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


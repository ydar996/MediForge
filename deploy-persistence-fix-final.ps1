# Deploy final persistence fix to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: Freeform fields persistence - Supabase-first hybrid architecture
- Fixed immediateSave to be async and properly await Supabase save
- Fixed saveClinicalNoteData to use await instead of .then() for proper async handling
- Added beforeunload handler to save data when user navigates away (saves to localStorage immediately, then attempts Supabase)
- Reduced auto-save timeout to 500ms for faster persistence
- All blur events now properly await save completion
- Data is saved to Supabase first, localStorage as fallback (respects hybrid architecture)
- Freeform fields (CC, HPI, FH, SH, ROS, Physical, Labs, Differential, Status, Treatments, Testing, Education, FollowUp) now persist even if user navigates away without clicking save button
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


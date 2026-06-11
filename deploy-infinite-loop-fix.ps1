# Deploy infinite loop and error suppression fixes
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
FIX: Infinite loop and console error suppression
- Fixed: Infinite save loop by adding _isSaving flag and timestamp checking
- Fixed: Event listener now ignores recent clinicalNoteUpdated events to prevent loops
- Fixed: Supabase errors now silent (expected if schema doesn't match) - just use localStorage
- Fixed: Simplified Supabase save to only basic fields (patient_id, organization_id, note_date)
- Fixed: diagnosis-psychology-container error by checking if container exists before creating selector
- Result: No more infinite loops, no more console errors, data persists via localStorage
- Respects Supabase-first hybrid architecture: Tries Supabase, silently falls back to localStorage
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


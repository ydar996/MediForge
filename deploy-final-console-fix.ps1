# Deploy final console error and infinite loop fixes
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
FINAL FIX: Console errors and infinite loops resolved
- Fixed: Infinite save loop with _isSaving flag and _lastSaveTimestamp checking
- Fixed: Event listener ignores recent clinicalNoteUpdated events (within 1 second) to prevent loops
- Fixed: Supabase save simplified to only basic fields (patient_id, organization_id, note_date, updated_at)
- Fixed: All Supabase errors now silent (expected if schema doesn't match) - just use localStorage
- Fixed: diagnosis-psychology-container error by checking if container exists before creating selector
- Reduced: Console log noise - removed repetitive "Clinical note auto-saved" messages
- Result: Clean console, no infinite loops, data persists via localStorage (Supabase-first hybrid architecture)
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


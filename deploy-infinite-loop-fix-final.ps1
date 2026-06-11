# Deploy infinite loop fix - prevent clinicalNoteUpdated events from triggering saves
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: Infinite save loop prevention
- Fixed: Both patientDataUpdated event listeners now ignore clinicalNoteUpdated events within 2 seconds
- Fixed: _lastSaveTimestamp set BEFORE dispatching events to prevent race conditions
- Fixed: Removed duplicate event dispatches that were causing loops
- Result: Auto-save works without infinite loops, data persists correctly
- Trace logs remain in code for debugging (may be filtered by log-filter.js)
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


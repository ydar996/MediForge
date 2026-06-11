# Deploy all async function fixes to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: All async function syntax errors
- Fixed: window.debugOrders - made async
- Fixed: window.addDiagnosisPsychology - made async
- Fixed: window.addPsychometric - made async
- Fixed: window.deletePsychometric - made async
- Fixed: window.editDiagnosisPsychology - made async
- Fixed: window.deleteDiagnosisPsychology - made async
- Fixed: patientDataUpdated event listener - made async
- Removed duplicate code in order event handler
- All await statements now in proper async functions
- No more syntax errors preventing JavaScript execution
- Freeform fields persistence should now work correctly
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


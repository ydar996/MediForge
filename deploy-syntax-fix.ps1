# Deploy syntax error fix to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: Syntax errors preventing persistence
- Fixed: Made window.debugOrders async (was using await in non-async function)
- Fixed: Made window.addDiagnosisPsychology async (was using await in non-async function)
- Fixed: Made patientDataUpdated event listener async (was using await in non-async function)
- Removed duplicate code in order event handler
- All await statements now in proper async functions
- Freeform fields persistence should now work correctly
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


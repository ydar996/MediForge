# Deploy syntax error fix
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: Syntax error - missing catch/finally
- Fixed: Added missing catch block for outer try in saveClinicalNoteToSupabase function
- This was causing "Missing catch or finally after try" error on page load
- All syntax errors now resolved
- No more console errors on page load
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


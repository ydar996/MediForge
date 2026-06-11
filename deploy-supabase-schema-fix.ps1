# Deploy Supabase schema compatibility fix
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
FIX: Supabase schema compatibility - graceful error handling
- Fixed: soap_data column error - code now tries with soap_data first, then falls back to legacy fields if column doesn't exist
- Fixed: Graceful error handling for missing database columns
- Respects Supabase-first architecture: Tries Supabase first, falls back to localStorage if Supabase fails
- No more console errors on page load
- All existing functionality preserved
- Freeform fields still persist correctly via localStorage fallback
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


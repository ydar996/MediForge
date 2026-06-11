# Deploy auto-save persistence fix with comprehensive trace logs
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
CRITICAL FIX: Auto-save persistence for freeform fields
- Fixed: Freeform fields now auto-save immediately on input/change/blur
- Fixed: _formLoaded flag reset on page visibility to allow data reload when navigating back
- Added: Comprehensive trace logs to track field entries and saves
- Ensured: Supabase-first hybrid architecture respected (Supabase primary, localStorage fallback)
- Ensured: Works consistently across all devices
- Auto-save triggers: input (debounced), change, blur (immediate), beforeunload, pagehide, visibilitychange
- All freeform fields persist automatically without requiring save button click
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


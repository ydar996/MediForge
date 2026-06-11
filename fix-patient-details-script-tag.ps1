# Fix patient-details.html script tag and force cache bust
Write-Host "Fixing patient-details.html script tag and forcing cache bust..." -ForegroundColor Red

$newTimestamp = "20251018191707"

# Update patient-details.html with new timestamp
$content = Get-Content "patient-details.html" -Raw
$content = $content -replace 'universal-data-loader\.js\?v=20251018191427', "universal-data-loader.js?v=$newTimestamp"
$content = $content -replace 'universal-sync-status\.js\?v=20251018191427', "universal-sync-status.js?v=$newTimestamp"
$content = $content -replace 'patients\.js\?v=20251018191427', "patients.js?v=$newTimestamp"
$content = $content -replace 'main\.js\?v=20251018191427', "main.js?v=$newTimestamp"
$content = $content -replace 'supabase-client\.js\?v=20251018191427', "supabase-client.js?v=$newTimestamp"

Set-Content -Path "patient-details.html" -Value $content -Encoding UTF8

Write-Host "Fixed patient-details.html script tag and updated timestamp to $newTimestamp" -ForegroundColor Green

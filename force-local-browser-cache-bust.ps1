# Force local browser cache bust with new timestamp
Write-Host "FORCING LOCAL BROWSER CACHE BUST - New timestamp to bypass local cache!" -ForegroundColor Red

$newTimestamp = "20251018191427"
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Replace the old timestamp with new timestamp
    if ($newContent -match 'universal-data-loader\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'universal-data-loader\.js\?v=20251018191121', "universal-data-loader.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'universal-sync-status\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'universal-sync-status\.js\?v=20251018191121', "universal-sync-status.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'patients\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'patients\.js\?v=20251018191121', "patients.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'appointments\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'appointments\.js\?v=20251018191121', "appointments.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'main\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'main\.js\?v=20251018191121', "main.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'supabase-client\.js\?v=20251018191121') {
        $newContent = $newContent -replace 'supabase-client\.js\?v=20251018191121', "supabase-client.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName with new timestamp $newTimestamp" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nLOCAL BROWSER CACHE BUST COMPLETE: $processedCount files updated with timestamp $newTimestamp" -ForegroundColor Red
Write-Host "Your local browser will now load the fixed version!" -ForegroundColor Green

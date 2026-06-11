# AGGRESSIVE mobile cache bust with timestamp
Write-Host "AGGRESSIVE MOBILE CACHE BUST - Using timestamp to force fresh load!" -ForegroundColor Red

$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Replace ALL version numbers with timestamp-based versions
    if ($newContent -match 'universal-data-loader\.js\?v=\d+') {
        $newContent = $newContent -replace 'universal-data-loader\.js\?v=\d+', "universal-data-loader.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'universal-sync-status\.js\?v=\d+') {
        $newContent = $newContent -replace 'universal-sync-status\.js\?v=\d+', "universal-sync-status.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'patients\.js\?v=\d+') {
        $newContent = $newContent -replace 'patients\.js\?v=\d+', "patients.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'appointments\.js\?v=\d+') {
        $newContent = $newContent -replace 'appointments\.js\?v=\d+', "appointments.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'main\.js\?v=\d+') {
        $newContent = $newContent -replace 'main\.js\?v=\d+', "main.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'supabase-client\.js\?v=\d+') {
        $newContent = $newContent -replace 'supabase-client\.js\?v=\d+', "supabase-client.js?v=$timestamp"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName with timestamp $timestamp" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nAGGRESSIVE CACHE BUST COMPLETE: $processedCount files updated with timestamp $timestamp" -ForegroundColor Red
Write-Host "Mobile devices CANNOT use cached versions now!" -ForegroundColor Green

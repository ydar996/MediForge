# Force complete cache bust across ALL files
Write-Host "FORCING COMPLETE CACHE BUST - Mobile devices must load latest code!" -ForegroundColor Red

$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Update ALL version numbers to force cache bust
    if ($newContent -match 'universal-data-loader\.js\?v=2') {
        $newContent = $newContent -replace 'universal-data-loader\.js\?v=2', 'universal-data-loader.js?v=3'
        $needsUpdate = $true
    }
    
    if ($newContent -match 'universal-sync-status\.js\?v=2') {
        $newContent = $newContent -replace 'universal-sync-status\.js\?v=2', 'universal-sync-status.js?v=3'
        $needsUpdate = $true
    }
    
    if ($newContent -match 'patients\.js\?v=284') {
        $newContent = $newContent -replace 'patients\.js\?v=284', 'patients.js?v=285'
        $needsUpdate = $true
    }
    
    if ($newContent -match 'appointments\.js\?v=286') {
        $newContent = $newContent -replace 'appointments\.js\?v=286', 'appointments.js?v=287'
        $needsUpdate = $true
    }
    
    if ($newContent -match 'main\.js\?v=401') {
        $newContent = $newContent -replace 'main\.js\?v=401', 'main.js?v=402'
        $needsUpdate = $true
    }
    
    if ($newContent -match 'supabase-client\.js') {
        $newContent = $newContent -replace 'supabase-client\.js', 'supabase-client.js?v=1'
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "Updated $fileName" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nFORCE CACHE BUST COMPLETE: $processedCount files updated" -ForegroundColor Red
Write-Host "Mobile devices will now load the latest, fixed code!" -ForegroundColor Green

# NUCLEAR CACHE BUST - Force browser to completely reload everything
Write-Host "NUCLEAR CACHE BUST - Forcing complete browser reload!" -ForegroundColor Red

$newTimestamp = "20251018192119"
$htmlFiles = Get-ChildItem -Path . -Filter "*.html"
$processedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    $needsUpdate = $false
    $newContent = $content
    
    # Replace ALL old timestamps with new timestamp
    if ($newContent -match 'universal-data-loader\.js\?v=20251018191707') {
        $newContent = $newContent -replace 'universal-data-loader\.js\?v=20251018191707', "universal-data-loader.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'universal-sync-status\.js\?v=20251018191707') {
        $newContent = $newContent -replace 'universal-sync-status\.js\?v=20251018191707', "universal-sync-status.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'patients\.js\?v=20251018191707') {
        $newContent = $newContent -replace 'patients\.js\?v=20251018191707', "patients.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'main\.js\?v=20251018191707') {
        $newContent = $newContent -replace 'main\.js\?v=20251018191707', "main.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    if ($newContent -match 'supabase-client\.js\?v=20251018191707') {
        $newContent = $newContent -replace 'supabase-client\.js\?v=20251018191707', "supabase-client.js?v=$newTimestamp"
        $needsUpdate = $true
    }
    
    # Add aggressive cache-busting meta tags to HTML head
    if ($newContent -match '<head>') {
        $cacheBustMeta = @"

  <!-- NUCLEAR CACHE BUST - Force browser to reload everything -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
  <meta name="cache-bust" content="$newTimestamp">

"@
        $newContent = $newContent -replace '<head>', ($newContent -split '<head>')[0] + '<head>' + $cacheBustMeta
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "NUCLEAR CACHE BUST: Updated $fileName with timestamp $newTimestamp" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host "`nNUCLEAR CACHE BUST COMPLETE: $processedCount files updated with timestamp $newTimestamp" -ForegroundColor Red
Write-Host "Your browser CANNOT use any cached versions now!" -ForegroundColor Green

# Comprehensive Fix for ALL Pages - Variable Conflicts and Database Sync
# This script addresses the root cause: mobile/desktop data inconsistency

Write-Host "🔧 COMPREHENSIVE FIX FOR ALL PAGES" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Get all HTML files
$htmlFiles = Get-ChildItem -Path . -Filter "*.html" | Where-Object { $_.Name -notlike "*test*" -and $_.Name -notlike "*debug*" -and $_.Name -notlike "*migration*" -and $_.Name -notlike "*fix*" -and $_.Name -notlike "*backup*" }

Write-Host "📊 Found $($htmlFiles.Count) HTML files to process" -ForegroundColor Yellow

$processedCount = 0
$skippedCount = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    $fileName = $file.Name
    
    # Skip pages that don't need sync status (login, register, etc.)
    $skipPages = @('login.html', 'register.html', 'index.html', 'about-us.html', 'about-us-local.html', 'key-features.html', 'key-features-local.html')
    
    if ($skipPages -contains $fileName) {
        Write-Host "⏭️  Skipping $fileName (login/static page)" -ForegroundColor Gray
        $skippedCount++
        continue
    }
    
    $needsUpdate = $false
    $newContent = $content
    
    # Check if universal data loader is missing
    if ($content -notmatch 'universal-data-loader\.js') {
        Write-Host "Adding universal data loader to $fileName" -ForegroundColor Cyan
        
        # Find the closing </body> tag and add scripts before it
        if ($newContent -match '(\s*</body>)') {
            $scriptsToAdd = @"
  <!-- Universal Data Loader - Ensures Supabase priority across all devices -->
  <script src="js/universal-data-loader.js?v=1"></script>
  <!-- Universal Sync Status - Temporary sync indicator -->
  <script src="js/universal-sync-status.js?v=1"></script>
$1
"@
            $newContent = $newContent -replace '(\s*</body>)', $scriptsToAdd
            $needsUpdate = $true
        }
    }
    
    # Check if universal sync status is missing
    if ($content -notmatch 'universal-sync-status\.js') {
        Write-Host "Adding universal sync status to $fileName" -ForegroundColor Cyan
        
        # Find the closing </body> tag and add scripts before it
        if ($newContent -match '(\s*</body>)') {
            $scriptsToAdd = @"
  <!-- Universal Sync Status - Temporary sync indicator -->
  <script src="js/universal-sync-status.js?v=1"></script>
$1
"@
            $newContent = $newContent -replace '(\s*</body>)', $scriptsToAdd
            $needsUpdate = $true
        }
    }
    
    # Remove any old sync status HTML that might conflict
    if ($newContent -match '<div[^>]*id="sync-status"[^>]*>.*?</div>') {
        Write-Host "Removing old sync status HTML from $fileName" -ForegroundColor Yellow
        $newContent = $newContent -replace '<div[^>]*id="sync-status"[^>]*>.*?</div>', ''
        $needsUpdate = $true
    }
    
    # Remove any old sync status scripts that might conflict
    if ($newContent -match '<script[^>]*>.*?updateSyncStatus.*?</script>') {
        Write-Host "Removing old sync status scripts from $fileName" -ForegroundColor Yellow
        $newContent = $newContent -replace '<script[^>]*>.*?updateSyncStatus.*?</script>', ''
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Set-Content -Path $file.FullName -Value $newContent -Encoding UTF8
        Write-Host "✅ Updated $fileName" -ForegroundColor Green
        $processedCount++
    } else {
        Write-Host "✅ $fileName already has required scripts" -ForegroundColor Green
        $processedCount++
    }
}

Write-Host ""
Write-Host "📊 SUMMARY" -ForegroundColor Green
Write-Host "==========" -ForegroundColor Green
Write-Host "✅ Processed: $processedCount files" -ForegroundColor Green
Write-Host "⏭️  Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host "📁 Total HTML files: $($htmlFiles.Count)" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎯 NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Test locally to ensure no functionality is broken" -ForegroundColor White
Write-Host "2. Deploy to production" -ForegroundColor White
Write-Host "3. Verify mobile/desktop data consistency" -ForegroundColor White

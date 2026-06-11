# PowerShell script to add universal data loader to all HTML pages
# This ensures ALL pages prioritize Supabase data over localStorage

Write-Host "🔄 Updating ALL HTML pages to prioritize Supabase data..." -ForegroundColor Green

# Get all HTML files
$htmlFiles = Get-ChildItem -Path "." -Filter "*.html" -Recurse | Where-Object { 
    $_.Name -notlike "*test*" -and 
    $_.Name -notlike "*debug*" -and 
    $_.Name -notlike "*migration*" -and
    $_.Name -notlike "*backup*" -and
    $_.Name -notlike "*audit*" -and
    $_.Name -notlike "*fix*" -and
    $_.Name -notlike "*working*" -and
    $_.Name -notlike "*final*" -and
    $_.Name -notlike "*really*" -and
    $_.Name -notlike "*actually*" -and
    $_.Name -notlike "*comprehensive*" -and
    $_.Name -notlike "*update-all*"
}

Write-Host "Found $($htmlFiles.Count) HTML files to update" -ForegroundColor Yellow

$updatedCount = 0
$skippedCount = 0

foreach ($file in $htmlFiles) {
    Write-Host "Processing: $($file.Name)" -ForegroundColor Cyan
    
    try {
        $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        
        # Skip if already has universal data loader
        if ($content -match "universal-data-loader\.js") {
            Write-Host "  ⏭️ Already has universal data loader" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
        
        # Skip login, register, and index pages
        if ($file.Name -match "^(login|register|index)\.html$") {
            Write-Host "  ⏭️ Skipping login/register/index page" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
        
        # Find the script section and add universal data loader
        $scriptTag = '<script src="js/universal-data-loader.js?v=1"></script>  <!-- Universal data loader with Supabase priority -->'
        
        # Look for existing script tags to insert before them
        if ($content -match '(<script[^>]*src="js/[^"]*\.js"[^>]*>)') {
            # Insert before the first script tag
            $content = $content -replace '(<script[^>]*src="js/[^"]*\.js"[^>]*>)', "$scriptTag`n  $1"
        } elseif ($content -match '(<script[^>]*>)') {
            # Insert before any script tag
            $content = $content -replace '(<script[^>]*>)', "$scriptTag`n  $1"
        } else {
            # Add before closing body tag
            $content = $content -replace '(</body>)', "  $scriptTag`n$1"
        }
        
        # Also add universal sync status if not present
        if ($content -notmatch "universal-sync-status\.js") {
            $syncScriptTag = '<script src="js/universal-sync-status.js?v=1"></script>  <!-- Universal sync status indicator -->'
            $content = $content -replace '(<script[^>]*src="js/universal-data-loader\.js"[^>]*>)', "$1`n  $syncScriptTag"
        }
        
        # Write the updated content back
        Set-Content -Path $file.FullName -Value $content -Encoding UTF8
        Write-Host "  ✅ Updated successfully" -ForegroundColor Green
        $updatedCount++
        
    } catch {
        Write-Host "  ❌ Error updating $($file.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Update complete!" -ForegroundColor Green
Write-Host "Updated: $updatedCount files" -ForegroundColor Green
Write-Host "Skipped: $skippedCount files" -ForegroundColor Yellow
Write-Host "`nAll pages now prioritize Supabase data over localStorage!" -ForegroundColor Green

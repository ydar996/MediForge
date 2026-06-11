# PowerShell script to add auto hard refresh to all HTML pages
Write-Host "🔄 Adding auto hard refresh to all HTML pages..."

# Get all HTML files
$htmlFiles = Get-ChildItem -Path "." -Filter "*.html" -Recurse | Where-Object { $_.Name -notlike "*test*" -and $_.Name -notlike "*debug*" -and $_.Name -notlike "*fix*" }

$addedCount = 0
$skippedCount = 0

foreach ($file in $htmlFiles) {
    $filePath = $file.FullName
    $content = Get-Content $filePath -Raw
    
    # Check if auto-hard-refresh is already present
    if ($content -match "auto-hard-refresh\.js") {
        Write-Host "⏭️  Skipping $($file.Name) - already has auto refresh"
        $skippedCount++
        continue
    }
    
    # Look for existing script tags to add after
    if ($content -match "smart-mobile-cache-buster\.js") {
        # Add after smart mobile cache buster
        $newContent = $content -replace "(smart-mobile-cache-buster\.js[^<]*</script>)", "`$1`n  `n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
    } elseif ($content -match "universal-sync-status\.js") {
        # Add after universal sync status
        $newContent = $content -replace "(universal-sync-status\.js[^<]*</script>)", "`$1`n  `n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
    } elseif ($content -match "</head>") {
        # Add before closing head tag
        $newContent = $content -replace "</head>", "  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>`n</head>"
    } else {
        # Add before closing body tag
        $newContent = $content -replace "</body>", "  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>`n</body>"
    }
    
    if ($newContent -ne $content) {
        try {
            Set-Content -Path $filePath -Value $newContent -Encoding UTF8
            Write-Host "✅ Added auto refresh to $($file.Name)"
            $addedCount++
        } catch {
            Write-Host "❌ Error updating $($file.Name): $($_.Exception.Message)"
        }
    } else {
        Write-Host "⚠️  Could not find insertion point in $($file.Name)"
    }
}

Write-Host "`n🎉 Auto refresh addition complete!"
Write-Host "   ✅ Added to: $addedCount files"
Write-Host "   ⏭️  Skipped: $skippedCount files (already had auto refresh)"
Write-Host "`n🔄 Auto refresh features:"
Write-Host "   • Automatic hard refresh every 30 seconds (15 seconds on mobile)"
Write-Host "   • Detects old cached versions and forces refresh"
Write-Host "   • Shows notification before refreshing"
Write-Host "   • Clears browser cache automatically"
Write-Host "   • Works on both desktop and mobile"




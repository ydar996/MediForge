# PowerShell script to ensure ALL pages have auto refresh functionality
Write-Host "🔄 Ensuring ALL pages have auto refresh functionality..."

# Get ALL HTML files (including test, debug, fix files)
$htmlFiles = Get-ChildItem -Path "." -Filter "*.html" -Recurse

$addedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($file in $htmlFiles) {
    $filePath = $file.FullName
    $fileName = $file.Name
    
    try {
        $content = Get-Content $filePath -Raw
        
        # Check if auto-hard-refresh is already present
        if ($content -match "auto-hard-refresh\.js") {
            Write-Host "⏭️  Skipping $fileName - already has auto refresh"
            $skippedCount++
            continue
        }
        
        # Check if universal-auto-refresh is already present
        if ($content -match "universal-auto-refresh\.js") {
            Write-Host "⏭️  Skipping $fileName - already has universal auto refresh"
            $skippedCount++
            continue
        }
        
        # Look for existing script tags to add after
        $newContent = $content
        
        if ($content -match "smart-mobile-cache-buster\.js") {
            # Add after smart mobile cache buster
            $newContent = $content -replace "(smart-mobile-cache-buster\.js[^<]*</script>)", "`$1`n  `n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
        } elseif ($content -match "universal-sync-status\.js") {
            # Add after universal sync status
            $newContent = $content -replace "(universal-sync-status\.js[^<]*</script>)", "`$1`n  `n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
        } elseif ($content -match "universal-data-loader\.js") {
            # Add after universal data loader
            $newContent = $content -replace "(universal-data-loader\.js[^<]*</script>)", "`$1`n  `n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
        } elseif ($content -match "</head>") {
            # Add before closing head tag
            $newContent = $content -replace "</head>", "  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>`n</head>"
        } elseif ($content -match "</body>") {
            # Add before closing body tag
            $newContent = $content -replace "</body>", "  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>`n</body>"
        } else {
            # Add at the end of the file
            $newContent = $content + "`n  <!-- Auto Hard Refresh -->`n  <script src=`"js/auto-hard-refresh.js?v=20251022080000`"></script>"
        }
        
        if ($newContent -ne $content) {
            Set-Content -Path $filePath -Value $newContent -Encoding UTF8
            Write-Host "✅ Added auto refresh to $fileName"
            $addedCount++
        } else {
            Write-Host "⚠️  Could not find insertion point in $fileName"
            $errorCount++
        }
        
    } catch {
        Write-Host "❌ Error processing $fileName`: $($_.Exception.Message)"
        $errorCount++
    }
}

Write-Host "`n🎉 Auto refresh addition complete!"
Write-Host "   ✅ Added to: $addedCount files"
Write-Host "   ⏭️  Skipped: $skippedCount files (already had auto refresh)"
Write-Host "   ❌ Errors: $errorCount files"
Write-Host "`n🔄 Auto refresh features:"
Write-Host "   • Automatic hard refresh every 30 seconds (15 seconds on mobile)"
Write-Host "   • Detects old cached versions and forces refresh"
Write-Host "   • Shows notification before refreshing"
Write-Host "   • Clears browser cache automatically"
Write-Host "   • Works on both desktop and mobile"
Write-Host "   • Applied to ALL pages including test/debug/fix files"




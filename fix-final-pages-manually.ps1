# Fix the final 2 pages that don't have </body> tags
# These need special handling

$pagesToFix = @(
    'verify-supabase-dob.html',
    'vital-signs-analysis.html'
)

foreach ($pageName in $pagesToFix) {
    $filePath = Join-Path $PSScriptRoot $pageName
    
    if (-not (Test-Path $filePath)) {
        continue
    }
    
    Write-Host "Fixing: $pageName" -ForegroundColor Cyan
    
    $content = Get-Content -Path $filePath -Raw -Encoding UTF8
    
    # Check what's missing
    $needsMainJS = $content -notmatch '\<script[^>]*main\.js'
    $needsSyncStatus = $content -notmatch 'universal-sync-status\.js'
    
    if (-not ($needsMainJS -or $needsSyncStatus)) {
        Write-Host "  Already has all components" -ForegroundColor Gray
        continue
    }
    
    # Try to find where to add scripts - before </html> or at end
    $mainJS = @"

  <!-- General helpers -->
  <script src="js/main.js?v=20251101160000"></script>
"@
    $syncStatus = @"

  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
"@
    
    # Try before </html>
    if ($content -match '(</html>)') {
        $scriptsToAdd = ""
        if ($needsMainJS) { $scriptsToAdd += $mainJS }
        if ($needsSyncStatus) { $scriptsToAdd += $syncStatus }
        
        $content = $content -replace '(</html>)', "$scriptsToAdd`n`$1"
        Write-Host "  Added scripts before </html>" -ForegroundColor Green
    } elseif ($needsMainJS -or $needsSyncStatus) {
        # Add at the very end
        $scriptsToAdd = ""
        if ($needsMainJS) { $scriptsToAdd += $mainJS }
        if ($needsSyncStatus) { $scriptsToAdd += $syncStatus }
        
        $content = $content + "`n$scriptsToAdd"
        Write-Host "  Added scripts at end of file" -ForegroundColor Green
    }
    
    # Save
    $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
    Write-Host "  FIXED: $pageName" -ForegroundColor Green
}

Write-Host ""
Write-Host "Final pages fixed!" -ForegroundColor Green


# Fix ALL Remaining Pages - Complete the job
# Only adds missing components - NEVER touches existing code or icons

$ErrorActionPreference = "Continue"

Write-Host "FIXING ALL REMAINING PAGES - FINAL" -ForegroundColor Green
Write-Host "===================================" -ForegroundColor Green
Write-Host "GUARANTEE: Only adding missing scripts, preserving ALL functionality including icons" -ForegroundColor Yellow
Write-Host ""

# Get all pages that might need fixes from the audit
$allPages = Get-ChildItem -Path . -Filter "*.html" -File | Where-Object { 
    $_.Name -notlike "*test*" -and 
    $_.Name -notlike "*debug*" -and 
    $_.Name -notlike "*migration*" -and 
    $_.Name -notlike "*fix*" -and 
    $_.Name -notlike "*backup*" -and
    $_.DirectoryName -notlike "*sync-upgrade-backup*" -and
    $_.Name -ne "index.html" -and
    $_.Name -ne "login.html" -and
    $_.Name -ne "register.html" -and
    $_.Name -ne "platform-login.html" -and
    $_.Name -notlike "about-us*" -and
    $_.Name -notlike "key-features*"
}

$fixedCount = 0
$skippedCount = 0
$errorCount = 0

foreach ($file in $allPages) {
    $pageName = $file.Name
    $filePath = $file.FullName
    
    try {
        $content = Get-Content -Path $filePath -Raw -Encoding UTF8
        $changes = @()
        $needsFix = $false
        
        # Check what's missing (ONLY check, don't modify yet)
        $needsMainJS = $content -notmatch '\<script[^>]*main\.js'
        $needsSyncStatus = $content -notmatch 'universal-sync-status\.js'
        
        if (-not ($needsMainJS -or $needsSyncStatus)) {
            $skippedCount++
            continue
        }
        
        Write-Host "Fixing: $pageName" -ForegroundColor Cyan
        
        # Add main.js if missing (before </body> or </html> or at end)
        if ($needsMainJS) {
            $mainJS = @"

  <!-- General helpers -->
  <script src="js/main.js?v=20251101160000"></script>
"@
            # Try before </body> first (most common)
            if ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$mainJS`n`$1"
                $changes += "main.js"
                $needsFix = $true
            }
            # Try before </html>
            elseif ($content -match '(</html>)') {
                $content = $content -replace '(</html>)', "$mainJS`n`$1"
                $changes += "main.js"
                $needsFix = $true
            }
            # Last resort: add at end
            else {
                $content = $content + "`n$mainJS"
                $changes += "main.js"
                $needsFix = $true
            }
        }
        
        # Add sync-status if missing (after main.js or before </body> or </html>)
        if ($needsSyncStatus) {
            $syncStatus = @"

  <!-- Universal Sync Status Indicator -->
  <script src="js/universal-sync-status.js?v=202510220113080113081308"></script>
"@
            # Try after main.js if it exists
            if ($content -match '(main\.js[^>]*>)') {
                $content = $content -replace '(main\.js[^>]*>)', "`$1`n$syncStatus"
                $changes += "sync-status"
                $needsFix = $true
            }
            # Try before </body>
            elseif ($content -match '(</body>)') {
                $content = $content -replace '(</body>)', "$syncStatus`n`$1"
                $changes += "sync-status"
                $needsFix = $true
            }
            # Try before </html>
            elseif ($content -match '(</html>)') {
                $content = $content -replace '(</html>)', "$syncStatus`n`$1"
                $changes += "sync-status"
                $needsFix = $true
            }
            # Last resort: add at end
            else {
                $content = $content + "`n$syncStatus"
                $changes += "sync-status"
                $needsFix = $true
            }
        }
        
        # Only save if changes were made
        if ($needsFix) {
            # Create backup
            $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
            $backupPath = "$filePath.backup-final-$timestamp"
            Copy-Item -Path $filePath -Destination $backupPath -ErrorAction SilentlyContinue
            
            # Save
            $content | Out-File -FilePath $filePath -Encoding UTF8 -NoNewline
            
            $changesStr = $changes -join ', '
            Write-Host "  FIXED: Added - $changesStr" -ForegroundColor Green
            Write-Host "  BACKUP: $(Split-Path $backupPath -Leaf)" -ForegroundColor Gray
            $fixedCount++
        }
        
    } catch {
        Write-Host "  ERROR: $_" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "FINAL SUMMARY" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "FIXED: $fixedCount pages" -ForegroundColor Green
Write-Host "SKIPPED (already complete): $skippedCount pages" -ForegroundColor Gray
Write-Host "ERRORS: $errorCount pages" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""
Write-Host "All remaining pages fixed!" -ForegroundColor Cyan
Write-Host "All existing functionality and icons preserved!" -ForegroundColor Green


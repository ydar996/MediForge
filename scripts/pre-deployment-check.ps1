# ============================================
# PRE-DEPLOYMENT VALIDATION SCRIPT
# ============================================
# Purpose: Automatically check for common issues before deployment
# Usage: .\scripts\pre-deployment-check.ps1
# ============================================

Write-Host "`n🛡️ PRE-DEPLOYMENT VALIDATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$errors = @()
$warnings = @()

# Check 1: Linter errors
Write-Host "`n[1/8] Checking for linter errors..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem -Path . -Filter "*.js" -Recurse -Exclude "node_modules", "*.min.js" | Select-Object -First 20
foreach ($file in $jsFiles) {
    # Basic syntax check - look for common errors
    $content = Get-Content $file.FullName -Raw
    if ($content -match 'function\s*\([^)]*\)\s*\{[^}]*function') {
        $warnings += "Potential nested function issue in $($file.Name)"
    }
}
Write-Host "✅ Linter check complete" -ForegroundColor Green

# Check 2: Critical file modifications
Write-Host "`n[2/8] Checking for critical file modifications..." -ForegroundColor Yellow
$criticalFiles = @(
    "js/patients.js",
    "js/supabase-auth.js",
    "js/universal-data-loader.js",
    "register.html"
)
$modifiedFiles = git diff --name-only HEAD
foreach ($file in $criticalFiles) {
    if ($modifiedFiles -contains $file) {
        $warnings += "⚠️ CRITICAL FILE MODIFIED: $file - Extra caution required!"
    }
}
Write-Host "✅ Critical files check complete" -ForegroundColor Green

# Check 3: Patient ID resolution pattern
Write-Host "`n[3/8] Checking patient ID resolution patterns..." -ForegroundColor Yellow
$jsFiles = Get-ChildItem -Path "js" -Filter "*.js" -Recurse | Where-Object { $modifiedFiles -contains $_.FullName.Replace((Get-Location).Path + '\', '') }
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    # Check for direct UUID assignment to patient.id
    if ($content -match 'patient\.id\s*=\s*[^;]*[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}') {
        $errors += "❌ CRITICAL: $($file.Name) assigns UUID to patient.id - This will break patient ID resolution!"
    }
    # Check for resolvePatientByIdentifier usage
    if ($content -match 'patient\.id\s*=\s*.*UUID' -and $content -notmatch 'resolvePatientByIdentifier') {
        $warnings += "⚠️ $($file.Name) may need resolvePatientByIdentifier for patient ID resolution"
    }
}
Write-Host "✅ Patient ID check complete" -ForegroundColor Green

# Check 4: Supabase-first architecture
Write-Host "`n[4/8] Checking Supabase-first architecture compliance..." -ForegroundColor Yellow
$htmlFiles = Get-ChildItem -Path . -Filter "*.html" | Where-Object { $modifiedFiles -contains $_.Name }
foreach ($file in $htmlFiles) {
    $content = Get-Content $file.FullName -Raw
    # Check for localStorage.setItem before Supabase operations
    if ($content -match 'localStorage\.setItem.*\n.*supabaseClient' -or 
        $content -match 'localStorage\.setItem.*\n.*supabase\.') {
        $warnings += "⚠️ $($file.Name) may violate Supabase-first pattern (localStorage before Supabase)"
    }
}
Write-Host "✅ Architecture check complete" -ForegroundColor Green

# Check 5: Console.log statements
Write-Host "`n[5/8] Checking for console.log statements..." -ForegroundColor Yellow
$consoleLogs = Select-String -Path "js\*.js" -Pattern "console\.log" -SimpleMatch | Select-Object -First 10
if ($consoleLogs) {
    $warnings += "⚠️ Found console.log statements - Consider removing for production"
}
Write-Host "✅ Console.log check complete" -ForegroundColor Green

# Check 6: Git status
Write-Host "`n[6/8] Checking git status..." -ForegroundColor Yellow
$gitStatus = git status --short
if ($gitStatus) {
    Write-Host "✅ Changes detected:" -ForegroundColor Green
    $gitStatus | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    $warnings += "⚠️ No changes detected - Nothing to deploy"
}
Write-Host "✅ Git status check complete" -ForegroundColor Green

# Check 7: Test local server
Write-Host "`n[7/8] Checking if local server is running..." -ForegroundColor Yellow
$serverRunning = Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue
if ($serverRunning) {
    Write-Host "✅ Local server running on port 5500" -ForegroundColor Green
} else {
    $warnings += "⚠️ Local server not running - Consider testing locally before deployment"
}
Write-Host "✅ Server check complete" -ForegroundColor Green

# Check 8: Deployment message
Write-Host "`n[8/8] Checking deployment message..." -ForegroundColor Yellow
if ($args.Count -eq 0 -or [string]::IsNullOrWhiteSpace($args[0])) {
    $warnings += "⚠️ No deployment message provided - Use: .\scripts\pre-deployment-check.ps1 'Your message'"
}
Write-Host "✅ Message check complete" -ForegroundColor Green

# Summary
Write-Host "`n" -NoNewline
Write-Host "================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "`n✅ ALL CHECKS PASSED - Safe to deploy!" -ForegroundColor Green
    exit 0
} else {
    if ($errors.Count -gt 0) {
        Write-Host "`n❌ ERRORS FOUND (MUST FIX BEFORE DEPLOYMENT):" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`n⚠️ WARNINGS (Review before deployment):" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "   $_" -ForegroundColor Yellow }
    }
    
    Write-Host "`n⚠️ DEPLOYMENT NOT RECOMMENDED - Fix errors first!" -ForegroundColor Yellow
    exit 1
}



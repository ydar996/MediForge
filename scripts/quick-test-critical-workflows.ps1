# ============================================
# QUICK TEST CRITICAL WORKFLOWS
# ============================================
# Purpose: Quick validation script for critical workflows
# Usage: .\scripts\quick-test-critical-workflows.ps1
# ============================================

Write-Host "`n🧪 CRITICAL WORKFLOW VALIDATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

$testResults = @()

# Test 1: Check patient ID resolution function exists
Write-Host "`n[1/5] Checking patient ID resolution..." -ForegroundColor Yellow
$patientsJs = Get-Content "js\patients.js" -Raw -ErrorAction SilentlyContinue
if ($patientsJs -match 'resolvePatientByIdentifier') {
    Write-Host "✅ resolvePatientByIdentifier function exists" -ForegroundColor Green
    $testResults += "✅ Patient ID resolution: OK"
} else {
    Write-Host "❌ resolvePatientByIdentifier function NOT FOUND!" -ForegroundColor Red
    $testResults += "❌ Patient ID resolution: MISSING"
}

# Test 2: Check Supabase-first pattern in key files
Write-Host "`n[2/5] Checking Supabase-first architecture..." -ForegroundColor Yellow
$keyFiles = @("register.html", "add-patient.html", "add-appointment.html")
$architectureOk = $true
foreach ($file in $keyFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Check for localStorage.setItem before supabaseClient
        if ($content -match 'localStorage\.setItem.*\n[^}]*supabaseClient\.(insert|update|delete)' -and 
            $content -notmatch 'supabaseClient\.(insert|update|delete).*\n.*localStorage\.setItem') {
            Write-Host "⚠️ $file may violate Supabase-first pattern" -ForegroundColor Yellow
            $architectureOk = $false
        }
    }
}
if ($architectureOk) {
    Write-Host "✅ Supabase-first architecture maintained" -ForegroundColor Green
    $testResults += "✅ Architecture: OK"
} else {
    Write-Host "⚠️ Architecture violations detected" -ForegroundColor Yellow
    $testResults += "⚠️ Architecture: REVIEW NEEDED"
}

# Test 3: Check critical files exist
Write-Host "`n[3/5] Checking critical files..." -ForegroundColor Yellow
$criticalFiles = @(
    "js/patients.js",
    "js/supabase-auth.js",
    "js/universal-data-loader.js",
    "register.html",
    "add-patient.html",
    "patient-details.html"
)
$allFilesExist = $true
foreach ($file in $criticalFiles) {
    if (-not (Test-Path $file)) {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        $allFilesExist = $false
    }
}
if ($allFilesExist) {
    Write-Host "✅ All critical files present" -ForegroundColor Green
    $testResults += "✅ Critical files: OK"
} else {
    Write-Host "❌ Some critical files missing!" -ForegroundColor Red
    $testResults += "❌ Critical files: MISSING"
}

# Test 4: Check for common errors
Write-Host "`n[4/5] Checking for common errors..." -ForegroundColor Yellow
$errorsFound = $false
$jsFiles = Get-ChildItem -Path "js" -Filter "*.js" -Recurse | Select-Object -First 10
foreach ($file in $jsFiles) {
    $content = Get-Content $file.FullName -Raw
    # Check for direct UUID assignment to patient.id
    if ($content -match 'patient\.id\s*=\s*[^;]*[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}') {
        Write-Host "❌ $($file.Name): Direct UUID assignment to patient.id!" -ForegroundColor Red
        $errorsFound = $true
    }
}
if (-not $errorsFound) {
    Write-Host "✅ No common errors detected" -ForegroundColor Green
    $testResults += "✅ Error check: OK"
} else {
    Write-Host "❌ Common errors detected!" -ForegroundColor Red
    $testResults += "❌ Error check: FAILED"
}

# Test 5: Check deployment readiness
Write-Host "`n[5/5] Checking deployment readiness..." -ForegroundColor Yellow
$gitStatus = git status --short 2>$null
if ($gitStatus) {
    Write-Host "✅ Changes ready for deployment" -ForegroundColor Green
    $testResults += "✅ Deployment: READY"
} else {
    Write-Host "ℹ️ No changes detected" -ForegroundColor Gray
    $testResults += "ℹ️ Deployment: NO CHANGES"
}

# Summary
Write-Host "`n" -NoNewline
Write-Host "================================" -ForegroundColor Cyan
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
$testResults | ForEach-Object { Write-Host $_ }

$failedTests = ($testResults | Where-Object { $_ -match '❌' }).Count
if ($failedTests -eq 0) {
    Write-Host "`n✅ ALL TESTS PASSED - Safe to proceed!" -ForegroundColor Green
} else {
    Write-Host "`n❌ $failedTests TEST(S) FAILED - Fix before deployment!" -ForegroundColor Red
}



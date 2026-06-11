# Pre-Deployment Validation Script
# Purpose: Comprehensive validation before deployment
# Usage: .\scripts\pre-deployment-validation.ps1

Write-Host "🛡️  PRE-DEPLOYMENT VALIDATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$allChecksPassed = $true

# Step 1: Syntax Check
Write-Host "Step 1: Syntax Validation" -ForegroundColor Yellow
Write-Host "------------------------" -ForegroundColor Yellow

$syntaxScript = Join-Path $PSScriptRoot "quick-syntax-check.ps1"
if (Test-Path $syntaxScript) {
    & $syntaxScript
    if ($LASTEXITCODE -ne 0) {
        $allChecksPassed = $false
        Write-Host "❌ Syntax check failed!" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️  Syntax check script not found, skipping..." -ForegroundColor Yellow
}

Write-Host ""

# Step 2: Critical Files Check
Write-Host "Step 2: Critical Files Validation" -ForegroundColor Yellow
Write-Host "----------------------------------" -ForegroundColor Yellow

$criticalFiles = @(
    "js/patients.js",
    "js/patient-id-normalizer.js",
    "js/patients-supabase.js"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file exists" -ForegroundColor Green
        
        # Check for common issues
        $content = Get-Content $file -Raw
        
        # Check for await in non-async functions (basic check)
        $awaitMatches = [regex]::Matches($content, 'await\s+')
        $asyncMatches = [regex]::Matches($content, 'async\s+function|async\s*\(')
        
        if ($awaitMatches.Count -gt $asyncMatches.Count) {
            Write-Host "  ⚠️  Warning: Possible await in non-async function" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ $file not found!" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

Write-Host ""

# Step 3: Architecture Compliance Check
Write-Host "Step 3: Architecture Compliance" -ForegroundColor Yellow
Write-Host "-------------------------------" -ForegroundColor Yellow

$patientsJs = Get-Content "js/patients.js" -Raw -ErrorAction SilentlyContinue
if ($patientsJs) {
    # Check for Supabase-first pattern
    if ($patientsJs -match "supabaseClient.*from.*patients.*select") {
        Write-Host "  ✅ Supabase-first pattern detected" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Warning: Supabase-first pattern not clearly visible" -ForegroundColor Yellow
    }
    
    # Check for resolvePatientByIdentifier usage
    if ($patientsJs -match "resolvePatientByIdentifier") {
        Write-Host "  ✅ resolvePatientByIdentifier usage detected" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Warning: resolvePatientByIdentifier not found" -ForegroundColor Yellow
    }
    
    # Check for getPatientIdentifier (should never return UUID)
    if ($patientsJs -match "getPatientIdentifier") {
        Write-Host "  ✅ getPatientIdentifier usage detected" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Warning: getPatientIdentifier not found" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ Cannot read js/patients.js" -ForegroundColor Red
    $allChecksPassed = $false
}

Write-Host ""

# Step 4: Git Status Check
Write-Host "Step 4: Git Status" -ForegroundColor Yellow
Write-Host "-----------------" -ForegroundColor Yellow

if (Get-Command git -ErrorAction SilentlyContinue) {
    $gitStatus = git status --short 2>&1
    if ($LASTEXITCODE -eq 0) {
        $modifiedFiles = ($gitStatus | Where-Object { $_ -match '^\s*M' }).Count
        $newFiles = ($gitStatus | Where-Object { $_ -match '^\s*\?' }).Count
        
        Write-Host "  Modified files: $modifiedFiles" -ForegroundColor Cyan
        Write-Host "  New files: $newFiles" -ForegroundColor Cyan
        
        if ($modifiedFiles -gt 0 -or $newFiles -gt 0) {
            Write-Host "  ✅ Changes detected (ready to commit)" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  No changes detected" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ⚠️  Not a git repository or git error" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  Git not found, skipping git status check" -ForegroundColor Yellow
}

Write-Host ""

# Step 5: Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

if ($allChecksPassed) {
    Write-Host "✅ All critical checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Complete manual testing (see LOCAL-TESTING-GUIDE.md)" -ForegroundColor White
    Write-Host "2. Review QUICK-PRE-DEPLOYMENT-CHECKLIST.md" -ForegroundColor White
    Write-Host "3. Deploy when ready" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ Validation failed! Fix issues before deploying." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please:" -ForegroundColor Yellow
    Write-Host "1. Fix all errors above" -ForegroundColor White
    Write-Host "2. Re-run this validation script" -ForegroundColor White
    Write-Host "3. Complete manual testing" -ForegroundColor White
    Write-Host ""
    exit 1
}


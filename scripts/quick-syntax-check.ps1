# Quick Syntax Check Script
# Purpose: Validate JavaScript syntax before deployment
# Usage: .\scripts\quick-syntax-check.ps1

Write-Host "Running JavaScript Syntax Check..." -ForegroundColor Cyan
Write-Host ""

$errors = 0
$filesChecked = 0

# List of critical JavaScript files to check
$criticalFiles = @(
    "js/mediforge-org-patient-id.js",
    "js/patients.js",
    "js/patient-id-normalizer.js",
    "js/patients-supabase.js",
    "js/appointments.js",
    "js/reports.js",
    "js/supabase-patients.js"
)

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        $filesChecked++
        Write-Host "Checking: $file" -ForegroundColor Yellow
        
        # Use Node.js to check syntax
        $result = node --check $file 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  [OK] Syntax OK" -ForegroundColor Green
        } else {
            $errors++
            Write-Host "  [ERROR] Syntax Error Found!" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
        }
    } else {
        Write-Host "[WARNING] File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Summary: $filesChecked files checked, $errors errors found" -ForegroundColor Cyan

if ($errors -eq 0) {
    Write-Host "[SUCCESS] All syntax checks passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[FAILED] Syntax errors found! Fix before deploying." -ForegroundColor Red
    exit 1
}


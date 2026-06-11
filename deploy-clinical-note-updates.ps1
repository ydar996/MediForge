# Deploy clinical-note and patient-details updates to Netlify
Write-Host "Starting Netlify deployment..." -ForegroundColor Green

# Change to project directory
Set-Location "C:\Users\yinka\Documents\MediForge"

# Deploy to Netlify with detailed deployment reason
$deployMessage = @"
Major clinical-note and patient-details UI/UX improvements:
- Removed: Physical Exam Findings, Laboratory Results, Status Changes, Further Testing fields
- Renamed: Treatments to Treatment Plan
- Hidden form sections: All input fields (Vital Signs, Diagnosis, Immunizations, Allergies, Past Medical History) now hidden until Add button clicked, auto-hide after adding
- Added: Collapse/Expand buttons for Preventive Care Gaps section (collapsed by default) on both clinical-note and patient-details
- Updated: All JavaScript functions to hide forms after adding entries
- Removed: All JavaScript references to deleted fields
- Result: Cleaner UI, better UX, all existing functionality preserved
"@

npx --yes netlify-cli deploy --prod --dir . --message $deployMessage

Write-Host "Deployment command executed." -ForegroundColor Green


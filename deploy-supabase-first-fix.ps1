# Deploy Supabase-first architecture fix for clinical note SOAP data loading
# Fixes: Load SOAP data from clinical_notes table (Supabase-first) before setting form fields

Write-Host "Deploying Supabase-first architecture fix to Netlify..." -ForegroundColor Cyan

# Deploy to Netlify
netlify deploy --prod --message "Fix: Load SOAP data from clinical_notes table (Supabase-first architecture) - ensures freeform fields persist when navigating away and back"

Write-Host "Deployment complete!" -ForegroundColor Green

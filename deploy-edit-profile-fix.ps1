Set-Location "C:\Users\yinka\Documents\MediForge"
npx --yes netlify-cli deploy --prod --dir . --message "FIX: Add personal phone field to edit-profile and fix orgData error - Added personal phone country code and number fields to edit-profile page, fixed orgData undefined error, and ensured phone data loads from and saves to Supabase users table"


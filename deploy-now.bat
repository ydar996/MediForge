@echo off
cd /d C:\Users\yinka\Documents\MediForge
npx --yes netlify-cli deploy --prod --dir . --message "FEATURE: Add mandatory country code and personal phone number fields to registration"
pause


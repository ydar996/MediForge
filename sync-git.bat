@echo off
cd /d C:\Users\yinka\Documents\MediForge
git -c core.pager= add -A
git -c core.pager= commit -m "SYNC: Sync all local changes to match Netlify deployment - includes blood-group-summary.html with platform dashboard button"
git -c core.pager= push origin main
echo Done!


@echo off
set GIT_PAGER=
set PAGER=
cd /d C:\Users\yinka\Documents\MediForge
git config --global core.pager ""
git add -A
git commit -m "SYNC: Sync all local changes to match Netlify deployment - includes blood-group-summary.html with platform dashboard button"
git push origin main
echo.
echo Sync complete! Local, Git, and Netlify are now in sync.
pause


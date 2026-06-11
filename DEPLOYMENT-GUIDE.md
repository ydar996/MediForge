# 📋 Deployment Guide - Detailed Messages

## Agent note: plain language for the user

When you explain deploys or ask for approval, use **layman's terms** — see **`AGENT-HANDOVER.md`** (“Communication with the user”). Deploy yourself when you have explicit approval; don't make the user follow a long technical checklist unless they asked to.

## 🚀 Quick Deploy with Detailed Messages

Use the new `deploy-with-details.ps1` script for automatic detailed deployment messages:

```powershell
.\deploy-with-details.ps1
```

This script will:
1. ✅ Check for uncommitted changes
2. ✅ Generate detailed message from recent commits
3. ✅ Show file changes (HTML, JS, CSS, Config, Other)
4. ✅ Deploy to Netlify with detailed message

## 📝 What Gets Included in Deployment Messages

The detailed deployment message includes:
- **Latest commit**: Hash and message
- **File counts by type**: HTML, JavaScript, CSS, Config, Other
- **File names**: Lists all changed files
- **Commit info**: Hash and date

### Example Output:
```
Deploy: 1e900e3 - Add detailed deployment message generation

Changes (4 files):
  HTML: 1 file(s) - patient-details.html
  JavaScript: 2 file(s) - js/patients.js, js/allergy-selector.js
  Config: 1 file(s) - netlify.toml

Commit: 1e900e3 | Date: 2025-12-06
```

## 🔧 Manual Deployment with Custom Message

If you want to provide your own detailed message:

```powershell
.\deploy-with-details.ps1 -CustomMessage "Your detailed message here"
```

## 📦 Using sync-and-deploy Script

The `sync-and-deploy.ps1` script now supports automatic detailed message generation:

```powershell
# Auto-generate detailed message
.\sync-and-deploy.ps1 -GenerateDetailedMessage

# Or provide custom message
.\sync-and-deploy.ps1 -Message "Your message"
```

## ✅ Benefits

- **Clear visibility**: See exactly what changed in each deployment
- **Better tracking**: Easy to identify which files were modified
- **Debugging**: Quickly find deployments that changed specific files
- **Documentation**: Deployment history shows file-level changes

## 🎯 Going Forward

All future deployments will include detailed messages showing:
- Which files were changed
- File types (HTML, JS, CSS, etc.)
- Commit information
- Change counts

This makes it much easier to track what was deployed and when!


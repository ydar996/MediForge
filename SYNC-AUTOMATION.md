# 🔄 Sync Automation Guide

This guide ensures that **Local**, **Git**, and **Netlify** are always in sync.

## 🎯 Quick Commands

### Check Sync Status
```powershell
.\sync-check.ps1
```

### Sync and Deploy (All-in-One)
```powershell
.\sync-and-deploy.ps1 -Message "Your commit message here"
```

### Manual Sync Steps
```powershell
# 1. Check status
git status

# 2. Stage and commit
git add -A
git commit -m "Your message"

# 3. Push to GitHub
git push origin main

# 4. Deploy to Netlify
netlify deploy --prod --message "Your message"
```

## 🤖 Automated Deployment

### GitHub Actions (Automatic)
When you push to `main`, GitHub Actions will automatically deploy to Netlify.

**Setup Required:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add secrets:
   - `NETLIFY_AUTH_TOKEN`: Get from `netlify auth:token`
   - `NETLIFY_SITE_ID`: Get from `netlify sites:list` or Netlify dashboard

**To get Netlify token:**
```bash
netlify login
netlify auth:token
```

**To get Site ID:**
```bash
netlify sites:list
# Or check: https://app.netlify.com/sites/mediforge/settings/general
```

### Manual Deployment (Current Method)
If GitHub Actions isn't set up, use the sync-and-deploy script:
```powershell
.\sync-and-deploy.ps1 -Message "Fix: Description of changes"
```

## 📋 Pre-Push Hook

A git hook reminds you to deploy to Netlify after pushing. It runs automatically before `git push`.

## ✅ Verification Checklist

After any deployment, verify:

- [ ] Local files committed: `git status` shows clean
- [ ] Pushed to GitHub: `git log origin/main` shows your commit
- [ ] Deployed to Netlify: Check https://mediforge.netlify.app
- [ ] Changes visible: Test the deployed site

## 🔍 Troubleshooting

### "Local and remote are out of sync"
```powershell
git pull origin main
git push origin main
```

### "Netlify deployment failed"
```powershell
# Check Netlify CLI is installed
netlify --version

# Re-authenticate
netlify login

# Try deployment again
netlify deploy --prod
```

### "GitHub Actions not deploying"
1. Check secrets are set in GitHub repo settings
2. Check Actions tab for error logs
3. Verify Netlify token is valid: `netlify auth:token`

## 📝 Best Practices

1. **Always commit before deploying**
   ```powershell
   git add -A
   git commit -m "Clear description"
   ```

2. **Use descriptive commit messages**
   - Good: "Fix encounter deletion persistence"
   - Bad: "fix"

3. **Deploy after every push**
   - Either use GitHub Actions (automatic)
   - Or run `sync-and-deploy.ps1` (manual)

4. **Verify after deployment**
   - Check the live site
   - Test the changes
   - Check console for errors

## 🚀 Current Status

- ✅ Local: Clean (all changes committed)
- ✅ Git: Synced with origin/main
- ✅ Netlify: Deployed (matches latest commit)

## 📞 Need Help?

If sync issues persist:
1. Run `.\sync-check.ps1` to diagnose
2. Check git status: `git status`
3. Check Netlify logs: `netlify logs`
4. Verify GitHub Actions (if enabled)


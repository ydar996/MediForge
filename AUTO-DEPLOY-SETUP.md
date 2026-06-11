# 🚀 Auto-Deploy Setup - Complete Guide

## Current Status

✅ **Netlify Site ID:** `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE`  
✅ **GitHub Repo:** `ydar996/MediForge`  
✅ **GitHub Actions Workflow:** Created (`.github/workflows/netlify-deploy.yml`)  
⏳ **GitHub Secrets:** Need to be added

## Option 1: Enable Netlify Continuous Deployment (EASIEST)

Netlify can automatically deploy when you push to GitHub - no GitHub Actions needed!

### Steps:

1. **Go to Netlify Dashboard:**
   - Visit: https://app.netlify.com/sites/mediforge/settings/deploys
   - Or run: `netlify open:admin` and navigate to Site settings → Build & deploy

2. **Connect to GitHub:**
   - Under "Continuous Deployment", click "Link to Git provider"
   - Select GitHub and authorize Netlify
   - Select repository: `ydar996/MediForge`
   - Select branch: `main`
   - Build command: (leave empty - no build needed)
   - Publish directory: `.` (current directory)

3. **Save Settings:**
   - Netlify will now auto-deploy on every push to `main`
   - ✅ **Done!** No GitHub Actions or secrets needed.

## Option 2: Use GitHub Actions (More Control)

If you prefer GitHub Actions for deployment:

### Step 1: Get Netlify Token

1. **Create a Netlify Personal Access Token:**
   - Go to: https://app.netlify.com/user/applications
   - Click "New access token"
   - Name it: "GitHub Actions Deploy"
   - Click "Generate token"
   - **Copy the token immediately** (you won't see it again!)

### Step 2: Add Secrets to GitHub

**Method A: Using GitHub CLI (if installed):**
```powershell
# Install GitHub CLI if needed
winget install GitHub.cli

# Authenticate
gh auth login

# Add secrets
gh secret set NETLIFY_AUTH_TOKEN --body "your-netlify-token-here"
gh secret set NETLIFY_SITE_ID --body "OLD-SITE-ID-REMOVED-CREATE-NEW-SITE"
```

**Method B: Using GitHub Web Interface:**
1. Go to: https://github.com/ydar996/MediForge/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - **Name:** `NETLIFY_AUTH_TOKEN`
   - **Value:** (paste your Netlify token)
4. Click "Add secret"
5. Repeat for:
   - **Name:** `NETLIFY_SITE_ID`
   - **Value:** `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE`

**Method C: Using PowerShell Script:**
```powershell
# Run the setup script
.\complete-setup.ps1

# Or with GitHub token:
.\complete-setup.ps1 -GitHubToken "your-github-token"
```

## Verification

After setup, test it:

1. **Make a small change:**
   ```powershell
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test auto-deploy"
   git push origin main
   ```

2. **Check deployment:**
   - **Netlify (Option 1):** Go to https://app.netlify.com/sites/mediforge/deploys
   - **GitHub Actions (Option 2):** Go to https://github.com/ydar996/MediForge/actions

3. **Verify site updated:**
   - Visit: https://mediforge.netlify.app
   - Check if your change is live

## Recommended: Option 1 (Netlify Continuous Deployment)

**Why?**
- ✅ Simpler setup (no tokens/secrets needed)
- ✅ Built-in by Netlify
- ✅ Automatic SSL and CDN
- ✅ Preview deployments for PRs
- ✅ Rollback capabilities

**Setup Time:** ~2 minutes

## Current Automation Tools

- ✅ `sync-check.ps1` - Check sync status
- ✅ `sync-and-deploy.ps1` - One-command deploy
- ✅ `.git/hooks/pre-push` - Reminder hook
- ✅ GitHub Actions workflow (if using Option 2)

## Troubleshooting

### "Deployment not triggering"
- Check Netlify is connected to GitHub (Option 1)
- Or verify GitHub secrets are set (Option 2)
- Check GitHub Actions tab for errors

### "Authentication failed"
- Verify Netlify token is valid
- Check token hasn't expired
- Regenerate token if needed

### "Site not updating"
- Clear browser cache
- Check Netlify deploy logs
- Verify build completed successfully

## Next Steps

1. **Choose your method** (Option 1 recommended)
2. **Complete setup** (follow steps above)
3. **Test deployment** (make a test commit)
4. **Enjoy auto-deployment!** 🎉

---

**Need Help?** Check the deployment logs in Netlify dashboard or GitHub Actions.


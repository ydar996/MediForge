# ⚡ Quick Setup - Auto-Deploy in 2 Minutes

## 🎯 Recommended: Netlify Continuous Deployment

**This is the EASIEST way** - Netlify handles everything automatically!

### Steps:

1. **Open Netlify Dashboard:**
   ```
   https://app.netlify.com/sites/mediforge/settings/deploys
   ```
   Or run: `netlify open:admin` and go to **Site settings → Build & deploy**

2. **Link to GitHub:**
   - Under "Continuous Deployment", click **"Link to Git provider"**
   - Select **GitHub** and authorize
   - Select repository: **`ydar996/MediForge`**
   - Select branch: **`main`**
   - **Build command:** (leave empty)
   - **Publish directory:** `.` (dot)

3. **Save!** ✅

**That's it!** Now every push to `main` automatically deploys to Netlify.

---

## 🔄 Alternative: GitHub Actions

If you prefer GitHub Actions (more control, but requires tokens):

1. **Get Netlify Token:**
   - Go to: https://app.netlify.com/user/applications
   - Create new access token
   - Copy the token

2. **Add to GitHub:**
   - Go to: https://github.com/ydar996/MediForge/settings/secrets/actions
   - Add secret: `NETLIFY_AUTH_TOKEN` = (your token)
   - Add secret: `NETLIFY_SITE_ID` = `OLD-SITE-ID-REMOVED-CREATE-NEW-SITE`

3. **Done!** GitHub Actions will auto-deploy.

---

## ✅ Test It

After setup, make a test commit:
```powershell
echo "Test" >> test.txt
git add test.txt
git commit -m "Test auto-deploy"
git push origin main
```

Check deployment at: https://app.netlify.com/sites/mediforge/deploys

---

**Need more details?** See `AUTO-DEPLOY-SETUP.md`


# User manual screenshots

The user manual (`user-manual.html` and `docs/USER-MANUAL.md`) references images in this folder.

## Option A — Already logged in on dev (easiest)

The script **cannot** see your normal browser tab. Use **remote debugging** so it attaches to Chrome/Edge while you stay logged in:

1. **Close** all Chrome/Edge windows (or use a separate profile step below).
2. Start the browser with debugging (PowerShell):

```powershell
# Edge (common on Windows)
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

```powershell
# Or Google Chrome
& "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

3. In **that** window, open https://mediforge-dev.netlify.app and log in (or you may already be logged in if it reused your profile).
4. From the project folder, run:

```powershell
$env:MANUAL_BASE_URL="https://mediforge-dev.netlify.app"
npm run manual:screenshots -- --connect
```

No username/password needed when `--connect` sees an logged-in tab.

---

## Option B — Username and password (unattended)

From the project root:

```powershell
$env:MANUAL_BASE_URL="https://mediforge-dev.netlify.app"
$env:MANUAL_USERNAME="your_username"
$env:MANUAL_PASSWORD="your_password"
npm run manual:screenshots
```

Use your **username** (e.g. `ydar2`), not always the email address.

Optional — platform admin screens:

```bash
MANUAL_PLATFORM_USERNAME=your_platform_username \
MANUAL_PLATFORM_PASSWORD=your_platform_password \
node scripts/capture-user-manual-screenshots.mjs --platform
```

Images are saved as `01-login.png`, `02-dashboard.png`, etc.

## Option B — Manual capture

1. Log in to your clinic site.
2. Take a full-window screenshot at each step listed in the manual (figure captions).
3. Save files using the exact names in `user-manual.html` (`01-login.png` … `12-org-users.png`).
4. Refresh `user-manual.html` in the browser — images appear automatically.

## File list

| File | What to capture |
|------|-----------------|
| `01-login.png` | Login page |
| `02-dashboard.png` | Main dashboard after login |
| `03-patients.png` | Patients list |
| `04-patient-details.png` | One patient’s chart / details |
| `05-clinical-note.png` | Clinical note (SOAP) screen |
| `06-appointments.png` | Appointments page |
| `07-billing.png` | Billing dashboard |
| `08-quick-checkout.png` | Quick checkout |
| `09-messages.png` | Messages inbox |
| `10-patient-portal.png` | Setup patient portal (admin) |
| `11-offline.png` | Browser offline or app offline banner (optional) |
| `12-org-users.png` | User management (admin) |

# How to get the pictures for the user manual

**Plain English.** The manual works without pictures, but pictures make it much easier for staff.

Pictures are saved in this folder:

`docs/user-manual/images/`

When a picture file exists (for example `01-login.png`), it shows up automatically in the manual at `/user-manual`.

---

## Easiest way: take screenshots yourself

You do **not** need to be a developer for this.

1. Open your clinic site in a browser (use **dev** or **staging**, not real patient data on production if you can avoid it).
   - Example: https://mediforge-dev.netlify.app
2. **Log in** like you normally do.
3. Go to each screen listed below.
4. Take a screenshot:
   - Windows: press **Windows + Shift + S**, drag around the screen, then save.
   - Or use the **Snipping Tool** app.
5. Save each image with the **exact file name** in the table below into folder  
   `C:\Users\yinka\Documents\MediForge\docs\user-manual\images\`
6. Open the manual in your browser and refresh (**Ctrl + F5**). The pictures appear.

### File names and what to photograph

| Save as this file name | Photograph this screen |
|------------------------|-------------------------|
| `01-login.png` | Login page (before you log in) |
| `13-register.png` | Register page |
| `02-dashboard.png` | Dashboard after login |
| `18-icd-settings.png` | Dashboard: scroll to “Diagnosis Codes: ICD-10-CA” button |
| `03-patients.png` | Patients list |
| `04-patient-details.png` | One open patient chart |
| `14-add-patient.png` | Add Patient form (top: name, address, race) |
| `15-manual-medication.png` | Add Patient: medication area (“Not in list…”) |
| `16-patient-intake.png` | Patient intake form (public link page) |
| `17-intake-approvals.png` | Review Patient Intake page |
| `05-clinical-note.png` | Clinical note for a patient (SOAP tabs) |
| `19-prescription.png` | Prescription screen (diagnosis + drug search) |
| `20-preventive-gaps.png` | Clinical note: Preventive Care Gaps tab expanded |
| `06-appointments.png` | Appointments page |
| `07-billing.png` | Billing dashboard |
| `08-quick-checkout.png` | Quick checkout |
| `09-messages.png` | Messages |
| `10-patient-portal.png` | Setup patient portal |
| `12-org-users.png` | User management |

You can do a few at a time: each file you add shows up right away.

---

## Optional: let the computer take all pictures at once

Only use this if you are comfortable running commands in Cursor’s terminal.  
If not, use the **Easiest way** above.

**Ask an agent:** “Capture user manual screenshots on dev”: they can run the script for you.

Or do it yourself:

1. Close all Edge/Chrome windows.
2. Open Edge with this one command in PowerShell (copy all of it):

```powershell
& "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe" --remote-debugging-port=9222
```

3. In that new browser window, go to https://mediforge-dev.netlify.app and **log in**.
4. In Cursor, open Terminal and run:

```powershell
cd C:\Users\yinka\Documents\MediForge
$env:MANUAL_BASE_URL="https://mediforge-dev.netlify.app"
npm run manual:screenshots:connect
```

5. Wait until it says **Done**. Check folder `docs/user-manual/images/` for PNG files.

---

## After you have pictures

Deploy the site (dev → staging → production) so staff see the manual with pictures on their clinic URL.

No database changes needed: pictures are just files in the project.

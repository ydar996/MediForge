# How to update the user manual when we add features

Keep clinic staff instructions in **plain language**. Update two files together so web and markdown stay in sync.

| File | Who reads it |
|------|----------------|
| `user-manual.html` | Staff in the browser (`/user-manual`) |
| `docs/USER-MANUAL.md` | Same content for GitHub / PDF export |

## Checklist for each new feature

1. **Write steps** — numbered list: what to click, what to type, what success looks like.
2. **Add a section** — new `<section id="...">` in `user-manual.html` and matching heading in `USER-MANUAL.md`.
3. **Add sidebar link** — `<aside class="sidebar">` in `user-manual.html`.
4. **Add a screenshot slot** — next number in `docs/user-manual/images/` (e.g. `19-my-feature.png`).
5. **Document the shot** — one row in `docs/user-manual/README-SCREENSHOTS.md`.
6. **Capture the image** — `npm run manual:screenshots:connect` (see README-SCREENSHOTS.md).
7. **Bump “Last updated”** — top of both manual files (month + year).
8. **Deploy** — push to `dev` → staging → production like any other change.

## Screenshot naming

Use two digits + short name: `14-add-patient.png`, `15-manual-medication.png`.

In HTML:

```html
<figure class="screenshot">
  <img src="docs/user-manual/images/14-add-patient.png" alt="Add patient form" onerror="this.dataset.missing='1'">
  <div class="screenshot-missing">Screenshot: add patient — <code>14-add-patient.png</code></div>
  <figcaption>Figure 14 — Add a new patient</figcaption>
</figure>
```

In markdown:

```markdown
![Add patient](user-manual/images/14-add-patient.png)
```

## Capture commands

```powershell
cd C:\Users\yinka\Documents\MediForge
$env:MANUAL_BASE_URL="https://mediforge-dev.netlify.app"
npm run manual:screenshots:connect
```

Use **dev or staging** (not production) for screenshots. Log in first in Chrome with `--remote-debugging-port=9222`.

## Writing style

- Say **“click”** and **“save”**, not “invoke” or “persist”.
- Name buttons exactly as they appear on screen (**Add Patient**, **Review Patient Intake**).
- One **tip** box per section for common mistakes.
- Avoid SQL, git, or Supabase in the staff manual.

## June 2026 sections added

| Section | Screenshot file |
|---------|-----------------|
| Register (Canada) | `13-register.png` |
| Add patient (race, ICD-10, meds) | `14-add-patient.png`, `15-manual-medication.png` |
| Patient self-intake | `16-patient-intake.png` |
| Approve intake | `17-intake-approvals.png` |
| ICD-10 / ICD-11 toggle | `18-icd-settings.png` |

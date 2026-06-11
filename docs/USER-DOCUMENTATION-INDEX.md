# MediForge user documentation index

**Last updated:** May 2026

## Start here (all clinic staff)

| Document | Format | Purpose |
|----------|--------|---------|
| [USER-MANUAL.md](USER-MANUAL.md) | Markdown | Complete step-by-step manual |
| [user-manual.html](../user-manual.html) | Web page | Same manual in the browser (with screenshot slots) |

## Topic guides (deeper detail)

| Document | Audience |
|----------|----------|
| [BILLING-SYSTEM-GUIDE.md](../BILLING-SYSTEM-GUIDE.md) | Reception, billing, finance |
| [HOW-TO-USE-OFFLINE-CAPABILITIES.md](../HOW-TO-USE-OFFLINE-CAPABILITIES.md) | All staff (offline work) |
| [how-to-use-offline-capabilities.html](../how-to-use-offline-capabilities.html) | Web version of offline guide |
| [INPATIENT-SETUP-GUIDE.md](../INPATIENT-SETUP-GUIDE.md) | Admins, nurses (hospital beds) |
| [USER-INSTRUCTIONS-ACCOUNT-LOCKED.md](../USER-INSTRUCTIONS-ACCOUNT-LOCKED.md) | Users stuck at registration |

## Platform owner only

| Document | Audience |
|----------|----------|
| [PLATFORM-ADMIN-GUIDE.md](../PLATFORM-ADMIN-GUIDE.md) | Platform administrator |

## Marketing / overview

| Page | Purpose |
|------|---------|
| [brochure.html](../brochure.html) | Product overview |
| [key-features.html](../key-features.html) | Feature list |

## Screenshots for the manual

See [user-manual/README-SCREENSHOTS.md](user-manual/README-SCREENSHOTS.md) or run:

```bash
npm run manual:screenshots
```

(Set `MANUAL_BASE_URL`, `MANUAL_USERNAME`, `MANUAL_PASSWORD` first.)

## Developer / deployment docs

Not for end users: `DEPLOYMENT-HANDOVER.md`, `AGENT-HANDOVER.md`, and files under `supabase/migrations/`.

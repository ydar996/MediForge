# Scalability & isolation: page coverage register

**Purpose:** Every root-level application page must be classified and reviewed. This register is **mandatory** for Phase 0 completion per SCALABILITY-AND-ISOLATION-IMPLEMENTATION-PLAN.md.

**Scope:** HTML files in the repository **root** only (`*.html` at project root).  
**Out of scope for this register:** Files under `sync-upgrade-backup*/`, `node_modules/`, etc.

**How to use:** For each row, assign **Tier** and complete **Scalability** / **Isolation** when applicable.

### Tier definitions

| Tier | Meaning | Scalability work | Isolation / RLS |
|------|---------|------------------|-----------------|
| **A** | Production clinical / business / patient-facing hot path | Required if page loads lists or syncs bulk data | Required if page reads/writes PHI or org data |
| **B** | Platform admin, security, billing ops, org management | Required if heavy lists or exports | Required |
| **C** | Internal tools, one-off migrations, debug, test harnesses | Optional; document if touches Supabase | Required if touches real PHI |
| **D** | Static / marketing / legal read-only with no tenant DB reads | Mark **N/A** | **N/A** |

### Column legend

| Column | Values |
|--------|--------|
| **Tier** | A / B / C / D (required) |
| **Scalability** | Pending / N/A / Done |
| **Isolation** | Pending / N/A / Done |
| **Primary tables / notes** | e.g. `patients`, `orders`; link to inventory row |

---

| Page | Tier | Scalability | Isolation | Primary tables / notes |
|------|------|-------------|-----------|-------------------------|
| `about-us.html` | | | | |
| `about-us-local.html` | | | | |
| `accountant-dashboard.html` | | | | |
| `ACTUALLY-FINAL-WORKING-CODE.html` | | | | |
| `ACTUALLY-WORKING-CODE.html` | | | | |
| `add-appointment.html` | | | | |
| `add-patient.html` | | | | |
| `add-unstructured-records.html` | | | | |
| `admission-form.html` | | | | |
| `admissions-dashboard.html` | | | | |
| `allergies-diagnostic.html` | | | | |
| `all-payments.html` | | | | |
| `analyze-backup-structure.html` | | | | |
| `appointment-reminder-settings.html` | | | | |
| `appointments.html` | | | | |
| `appointment-sms-reminders.html` | | | | |
| `archived-admissions.html` | | | | |
| `audit-hybrid-architecture.html` | | | | |
| `audit-localstorage-usage.html` | | | | |
| `audit-log.html` | | | | |
| `audit-log-details.html` | | | | |
| `audit-mecure-data.html` | | | | |
| `automated-audit-tool.html` | | | | |
| `backup-tool.html` | | | | |
| `billing-dashboard.html` | | | | |
| `billing-permissions.html` | | | | |
| `billing-reports.html` | | | | |
| `blood-group-detail.html` | | | | |
| `blood-group-summary.html` | | | | |
| `blood-pressure-alerts-dashboard.html` | | | | |
| `blood-pressure-alerts-patient.html` | | | | |
| `blood-pressure-check-note.html` | | | | |
| `brochure.html` | | | | |
| `bypass-app-fix.html` | | | | |
| `care-plan.html` | | | | |
| `cash-register.html` | | | | |
| `change-password.html` | | | | |
| `check-and-migrate-patients.html` | | | | |
| `check-deployment-status.html` | | | | |
| `check-mecure-address.html` | | | | |
| `check-supabase-data.html` | | | | |
| `check-supabase-dob-data.html` | | | | |
| `check-ydar109-user.html` | | | | |
| `cleanup-appointments-patients.html` | | | | |
| `cleanup-deleted-patients.html` | | | | |
| `cleanup-duplicates.html` | | | | |
| `clear-cache.html` | | | | |
| `clear-cache-simple.html` | | | | |
| `clear-localstorage.html` | | | | |
| `clear-permanent-lock.html` | | | | |
| `clinical-note.html` | | | | |
| `clinical-note-backup.html` | | | | |
| `clinical-note-clean.html` | | | | |
| `clinic-details.html` | | | | |
| `clinic-security-dashboard.html` | | | | |
| `collect-payment.html` | | | | |
| `color-scheme-examples-local.html` | | | | |
| `complete-backup-migration.html` | | | | |
| `compose-message.html` | | | | |
| `comprehensive-platform-test.html` | | | | |
| `comprehensive-sync-test.html` | | | | |
| `condition-patients.html` | | | | |
| `conditions-breakdown.html` | | | | |
| `condition-stats.html` | | | | |
| `configure-inpatient-facilities.html` | | | | |
| `configure-services.html` | | | | |
| `corrected-migration-code.html` | | | | |
| `create-auth-users.html` | | | | |
| `create-icon.html` | | | | |
| `create-test-organization.html` | | | | |
| `create-test-user.html` | | | | |
| `create-user-for-org.html` | | | | |
| `dashboard.html` | | | | |
| `data-download-approvals.html` | | | | |
| `data-import-export.html` | | | | |
| `debug-dob-tool.html` | | | | |
| `debug-localstorage.html` | | | | |
| `debug-login-issue.html` | | | | |
| `debug-mobile-data.html` | | | | |
| `debug-supabase-auth.html` | | | | |
| `debug-user-registration.html` | | | | |
| `deleted-patients.html` | | | | |
| `delete-unknown-patients.html` | | | | |
| `diagnose-broken-functionality.html` | | | | |
| `diagnose-mediforge-app.html` | | | | |
| `diagnose-patient-data.html` | | | | |
| `diagnose-user-auth.html` | | | | |
| `diagnose-user-login.html` | | | | |
| `direct-mobile-sync.html` | | | | |
| `direct-override.html` | | | | |
| `direct-supabase-fix.html` | | | | |
| `discharge-planning.html` | | | | |
| `discharge-summary.html` | | | | |
| `disease-analytics.html` | | | | |
| `doctor-lab-result-details.html` | | | | |
| `doctor-lab-results.html` | | | | |
| `e2e-test-suite.html` | | | | |
| `edit-appointment.html` | | | | |
| `edit-invoice.html` | | | | |
| `edit-patient.html` | | | | |
| `edit-payment.html` | | | | |
| `edit-pre-emr-record.html` | | | | |
| `edit-profile.html` | | | | |
| `execute-sql-fix.html` | | | | |
| `external-lab-orders.html` | | | | |
| `final-fix.html` | | | | |
| `FINAL-REALLY-WORKING-CODE.html` | | | | |
| `final-ui-safe-code.html` | | | | |
| `final-working-code.html` | | | | |
| `find-missing-clinic.html` | | | | |
| `find-missing-patients.html` | | | | |
| `find-missing-users.html` | | | | |
| `find-organization-creator.html` | | | | |
| `fix-all-organizations.html` | | | | |
| `fix-auth-user-mismatch.html` | | | | |
| `fix-database-leakage.html` | | | | |
| `fix-data-leakage.html` | | | | |
| `fixed-migration-code.html` | | | | |
| `fix-existing-patients-dob.html` | | | | |
| `fix-locked-account-misturam.html` | | | | |
| `fix-login-schema-issue.html` | | | | |
| `fix-mobile-clinic-organization.html` | | | | |
| `fix-patient-dob-migration.html` | | | | |
| `fix-user-org-id.html` | | | | |
| `force-cache-update.html` | | | | |
| `force-dob-fix.html` | | | | |
| `force-mobile-cache-bust.html` | | | | |
| `force-password-reset.html` | | | | |
| `gaps-summary.html` | | | | |
| `generate-icons.html` | | | | |
| `get-org-id.html` | | | | |
| `gl-dashboard.html` | | | | |
| `healthcare-staff.html` | | | | |
| `how-to-use-offline-capabilities.html` | | | | |
| `hybrid-solution.html` | | | | |
| `imaging-order.html` | | | | |
| `index.html` | | | | |
| `inject-fix.html` | | | | |
| `inpatient-assessment.html` | | | | |
| `inpatient-dashboard.html` | | | | |
| `investigate-missing-patients.html` | | | | |
| `invoice-details.html` | | | | |
| `invoices.html` | | | | |
| `key-features.html` | | | | |
| `key-features-local.html` | | | | |
| `lab-intervention-note.html` | | | | |
| `lab-order.html` | | | | |
| `lab-result-entry.html` | | | | |
| `lab-scientist-dashboard.html` | | | | |
| `lab-scientist-lab-result-details.html` | | | | |
| `lab-scientist-lab-results.html` | | | | |
| `legal-agreement.html` | | | | |
| `legal-agreements-admin.html` | | | | |
| `legal-agreement-sign.html` | | | | |
| `legal-agreements-org.html` | | | | |
| `legal-agreements-summary.html` | | | | |
| `legal-agreement-view.html` | | | | |
| `login.html` | | | | |
| `login-clean.html` | | | | |
| `manage-bank-accounts.html` | | | | |
| `manage-clinics.html` | | | | |
| `manage-clinics-backup.html` | | | | |
| `manage-subscription.html` | | | | |
| `messages.html` | | | | |
| `migrate-all-clinical-data.html` | | | | |
| `migrate-appointment-types.html` | | | | |
| `migrate-backup-to-supabase.html` | | | | |
| `migrate-complete-all-data.html` | | | | |
| `migrate-data-day3.html` | | | | |
| `migrate-patient-demographics.html` | | | | |
| `migrate-to-supabase.html` | | | | |
| `migrate-user-password.html` | | | | |
| `migrate-users.html` | | | | |
| `migration-safety-explanation.html` | | | | |
| `mobile-data-retrieval.html` | | | | |
| `mobile-sync-diagnostic.html` | | | | |
| `mobile-sync-selector.html` | | | | |
| `my-download-requests.html` | | | | |
| `org-user-management.html` | | | | |
| `patient-appointments.html` | | | | |
| `patient-change-password.html` | | | | |
| `patient-dashboard.html` | | | | |
| `patient-details.html` | | | | |
| `patient-documents.html` | | | | |
| `patient-encounters.html` | | | | |
| `patient-encounters-backup.html` | | | | |
| `patient-encounters-broken.html` | | | | |
| `patient-intake.html` | | | | |
| `patient-intake-approval-details.html` | | | | |
| `patient-intake-approvals.html` | | | | |
| `patient-login.html` | | | | |
| `patient-medications.html` | | | | |
| `patient-profile.html` | | | | |
| `patient-results.html` | | | | |
| `patients.html` | | | | |
| `patient-summary.html` | | | | |
| `payment-receipts.html` | | | | |
| `payments.html` | | | | |
| `performance-audit.html` | | | | |
| `performance-audit-simple.html` | | | | |
| `permanent-sync-fix.html` | | | | |
| `pharmacy-add-patient-allergy.html` | | | | |
| `pharmacy-dashboard.html` | | | | |
| `pharmacy-inventory-details.html` | | | | |
| `platform-analytics.html` | | | | |
| `platform-audit-log.html` | | | | |
| `platform-dashboard.html` | | | | |
| `platform-dashboard-backup.html` | | | | |
| `platform-dashboard-clean.html` | | | | |
| `platform-encryption-recovery.html` | | | | |
| `platform-login.html` | | | | |
| `platform-migrate-appointment-types.html` | | | | |
| `platform-security-dashboard.html` | | | | |
| `platform-settings.html` | | | | |
| `platform-subscriptions.html` | | | | |
| `populate-localstorage-from-supabase.html` | | | | |
| `pre-emr-records.html` | | | | |
| `prescription.html` | | | | |
| `pricing-catalog.html` | | | | |
| `procedure-management.html` | | | | |
| `quick-checkout.html` | | | | |
| `quick-migration.html` | | | | |
| `REALLY-FINAL-WORKING-CODE.html` | | | | |
| `REALLY-WORKING-CODE.html` | | | | |
| `recover-encryption.html` | | | | |
| `recover-lost-patient.html` | | | | |
| `recover-missing-users-admin.html` | | | | |
| `recover-orphaned-user-admin.html` | | | | |
| `recover-patient-data.html` | | | | |
| `referral-letter.html` | | | | |
| `register.html` | | | | |
| `register-clinic.html` | | | | |
| `registration-health-check.html` | | | | |
| `reports.html` | | | | |
| `reset-refresh.html` | | | | |
| `restore-appointments.html` | | | | |
| `restore-from-backup.html` | | | | |
| `restore-subscription-plans.html` | | | | |
| `restore-tool.html` | | | | |
| `restore-working-login.html` | | | | |
| `revenue-analytics.html` | | | | |
| `rounds-documentation.html` | | | | |
| `schedule.html` | | | | |
| `security-audit.html` | | | | |
| `security-audit-simple.html` | | | | |
| `security-dashboard.html` | | | | |
| `security-logs.html` | | | | |
| `security-monitoring.html` | | | | |
| `select-imaging-orders.html` | | | | |
| `select-lab-orders.html` | | | | |
| `select-medical-specialty.html` | | | | |
| `select-referrals.html` | | | | |
| `set-clinic-schedule.html` | | | | |
| `setup-encryption.html` | | | | |
| `setup-patient-portal.html` | | | | |
| `setup-test-patient.html` | | | | |
| `simple-cleanup.html` | | | | |
| `simple-dob-fix.html` | | | | |
| `simple-dob-sync.html` | | | | |
| `simple-mobile-sync.html` | | | | |
| `specialist-register.html` | | | | |
| `storage-usage.html` | | | | |
| `subscription-invoice.html` | | | | |
| `sync-localstorage-with-supabase.html` | | | | |
| `sync-mobile-data.html` | | | | |
| `sync-test.html` | | | | |
| `sync-unstructured-records.html` | | | | |
| `sync-user-profiles.html` | | | | |
| `test-abstraction-layer.html` | | | | |
| `test-audit-logging.html` | | | | |
| `test-auth-system.html` | | | | |
| `test-auto-refresh.html` | | | | |
| `test-buttons.html` | | | | |
| `test-clinic-details.html` | | | | |
| `test-dashboard-fix.html` | | | | |
| `test-dashboard-org-display.html` | | | | |
| `test-data-leakage-fix.html` | | | | |
| `test-encryption.html` | | | | |
| `test-encryption-compatibility.html` | | | | |
| `test-failed-refresh.html` | | | | |
| `test-form-persistence.html` | | | | |
| `test-functionality.html` | | | | |
| `test-manual-refresh.html` | | | | |
| `test-mobile-login.html` | | | | |
| `test-mobile-orgs.html` | | | | |
| `test-mobile-refresh.html` | | | | |
| `test-mobile-registration.html` | | | | |
| `test-patient-details-fixes.html` | | | | |
| `test-patient-fix.html` | | | | |
| `test-patient-workflow.html` | | | | |
| `test-prescription-fixes.html` | | | | |
| `test-recovery.html` | | | | |
| `test-registration-device.html` | | | | |
| `test-registration-fix.html` | | | | |
| `test-registration-minimal.html` | | | | |
| `test-registration-supabase.html` | | | | |
| `test-security-fix.html` | | | | |
| `test-security-improvements.html` | | | | |
| `test-simple-refresh.html` | | | | |
| `test-supabase-connection.html` | | | | |
| `test-supabase-migration.html` | | | | |
| `test-supabase-simple.html` | | | | |
| `test-system-working.html` | | | | |
| `test-user-login.html` | | | | |
| `test-zero-user-delete.html` | | | | |
| `todays-revenue.html` | | | | |
| `total-cash-received.html` | | | | |
| `total-revenue.html` | | | | |
| `ui-safe-migration-code.html` | | | | |
| `ultimate-fix.html` | | | | |
| `unaddressed-patients.html` | | | | |
| `unlock-all-locked-accounts.html` | | | | |
| `unlock-user-account.html` | | | | |
| `upcoming-appointments.html` | | | | |
| `verify-audit-logging-production.html` | | | | |
| `verify-fixes.html` | | | | |
| `verify-message-delivery.html` | | | | |
| `verify-migration.html` | | | | |
| `verify-org-registration.html` | | | | |
| `verify-role-permissions.html` | | | | |
| `verify-supabase-data.html` | | | | |
| `verify-supabase-dob.html` | | | | |
| `view-order.html` | | | | |
| `view-order-results.html` | | | | |
| `view-pre-emr-record.html` | | | | |
| `vital-signs-analysis.html` | | | | |
| `working-migration-code.html` | | | | |
---

**Completion rule:** Phase 0 is not complete until **every** row has **Tier** filled and **Scalability** / **Isolation** are not empty (use **N/A** where Tier D or no DB).

**Regenerate this table:** From repo root, PowerShell:

```powershell
Get-ChildItem -Filter '*.html' -File | Sort-Object Name | ForEach-Object { "| ``$($_.Name)`` | | | | |" }
```

*Generated file: row count should match root `*.html` count.*

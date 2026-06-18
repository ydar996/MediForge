# Patient portal — lab/imaging orders and results

**Last updated:** June 18, 2026

## Patient-facing status flow

| Stage | What the patient sees | What they can do |
|--------|----------------------|------------------|
| Order sent to external lab/imaging | **Order Sent** | Print / view order copy |
| Results received, not yet reviewed by doctor | **Test Completed: Awaiting Provider Review** | Print / view order copy only |
| Doctor marked reviewed | **Reviewed — results available** | View reviewed results (values, files, provider comments) |

## Staff actions

- **Doctor:** Mark as Reviewed on lab/imaging result details → publishes to patient portal automatically.
- **Pharmacy:** Filling a prescription sets **due for pickup**; patient **I picked this up** records pickup time and notifies clinic (Messages).

## SQL migrations (run per Supabase environment)

1. `supabase/migrations/20260618160000_portal_order_review_workflow.sql`
2. `supabase/migrations/20260618170000_portal_prescription_pickup_fix.sql`
3. `supabase/migrations/20260618180000_portal_order_status_order_sent.sql` (corrects order-sent vs awaiting-review in DB)

## Key files

- `patient-results.html` — Results list UI
- `patient-medications.html` — Prescriptions + pickup button
- `js/patient-portal.js` — Status logic
- `js/patient-portal-orders.js` — Order copy + reviewed results viewer
- `js/patient-data-loader.js` — Portal data fetch + prescription enrichment

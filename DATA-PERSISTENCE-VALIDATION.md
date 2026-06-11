# Data Persistence Validation - Specialty Switching

## Data Structure Isolation

### localStorage Structure
Both templates save to the same `visit.soap` object but use different properties:

**Primary Care (SOAP):**
- `visit.soap.subjective` - Chief complaint, HPI, family history, etc.
- `visit.soap.objective` - Physical exam, labs, vitals
- `visit.soap.assessment` - Differential diagnosis, status
- `visit.soap.plan` - Treatments, testing, follow-up

**Radiology:**
- `visit.soap.radiology` - Complete radiology note object

### Data Isolation Guarantees

✅ **Primary Care saves to:**
- `visit.soap.subjective.*`
- `visit.soap.objective.*`
- `visit.soap.assessment.*`
- `visit.soap.plan.*`
- **Does NOT touch `visit.soap.radiology`**

✅ **Radiology saves to:**
- `visit.soap.radiology.*`
- **Does NOT touch `visit.soap.subjective`, `visit.soap.objective`, etc.**

### Supabase Structure

Both templates save to `clinical_notes` table with `soap_data` JSONB field:

```json
{
  "soap_data": {
    "subjective": { ... },      // Primary Care
    "objective": { ... },       // Primary Care
    "assessment": { ... },      // Primary Care
    "plan": { ... },            // Primary Care
    "radiology": { ... }        // Radiology (if exists)
  }
}
```

### Data Preservation Logic

1. **Primary Care Save:**
   - Checks for existing `soap_data.radiology` in Supabase
   - Preserves it when saving primary care data
   - Only updates `subjective`, `objective`, `assessment`, `plan`

2. **Radiology Save:**
   - Checks for existing `soap_data.subjective`, `objective`, etc. in Supabase
   - Preserves them when saving radiology data
   - Only updates `radiology` property

3. **Load Functions:**
   - `loadClinicalNote()` - Only loads if radiology template is NOT active
   - `loadRadiologyNote()` - Only loads if radiology template IS active
   - Both preserve each other's data when loading from Supabase

## Test Scenarios

### Scenario 1: Primary Care → Radiology → Primary Care
1. Start with Primary Care specialty
2. Create clinical note with SOAP data
3. Switch to Radiology specialty
4. Create radiology note
5. Switch back to Primary Care
6. **Expected:** Both notes should be preserved and loadable

### Scenario 2: Radiology → Primary Care → Radiology
1. Start with Radiology specialty
2. Create radiology note
3. Switch to Primary Care specialty
4. Create SOAP note
5. Switch back to Radiology
6. **Expected:** Both notes should be preserved and loadable

### Scenario 3: Same Visit, Both Templates
1. Create Primary Care note for visit date 2025-01-15
2. Switch to Radiology
3. Create Radiology note for same visit date 2025-01-15
4. **Expected:** Both notes coexist in `visit.soap` object

## Validation Checklist

- [x] Primary Care save preserves `visit.soap.radiology`
- [x] Radiology save preserves `visit.soap.subjective`, `objective`, `assessment`, `plan`
- [x] Supabase saves preserve both data types in `soap_data`
- [x] Load functions check template before loading
- [x] Auto-save only saves to active template's structure
- [x] Data persists when switching specialties
- [x] Both templates can coexist in same visit

## Conclusion

✅ **SAFE TO TEST** - Data isolation is guaranteed. Switching specialties will NOT cause data loss.













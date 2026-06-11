# Dynamic Clinical Note Based on Medical Specialty - Implementation Plan

## Overview
Modify `clinical-note.html` to dynamically show different note templates based on the organization's selected medical specialty. The note experience changes when the specialty changes, and it's fully reversible.

## Key Requirements
1. ✅ Detect organization's specialty on page load
2. ✅ Show Primary Care (SOAP) format by default
3. ✅ Show Radiology format when specialty is "Radiology"
4. ✅ Fully reversible - changing specialty changes the note experience
5. ✅ Use ICD-11 codes (not ICD-10)
6. ✅ Maintain same data structure (visit.soap) for compatibility
7. ✅ Save/load works for both formats

## Implementation Strategy

### 1. Specialty Detection
- Load organization specialty using `getOrganizationSpecialty()` from `js/medical-specialties.js`
- Check on page load
- Store in a global variable for easy access

### 2. Dynamic UI Switching
- Wrap Primary Care (SOAP) sections in: `<div class="note-template primary-care-template">`
- Add Radiology sections in: `<div class="note-template radiology-template" style="display: none;">`
- Use CSS classes to show/hide based on specialty

### 3. Data Structure
- Primary Care: Uses existing `visit.soap.subjective`, `visit.soap.objective`, `visit.soap.assessment`, `visit.soap.plan`
- Radiology: Uses `visit.soap.radiology` object with radiology-specific fields
- Both save to same `visit.soap` structure, just organized differently

### 4. Save/Load Functions
- Modify `saveClinicalNoteData()` to check specialty and save accordingly
- Modify `loadClinicalNote()` to check specialty and load accordingly
- Handle both formats seamlessly

### 5. ICD-11 Integration
- Update any ICD-10 references to ICD-11
- Use existing `js/icd11.js` and `js/icd-selector.js`

## Files to Modify
1. `clinical-note.html` - Add specialty detection, dynamic UI, radiology sections
2. `js/patients.js` - Update save/load functions to handle specialty-based formats

## Files NOT Modified
- ❌ No changes to database schema
- ❌ No changes to data structure (just organization)
- ❌ No breaking changes to existing functionality













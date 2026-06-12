const fs = require('fs');
const path = 'js/patients.js';
let s = fs.readFileSync(path, 'utf8');

s = s.replace(
  `    // Get tribe value - handle searchable dropdown
    let tribeValue = '';
    const tribeSelect = document.getElementById("tribe");
    const tribeInput = document.getElementById("tribe-search"); // Searchable dropdown input
    if (tribeInput && tribeInput.value) {
      // If searchable dropdown exists, get value from input text and find matching option
      const inputText = tribeInput.value.trim();
      if (tribeSelect) {
        // Find option that matches the input text
        const matchingOption = Array.from(tribeSelect.options).find(opt => 
          opt.textContent.trim() === inputText || opt.value === inputText
        );
        tribeValue = matchingOption ? matchingOption.value : inputText;
      } else {
        tribeValue = inputText;
      }
    } else if (tribeSelect) {
      tribeValue = tribeSelect.value || '';
    }
    
    console.log('🔍 [EDIT-PATIENT] Saving patient data:', {
      middleName: document.getElementById("middleName").value,
      tribe: tribeValue,
      tribeSelectValue: tribeSelect ? tribeSelect.value : 'NO SELECT',
      tribeInputValue: tribeInput ? tribeInput.value : 'NO INPUT'
    });`,
  `    const raceValue = (document.getElementById("race")?.value || '').trim();
    
    console.log('🔍 [EDIT-PATIENT] Saving patient data:', {
      middleName: document.getElementById("middleName").value,
      race: raceValue
    });`
);

s = s.replace(
  `      tribe: tribeValue,`,
  `      race: raceValue,
      tribe: raceValue,`
);

// Required field label
s = s.replace(`{ id: "tribe", label: "Tribe" }`, `{ id: "race", label: "Race" }`);
s = s.replace(/"tribe"/g, (m, offset) => {
  const slice = s.slice(Math.max(0, offset - 40), offset + 20);
  if (slice.includes('maritalStatus') || slice.includes('requiredFields') || slice.includes('firstName')) return '"race"';
  return m;
});

// Supabase load - add race
s = s.replace(
  /tribe: supabasePatient\.tribe \|\| ''/g,
  `race: supabasePatient.race || supabasePatient.tribe || '',
              tribe: supabasePatient.race || supabasePatient.tribe || ''`
);

s = s.replace(
  /tribe: patient\.tribe \|\| ''/g,
  `race: patient.race || patient.tribe || '',
            tribe: patient.race || patient.tribe || ''`
);

s = s.replace(
  `tribe: document.getElementById("tribe").value,`,
  `race: document.getElementById("race").value,
        tribe: document.getElementById("race").value,`
);

s = s.replace(
  `tribe: document.getElementById("tribe")?.value || '',`,
  `race: document.getElementById("race")?.value || '',
          tribe: document.getElementById("race")?.value || '',`
);

s = s.replace(
  /tribe: patient\.tribe \|\| null/g,
  `race: patient.race || patient.tribe || null,
        tribe: patient.race || patient.tribe || null`
);

s = s.replace(
  /tribe: updated\.tribe \|\| null/g,
  `race: updated.race || updated.tribe || null,
            tribe: updated.race || updated.tribe || null`
);

s = s.replace(
  /marital_status: ([^,]+),\s*\n\s*tribe:/g,
  `marital_status: $1,
            race:`
);

s = s.replace(/updateData\.tribe = tribe/g, 'updateData.race = race; updateData.tribe = race');
s = s.replace(/let tribe = \(patient\.tribe/g, 'let race = (patient.race || patient.tribe');
s = s.replace(/if \(tribe\)/g, 'if (race)');
s = s.replace(/patient\.tribe = tribe/g, 'patient.race = race; patient.tribe = race');
s = s.replace(/const tribe = \(p\.tribe/g, 'const race = (p.race || p.tribe');
s = s.replace(/tribe\.includes\(query\)/g, 'race.includes(query)');

// Edit patient load - replace long tribe block with race populate
const tribeLoadStart = s.indexOf('  // DEBUG: Log tribe value before setting');
const tribeLoadEnd = s.indexOf('  setValue("email"', tribeLoadStart);
if (tribeLoadStart !== -1 && tribeLoadEnd !== -1) {
  const replacement = `  const raceValue = (typeof window.normalizePatientRaceForLoad === 'function'
    ? window.normalizePatientRaceForLoad(patient)
    : (patient.race || patient.tribe || ''));
  if (typeof window.populatePatientRaceSelect === 'function') {
    window.populatePatientRaceSelect(document.getElementById('race'), raceValue);
  } else {
    setValue("race", raceValue);
  }

  `;
  s = s.slice(0, tribeLoadStart) + replacement + s.slice(tribeLoadEnd);
}

s = s.replace(`tribe: document.getElementById('tribe')?.value || 'NOT SET'`, `race: document.getElementById('race')?.value || 'NOT SET'`);

fs.writeFileSync(path, s);
console.log('patients.js patched');

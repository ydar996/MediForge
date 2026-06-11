// Vaccine data for immunization selection
// This file contains the comprehensive list of vaccines with their details
// Last updated: [Current Date]

// Make VACCINES_DATA available globally
const VACCINES_DATA = [
  {
    name: "BCG",
    status: "Mandatory",
    purpose: "Tuberculosis and Leprosy",
    recommendedAges: "Children: 1 dose at birth (universal in high TB/leprosy burden areas, selective in low burden areas); Adolescents and Adults: 1 dose for unvaccinated TST- or IGRA-negative individuals from high TB/leprosy settings, those moving to high burden areas, or at occupational risk; Not recommended during pregnancy."
  },
  {
    name: "Hepatitis B",
    status: "Mandatory",
    purpose: "Hepatitis B",
    recommendedAges: "Children: 3-4 doses, birth dose (within 24 hours, even for low birth weight/premature infants), followed by 2-3 additional doses (at least 4 weeks apart, often with DTP-containing vaccine); Adults: 3 doses for high-risk unvaccinated groups (0, 1, 6 months); Catch-up priority for younger ages."
  },
  {
    name: "Polio",
    status: "Mandatory",
    purpose: "Poliomyelitis",
    recommendedAges: "Children: 3-5 doses, including at least 2 doses of IPV, with bOPV starting at 6 weeks (4 weeks apart), first IPV at 14 weeks (with DTP3), second IPV 4 months later, or early schedule starting IPV at 6 weeks; In polio-endemic/high-risk areas, bOPV birth dose; Catch-up for missed doses."
  },
  {
    name: "DTP-containing vaccine (DTPCV)",
    status: "Mandatory",
    purpose: "Diphtheria, Tetanus, Pertussis",
    recommendedAges: "Children: 3 primary doses starting at 6 weeks (4 weeks apart, completed by 6 months), 2 boosters at 12-23 months (DTPCV) and 4-7 years (Td/DT), 1 booster at 9-15 years (Td); Adolescents: Booster at 9-15 years (Td); Adults: 5 doses total if started later; Pregnant women: 1 dose Tdap (2nd/3rd trimester, preferably 15 days before delivery)."
  },
  {
    name: "Haemophilus influenzae type b (Hib)",
    status: "Mandatory",
    purpose: "Haemophilus influenzae type b disease",
    recommendedAges: "Children: 3 doses with DTPCV, single dose if >12 months, not recommended >5 years; or 2-3 doses with booster at least 6 months after last dose, start at 6 weeks; Catch-up for interrupted schedules."
  },
  {
    name: "Pneumococcal (Conjugate)",
    status: "Mandatory",
    purpose: "Pneumococcal disease",
    recommendedAges: "Children: 3 primary doses (3p+0) starting at 6 weeks, 4 weeks apart; or 2 primary doses plus booster at 9-18 months (2p+1), 8 weeks between primary doses; Catch-up for 1-5 years, prioritize <2 years."
  },
  {
    name: "Rotavirus",
    status: "Mandatory",
    purpose: "Rotavirus gastroenteritis",
    recommendedAges: "Children: 2-3 doses depending on product, first dose as soon as possible after 6 weeks, complete before 24 months; Not recommended >24 months."
  },
  {
    name: "Measles",
    status: "Mandatory",
    purpose: "Measles",
    recommendedAges: "Children: 2 doses, MCV1 at 9 months in high transmission areas, 12 months in low transmission, MCV2 at 15-18 months (minimum 4 weeks after MCV1), supplementary dose from 6 months in high-risk; Catch-up for missed doses, especially <15 years; Avoid during pregnancy."
  },
  {
    name: "Rubella",
    status: "Mandatory",
    purpose: "Rubella",
    recommendedAges: "Children: 1 dose, at 9 or 12 months depending on measles transmission, often combined with measles vaccine; Adolescents: 1 dose for unvaccinated girls/women of reproductive age; Adults: Same as adolescents; Avoid during pregnancy, delay pregnancy 1 month post-vaccination."
  },
  {
    name: "Human Papillomavirus (HPV)",
    status: "Mandatory",
    purpose: "Human Papillomavirus infection and Cervical cancer",
    recommendedAges: "Children/Adolescents: Primary target girls 9-14 years, 1 or 2 doses (0, 6 months if 2); Boys if resources allow; Adults: Catch-up for unvaccinated up to 26 years or older if high risk."
  },
  {
    name: "Japanese Encephalitis (Inactivated Vero cell-derived)",
    status: "Optional",
    purpose: "Japanese Encephalitis",
    recommendedAges: "Endemic settings,≥6 months, 2 doses (4 weeks apart, generally)."
  },
  {
    name: "Japanese Encephalitis (Live attenuated)",
    status: "Optional",
    purpose: "Japanese Encephalitis",
    recommendedAges: "Endemic settings,≥8 months, 1 dose."
  },
  {
    name: "Japanese Encephalitis (Live recombinant)",
    status: "Optional",
    purpose: "Japanese Encephalitis",
    recommendedAges: "Endemic settings,≥9 months, 1 dose."
  },
  {
    name: "Yellow Fever",
    status: "Optional",
    purpose: "Yellow Fever",
    recommendedAges: "Certain regions,9-12 months, 1 dose with measles containing vaccine."
  },
  {
    name: "Tick-Borne Encephalitis (FSME-Immun & Encepur)",
    status: "Optional",
    purpose: "Tick-Borne Encephalitis",
    recommendedAges: "Certain regions,≥1 year, 3 doses (1st to 2nd 1-3 mos, 2nd to 3rd 12 mos), at least 1 booster."
  },
  {
    name: "Tick-Borne Encephalitis (TBE_Moscow & EnceVir)",
    status: "Optional",
    purpose: "Tick-Borne Encephalitis",
    recommendedAges: "Certain regions,≥3 years, 3 doses (1st to 2nd 1-7 mos, 2nd to 3rd 12 mos), every 3 years."
  },
  {
    name: "Typhoid (TCV-Typbar)",
    status: "Optional",
    purpose: "Typhoid",
    recommendedAges: "High-risk populations, outbreak response,>6 months, 1 dose."
  },
  {
    name: "Typhoid (Vi PS)",
    status: "Optional",
    purpose: "Typhoid",
    recommendedAges: "High-risk populations, outbreak response,≥2 years, 1 dose, every 3 years."
  },
  {
    name: "Typhoid (Ty21a Capsules)",
    status: "Optional",
    purpose: "Typhoid",
    recommendedAges: "High-risk populations, outbreak response,≥6 years, 3-4 doses (every second day), every 3-7 years."
  },
  {
    name: "Cholera (Dukoral, WC-rBS)",
    status: "Optional",
    purpose: "Cholera",
    recommendedAges: "High-risk populations, outbreak response,≥2 years, 2-5 yrs: 3 doses, ≥6 yrs: 2 doses (≥7 days apart), 2-5 yrs: every 6 months, ≥6 yrs: every 2 years."
  },
  {
    name: "Cholera (Shanchol, Euvchol, mORCVAX)",
    status: "Optional",
    purpose: "Cholera",
    recommendedAges: "High-risk populations, outbreak response,≥1 year, 2 doses (2 weeks apart), after 2 years."
  },
  {
    name: "Meningococcal (MenA conjugate)",
    status: "Optional",
    purpose: "Meningococcal disease",
    recommendedAges: "High-risk populations,9-18 months, 1 dose; if <9 months, 2 doses (8 weeks apart)."
  },
  {
    name: "Meningococcal (MenC conjugate)",
    status: "Optional",
    purpose: "Meningococcal disease",
    recommendedAges: "High-risk populations,2-11 months, 2 doses (8 weeks min), booster after 1 year; ≥12 months, 1 dose."
  },
  {
    name: "Meningococcal (Quadrivalent conjugate)",
    status: "Optional",
    purpose: "Meningococcal disease",
    recommendedAges: "High-risk populations,9-23 months, 2 doses (12 weeks min); ≥2 years, 1 dose."
  },
  {
    name: "Hepatitis A (Inactivated)",
    status: "Optional",
    purpose: "Hepatitis A",
    recommendedAges: "High-risk populations, immunocompromised, pregnant women at risk,>12 months, 1 or 2 doses (interval 6-18 months, up to 4-5 years)."
  },
  {
    name: "Hepatitis A (Live attenuated)",
    status: "Optional",
    purpose: "Hepatitis A",
    recommendedAges: "High-risk populations,≥18 months, 1 dose."
  },
  {
    name: "Rabies",
    status: "Optional",
    purpose: "Rabies",
    recommendedAges: "High-risk populations, frequent/continual exposure risk,As required, 2 doses (7 days apart), only if occupation puts frequent or continual risk, test titres if possible."
  },
  {
    name: "Dengue (TAK-003)",
    status: "Optional",
    purpose: "Dengue",
    recommendedAges: "High-risk populations, settings with high dengue transmission,6-16 years, 2 doses (3 months apart)."
  },
  {
    name: "Malaria",
    status: "Optional",
    purpose: "Malaria",
    recommendedAges: "High-risk populations,5 months, 4 doses (4 weeks apart, 4th dose 12 months after 3rd)."
  },
  {
    name: "Mumps",
    status: "Optional",
    purpose: "Prevents mumps",
    recommendedAges: "2 doses with measles and rubella containing vaccine, following same schedule as MR (typically first dose at 9-12 months, second at 15-18 months)"
  },
  {
    name: "Seasonal Influenza (Inactivated tri-and quadri-valent)",
    status: "Optional",
    purpose: "Prevents seasonal influenza",
    recommendedAges: "2 doses at least 4 weeks apart for children 6 months-8 years (first vaccination); 1 annual dose for those ≥9 years, healthy adults, and previously vaccinated; annual revaccination for all"
  },
  {
    name: "Seasonal Influenza (Live attenuated)",
    status: "Optional",
    purpose: "Prevents seasonal influenza",
    recommendedAges: "1 annual dose for children 2-17 years; not recommended for children <2 years, adults (including older adults and those with comorbidities), or during pregnancy"
  },
  {
    name: "Varicella",
    status: "Optional",
    purpose: "Prevents varicella (chickenpox)",
    recommendedAges: "1-2 doses, first dose at 12-18 months, minimum interval between doses 4 weeks to 3 months; for adolescents and adults without evidence of immunity: 2 doses"
  }
];

// Function to get all vaccine names for dropdown/autocomplete
function getVaccineNames() {
  return VACCINES_DATA.map(vaccine => vaccine.name);
}

// Function to get vaccine details by name
function getVaccineDetails(vaccineName) {
  return VACCINES_DATA.find(vaccine => vaccine.name === vaccineName);
}

// Function to search vaccines by name (for autocomplete)
function searchVaccines(query) {
  if (!query) return VACCINES_DATA;
  const lowerQuery = query.toLowerCase();
  return VACCINES_DATA.filter(vaccine => 
    vaccine.name.toLowerCase().includes(lowerQuery) ||
    vaccine.purpose.toLowerCase().includes(lowerQuery)
  );
}

// Make available globally for browser usage
if (typeof window !== 'undefined') {
  window.VACCINES_DATA = VACCINES_DATA;
  window.getVaccineNames = getVaccineNames;
  window.getVaccineDetails = getVaccineDetails;
  window.searchVaccinesData = searchVaccines;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VACCINES_DATA,
    getVaccineNames,
    getVaccineDetails,
    searchVaccines
  };
}

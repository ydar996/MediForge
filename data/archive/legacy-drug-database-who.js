/**
 * ARCHIVE - NOT LOADED BY THE EMR.
 * Legacy WHO Essential Medicines + African hospital formulary seed list.
 * Superseded by js/canadian-formulary.js (Health Canada DPD, ~15k products).
 * Kept for reference only.
 */
// Drug Database (Essential Medicines List - WHO)
const DRUG_DATABASE = [
  // Cardiovascular
  { name: "Amlodipine", generic: "Amlodipine", strength: "5mg, 10mg", form: "Tablet", category: "Cardiovascular", interactions: ["Grapefruit"], contraindications: ["Severe hypotension"] },
  { name: "Lisinopril", generic: "Lisinopril", strength: "5mg, 10mg, 20mg", form: "Tablet", category: "Cardiovascular", interactions: ["Potassium supplements"], contraindications: ["Pregnancy", "Angioedema"] },
  { name: "Metoprolol", generic: "Metoprolol", strength: "25mg, 50mg, 100mg", form: "Tablet", category: "Cardiovascular", interactions: ["Verapamil"], contraindications: ["Heart block", "Severe heart failure"] },
  
  // Diabetes
  { name: "Metformin", generic: "Metformin", strength: "500mg, 850mg, 1000mg", form: "Tablet", category: "Diabetes", interactions: ["Contrast agents"], contraindications: ["Severe kidney disease", "Liver disease"] },
  { name: "Insulin Glargine", generic: "Insulin Glargine", strength: "100 units/ml", form: "Injection", category: "Diabetes", interactions: [], contraindications: ["Hypoglycemia"] },
  
  // Antibiotics
  { name: "Amoxicillin", generic: "Amoxicillin", strength: "250mg, 500mg, 875mg", form: "Capsule", category: "Antibiotic", interactions: ["Warfarin"], contraindications: ["Penicillin allergy"] },
  { name: "Azithromycin", generic: "Azithromycin", strength: "250mg, 500mg", form: "Tablet", category: "Antibiotic", interactions: ["Warfarin", "Digoxin"], contraindications: ["QT prolongation"] },
  { name: "Ciprofloxacin", generic: "Ciprofloxacin", strength: "250mg, 500mg, 750mg", form: "Tablet", category: "Antibiotic", interactions: ["Warfarin", "Theophylline"], contraindications: ["Tendon rupture risk"] },
  
  // Pain Management
  { name: "Paracetamol", generic: "Paracetamol", strength: "500mg, 1000mg", form: "Tablet", category: "Analgesic", interactions: ["Warfarin"], contraindications: ["Liver disease"] },
  { name: "Ibuprofen", generic: "Ibuprofen", strength: "200mg, 400mg, 600mg", form: "Tablet", category: "NSAID", interactions: ["Warfarin", "ACE inhibitors"], contraindications: ["Peptic ulcer", "Kidney disease"] },
  { name: "Morphine", generic: "Morphine", strength: "10mg, 15mg, 30mg", form: "Tablet", category: "Opioid", interactions: ["Benzodiazepines"], contraindications: ["Respiratory depression"] },
  
  // Gastrointestinal
  { name: "Omeprazole", generic: "Omeprazole", strength: "20mg, 40mg", form: "Capsule", category: "PPI", interactions: ["Warfarin", "Clopidogrel"], contraindications: ["Hypomagnesemia"] },
  { name: "Ranitidine", generic: "Ranitidine", strength: "150mg, 300mg", form: "Tablet", category: "H2 Blocker", interactions: ["Warfarin"], contraindications: ["Porphyria"] },
  
  // Respiratory
  { name: "Salbutamol", generic: "Salbutamol", strength: "100mcg", form: "Inhaler", category: "Bronchodilator", interactions: [], contraindications: ["Hypersensitivity"] },
  { name: "Prednisolone", generic: "Prednisolone", strength: "5mg, 20mg, 40mg", form: "Tablet", category: "Steroid", interactions: ["Warfarin", "Insulin"], contraindications: ["Systemic fungal infection"] },
  
  // Traditional African Medicines (examples)
  { name: "Artemisinin", generic: "Artemisinin", strength: "50mg, 100mg", form: "Tablet", category: "Antimalarial", interactions: [], contraindications: ["First trimester pregnancy"] },
  { name: "Moringa Oleifera", generic: "Moringa", strength: "500mg", form: "Capsule", category: "Supplement", interactions: ["Warfarin"], contraindications: ["Pregnancy"] }
];

// Augment database with additional African-context medicines and remove duplicates
(function augmentAndDeduplicateDrugDatabase() {
  const ADDITIONAL_DRUGS = [
    { name: "Halothane", generic: "Halothane", strength: "250-mL bottle", form: "Inhalation (volatile liquid)", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Inhalational medicines", interactions: [], contraindications: [] },
    { name: "Isoflurane", generic: "Isoflurane", strength: "250-mL bottle", form: "Inhalation (volatile liquid)", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Inhalational medicines", interactions: [], contraindications: [] },
    { name: "Nitrous oxide", generic: "Nitrous oxide", strength: "", form: "Inhalation", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Inhalational medicines", interactions: [], contraindications: [] },
    { name: "Oxygen", generic: "Oxygen", strength: "", form: "Inhalation", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Inhalational medicines", interactions: [], contraindications: [] },
    { name: "Sevoflurane", generic: "Sevoflurane", strength: "250-mL bottle", form: "Inhalation (volatile liquid)", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Inhalational medicines", interactions: [], contraindications: [] },
    { name: "Ketamine", generic: "Ketamine", strength: "50 mg (hydrochloride)/mL in 10-mL vial, 100 mg (hydrochloride)/mL in 5-mL vial", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Injectable medicines", interactions: [], contraindications: [] },
    { name: "Propofol", generic: "Propofol", strength: "10 mg/mL in 20-mL ampoule", form: "Injection (emulsion)", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Injectable medicines", interactions: [], contraindications: [] },
    { name: "Thiopental", generic: "Thiopental", strength: "10 mg/mL, 20 mg/mL", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - General anaesthetics and oxygen - Injectable medicines", interactions: [], contraindications: [] },
    { name: "Bupivacaine", generic: "Bupivacaine", strength: "0.25%, 0.5% (hydrochloride) in vial, 0.5% (hydrochloride) in 4-mL ampoule", form: "Injection, Injection for spinal anaesthesia", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Local anaesthetics", interactions: [], contraindications: [] },
    { name: "Lidocaine", generic: "Lidocaine", strength: "1%, 2% (hydrochloride) in vial, 5% (hydrochloride) in 2-mL ampoule, 2%, 4% creams", form: "Injection, Injection for spinal anaesthesia, Topical", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Local anaesthetics", interactions: [], contraindications: [] },
    { name: "Atropine", generic: "Atropine", strength: "600 mcg (sulfate) in 1-mL ampoule, 1 mg (sulfate) in 1-mL ampoule", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Clonidine", generic: "Clonidine", strength: "500 mcg in 1-mL ampoule, 0.1 mg, 0.2 mg", form: "Injection, Tablet", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Diazepam", generic: "Diazepam", strength: "5 mg/mL in 2-mL ampoule", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Midazolam", generic: "Midazolam", strength: "1 mg/mL in 1-mL ampoule, 2-mL and 5-mL ampoule, 2 mg/mL in 2-mL and 5-mL ampoule, 2 mg/mL", form: "Injection, Oral Liquid", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Morphine", generic: "Morphine", strength: "10 mg, 15 mg (sulfate or hydrochloride) in 1-mL ampoule, 0.5 mg/mL, 1 mg/mL in 10-mL vials (preservative-free)", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Promethazine", generic: "Promethazine", strength: "25 mg/mL, 12.5 mg, 25 mg, 5 mg/mL, 12.5 mg, 25 mg", form: "Injection, Suppository, Oral liquid, Tablet", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Preoperative medication and anaesthetic adjuvants", interactions: [], contraindications: [] },
    { name: "Oxygen", generic: "Oxygen", strength: "", form: "Inhalation", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Medical gases", interactions: [], contraindications: [] },
    { name: "Atracurium", generic: "Atracurium", strength: "10 mg/mL", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Skeletal muscle relaxants and cholinesterase inhibitors", interactions: [], contraindications: [] },
    { name: "Neostigmine", generic: "Neostigmine", strength: "0.5 mg/mL, 1 mg/mL, 2.5 mg/mL (methylsulfate) in 1-mL ampoule", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Skeletal muscle relaxants and cholinesterase inhibitors", interactions: [], contraindications: [] },
    { name: "Pancuronium", generic: "Pancuronium", strength: "2 mg (bromide)/mL", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Skeletal muscle relaxants and cholinesterase inhibitors", interactions: [], contraindications: [] },
    { name: "Suxamethonium", generic: "Suxamethonium", strength: "20 mg/mL, 50 mg/mL, 100 mg/mL (chloride) in 2-mL ampoule", form: "Injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Skeletal muscle relaxants and cholinesterase inhibitors", interactions: [], contraindications: [] },
    { name: "Vecuronium", generic: "Vecuronium", strength: "10 mg, 20 mg (bromide) in vial", form: "Powder for injection", category: "Anaesthetics, Preoperative Medicines, and Medical Gases - Skeletal muscle relaxants and cholinesterase inhibitors", interactions: [], contraindications: [] },
    { name: "Dexamethasone", generic: "Dexamethasone", strength: "4 mg (disodium phosphate)/mL in 1-mL ampoule", form: "Injection", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-anaphylactics", interactions: [], contraindications: [] },
    { name: "Epinephrine (Adrenaline)", generic: "Epinephrine (Adrenaline)", strength: "1 mg (hydrochloride or hydrogen tartrate) in 1-mL ampoule", form: "Injection", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-anaphylactics", interactions: [], contraindications: [] },
    { name: "Hydrocortisone", generic: "Hydrocortisone", strength: "100 mg (sodium succinate) in vial", form: "Powder for injection", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-anaphylactics", interactions: [], contraindications: [] },
    { name: "Prednisolone", generic: "Prednisolone", strength: "5 mg/mL, 15 mg/5mL, 5 mg, 25 mg", form: "Oral liquid, Tablet", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-anaphylactics", interactions: [], contraindications: [] },
    { name: "Chlorphenamine", generic: "Chlorphenamine", strength: "10 mg (maleate) in 1-mL ampoule, 2 mg/5 mL", form: "Injection, Oral liquid", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-histamines", interactions: [], contraindications: [] },
    { name: "Loratadine", generic: "Loratadine", strength: "1 mg/mL, 10 mg", form: "Oral liquid, Tablet", category: "Antiallergics and Medicines Used in Anaphylaxis - Anti-histamines", interactions: [], contraindications: [] }
  ];

  const toKey = (d) => `${(d.name||'').trim().toLowerCase()}|${(d.form||'').trim().toLowerCase()}|${(d.strength||'').trim().toLowerCase()}`;
  const seen = new Set();
  const unique = [];

  // Seed map with existing items
  for (const d of DRUG_DATABASE) {
    const k = toKey(d);
    if (!seen.has(k)) {
      unique.push(d);
      seen.add(k);
    }
  }
  // Add new items if not present
  for (const d of ADDITIONAL_DRUGS) {
    const k = toKey(d);
    if (!seen.has(k)) {
      if (!Array.isArray(d.interactions)) d.interactions = [];
      if (!Array.isArray(d.contraindications)) d.contraindications = [];
      unique.push(d);
      seen.add(k);
    }
  }
  // Mutate original array to preserve reference used by the app
  DRUG_DATABASE.length = 0;
  Array.prototype.push.apply(DRUG_DATABASE, unique);
})();

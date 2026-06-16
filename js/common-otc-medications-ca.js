/**
 * Curated OTC shortcuts for patient-reported medication browse (spacebar quick-pick).
 * Prescribing and typed search use Health Canada DPD via js/canadian-formulary.js.
 * Generic names with familiar Canadian brand examples in the display name.
 */
window.COMMON_OTC_MEDICATIONS_CA = [
  { name: "Acetaminophen (Tylenol)", generic: "Acetaminophen", strength: "325mg, 500mg, 650mg extra strength", form: "Tablet, Caplet, Liquid", category: "OTC - Analgesic", interactions: [], contraindications: [] },
  { name: "Ibuprofen (Advil, Motrin)", generic: "Ibuprofen", strength: "200mg, 400mg", form: "Tablet, Caplet, Liquid gel", category: "OTC - NSAID", interactions: [], contraindications: [] },
  { name: "Naproxen sodium (Aleve)", generic: "Naproxen", strength: "220mg", form: "Tablet, Caplet", category: "OTC - NSAID", interactions: [], contraindications: [] },
  { name: "Acetylsalicylic acid (Aspirin)", generic: "Aspirin", strength: "81mg, 325mg", form: "Tablet, Chewable", category: "OTC - Analgesic", interactions: [], contraindications: [] },
  { name: "Acetaminophen + caffeine (Extra Strength)", generic: "Acetaminophen, Caffeine", strength: "500mg + 65mg caffeine", form: "Tablet", category: "OTC - Analgesic", interactions: [], contraindications: [] },

  { name: "Loratadine (Claritin, Reactine)", generic: "Loratadine", strength: "10mg", form: "Tablet, Liquid", category: "OTC - Antihistamine", interactions: [], contraindications: [] },
  { name: "Cetirizine (Reactine, Zyrtec)", generic: "Cetirizine", strength: "5mg, 10mg", form: "Tablet, Liquid", category: "OTC - Antihistamine", interactions: [], contraindications: [] },
  { name: "Fexofenadine (Allegra)", generic: "Fexofenadine", strength: "60mg, 120mg, 180mg", form: "Tablet", category: "OTC - Antihistamine", interactions: [], contraindications: [] },
  { name: "Diphenhydramine (Benadryl)", generic: "Diphenhydramine", strength: "25mg, 50mg", form: "Tablet, Liquid, Capsule", category: "OTC - Antihistamine", interactions: [], contraindications: [] },
  { name: "Hydrocortisone cream", generic: "Hydrocortisone", strength: "0.5%, 1%", form: "Topical cream", category: "OTC - Dermatologic", interactions: [], contraindications: [] },

  { name: "Omeprazole (Losec)", generic: "Omeprazole", strength: "20mg", form: "Tablet, Capsule", category: "OTC - Acid reducer", interactions: [], contraindications: [] },
  { name: "Famotidine (Pepcid)", generic: "Famotidine", strength: "10mg, 20mg", form: "Tablet", category: "OTC - Acid reducer", interactions: [], contraindications: [] },
  { name: "Calcium carbonate (Tums)", generic: "Calcium carbonate", strength: "500mg, 750mg, 1000mg", form: "Chewable tablet", category: "OTC - Antacid", interactions: [], contraindications: [] },
  { name: "Bismuth subsalicylate (Pepto-Bismol)", generic: "Bismuth subsalicylate", strength: "262mg/15mL", form: "Liquid, Chewable", category: "OTC - Antidiarrheal", interactions: [], contraindications: [] },
  { name: "Simethicone (Gas-X, Ovol)", generic: "Simethicone", strength: "80mg, 125mg", form: "Softgel, Chewable, Liquid", category: "OTC - Antiflatulent", interactions: [], contraindications: [] },

  { name: "Dextromethorphan (Robitussin DM)", generic: "Dextromethorphan", strength: "5mg/5mL, 15mg/5mL", form: "Liquid", category: "OTC - Cough suppressant", interactions: [], contraindications: [] },
  { name: "Guaifenesin (Mucinex)", generic: "Guaifenesin", strength: "100mg, 200mg, 400mg, 600mg ER", form: "Tablet, Liquid", category: "OTC - Expectorant", interactions: [], contraindications: [] },
  { name: "Menthol + eucalyptus cough drops", generic: "Menthol", strength: "Various", form: "Lozenge", category: "OTC - Throat lozenge", interactions: [], contraindications: [] },
  { name: "Saline nasal spray", generic: "Sodium chloride", strength: "0.9%", form: "Nasal spray", category: "OTC - Nasal care", interactions: [], contraindications: [] },
  { name: "Oxymetazoline nasal spray (Dristan, Otrivin)", generic: "Oxymetazoline", strength: "0.05%", form: "Nasal spray", category: "OTC - Nasal decongestant", interactions: [], contraindications: [] },

  { name: "Polyethylene glycol (RestoraLAX)", generic: "Polyethylene glycol 3350", strength: "17g/sachet", form: "Powder", category: "OTC - Laxative", interactions: [], contraindications: [] },
  { name: "Senna (Senokot)", generic: "Sennosides", strength: "8.6mg, 17.2mg", form: "Tablet", category: "OTC - Laxative", interactions: [], contraindications: [] },
  { name: "Bisacodyl (Dulcolax)", generic: "Bisacodyl", strength: "5mg", form: "Tablet, Suppository", category: "OTC - Laxative", interactions: [], contraindications: [] },
  { name: "Loperamide (Imodium)", generic: "Loperamide", strength: "2mg", form: "Capsule, Liquid", category: "OTC - Antidiarrheal", interactions: [], contraindications: [] },

  { name: "Dimenhydrinate (Gravol)", generic: "Dimenhydrinate", strength: "50mg", form: "Tablet, Suppository, Liquid", category: "OTC - Antinauseant", interactions: [], contraindications: [] },
  { name: "Meclizine (Bonamine)", generic: "Meclizine", strength: "12.5mg, 25mg", form: "Tablet", category: "OTC - Antinauseant", interactions: [], contraindications: [] },
  { name: "Melatonin", generic: "Melatonin", strength: "1mg, 3mg, 5mg, 10mg", form: "Tablet, Liquid", category: "OTC - Sleep aid", interactions: [], contraindications: [] },

  { name: "Clotrimazole (Canesten)", generic: "Clotrimazole", strength: "1%, 2%", form: "Topical cream", category: "OTC - Antifungal", interactions: [], contraindications: [] },
  { name: "Miconazole (Monistat)", generic: "Miconazole", strength: "2%", form: "Topical cream, Suppository", category: "OTC - Antifungal", interactions: [], contraindications: [] },
  { name: "Benzoyl peroxide", generic: "Benzoyl peroxide", strength: "2.5%, 5%, 10%", form: "Gel, Cream, Wash", category: "OTC - Acne", interactions: [], contraindications: [] },
  { name: "Polysporin ointment", generic: "Polymyxin B, Bacitracin", strength: "Topical", form: "Ointment", category: "OTC - Topical antibiotic", interactions: [], contraindications: [] },

  { name: "Artificial tears", generic: "Carboxymethylcellulose", strength: "0.5%, 1%", form: "Eye drops", category: "OTC - Eye care", interactions: [], contraindications: [] },
  { name: "Vitamin D3 (cholecalciferol)", generic: "Cholecalciferol", strength: "400 IU, 1000 IU, 2000 IU", form: "Tablet, Softgel, Drops", category: "OTC - Vitamin", interactions: [], contraindications: [] },
  { name: "Multivitamin", generic: "Multivitamin", strength: "Adult daily", form: "Tablet, Gummy", category: "OTC - Vitamin", interactions: [], contraindications: [] },
  { name: "Calcium + vitamin D (Caltrate)", generic: "Calcium carbonate, Vitamin D", strength: "600mg + 800 IU", form: "Tablet", category: "OTC - Mineral supplement", interactions: [], contraindications: [] },
  { name: "Iron supplement (ferrous gluconate)", generic: "Ferrous gluconate", strength: "300mg", form: "Tablet", category: "OTC - Mineral supplement", interactions: [], contraindications: [] },
  { name: "Omega-3 fish oil", generic: "Omega-3 fatty acids", strength: "300mg, 1000mg", form: "Softgel", category: "OTC - Supplement", interactions: [], contraindications: [] },

  { name: "Nicotine patch (Nicoderm)", generic: "Nicotine", strength: "7mg, 14mg, 21mg/24h", form: "Transdermal patch", category: "OTC - Smoking cessation", interactions: [], contraindications: [] },
  { name: "Nicotine gum (Nicorette)", generic: "Nicotine", strength: "2mg, 4mg", form: "Chewing gum", category: "OTC - Smoking cessation", interactions: [], contraindications: [] },
  { name: "Oral rehydration salts", generic: "Electrolytes, Glucose", strength: "Standard sachet", form: "Powder", category: "OTC - Rehydration", interactions: [], contraindications: [] },
  { name: "Hydrogen peroxide 3%", generic: "Hydrogen peroxide", strength: "3%", form: "Topical solution", category: "OTC - First aid", interactions: [], contraindications: [] },
  { name: "Isopropyl alcohol 70%", generic: "Isopropyl alcohol", strength: "70%", form: "Topical solution", category: "OTC - First aid", interactions: [], contraindications: [] },

  // { name: "Paracetamol", ... } — UK name; use Acetaminophen (Tylenol) above. Full list in DPD formulary.
  { name: "Glucosamine", generic: "Glucosamine sulfate", strength: "500mg, 1500mg", form: "Tablet, Capsule", category: "OTC - Supplement", interactions: [], contraindications: [] },
  { name: "Probiotic", generic: "Lactobacillus, Bifidobacterium", strength: "Various CFU", form: "Capsule", category: "OTC - Supplement", interactions: [], contraindications: [] },
  { name: "Echinacea", generic: "Echinacea", strength: "Various", form: "Capsule, Liquid", category: "OTC - Herbal supplement", interactions: [], contraindications: [] },
  { name: "St. John's wort", generic: "Hypericum perforatum", strength: "300mg", form: "Capsule, Tablet", category: "OTC - Herbal supplement", interactions: [], contraindications: [] },
  { name: "Cannabidiol (CBD) topical", generic: "Cannabidiol", strength: "Various", form: "Topical cream, Oil", category: "OTC - Topical", interactions: [], contraindications: [] }
];

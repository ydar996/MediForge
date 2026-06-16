// Purpose: Pricing catalog management for MediForge billing system
// Manages service prices, packages, and discounts

// ==================== STORAGE ====================

function getPricingKey() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  return `${org}_billing_pricing_catalog`;
}

/** Legacy internal lab codes superseded by CPT-style LAB - ##### entries in catalog. */
function isDeprecatedLegacyLabCode(code) {
  const c = String(code || '').replace(/\s+/g, '').toUpperCase();
  return /^LAB-00[1-4]$/.test(c);
}

// ==================== PRICING CATALOG ====================

// Get pricing catalog
window.getPricingCatalog = function() {
  const key = getPricingKey();
  const catalog = localStorage.getItem(key);
  
  if (!catalog) {
    // Create default catalog and ensure all lab services (including new ones) are present
    const defaultCatalog = createDefaultPricingCatalog();
    ensureLabServicesExist(defaultCatalog);
    enrichLabCatalogMetadata(defaultCatalog);
    savePricingCatalog(defaultCatalog);
    return defaultCatalog;
  }
  
  let parsedCatalog = JSON.parse(catalog);
  const filteredLegacy = parsedCatalog.filter(s => !isDeprecatedLegacyLabCode(s.code));
  if (filteredLegacy.length !== parsedCatalog.length) {
    parsedCatalog = filteredLegacy;
    savePricingCatalog(parsedCatalog);
  }
  
  // Archive deprecated services (replaced by single canonical test)
  parsedCatalog.forEach(s => {
    if (s.name === 'Fasting Blood Glucose (FBG)') {
      s.active = false;
      s.archived = true;
    }
    if (s.name === 'Urinalysis (Urine Routine Examination)') {
      s.active = false;
      s.archived = true;
    }
    // HBsAg is now orderable as standalone test - do not archive
  });
  
  // Auto-add missing lab services to existing catalogs
  ensureLabServicesExist(parsedCatalog);
  enrichLabCatalogMetadata(parsedCatalog);

  return parsedCatalog;
};

/** Attach CPT + OHIP fee codes to laboratory catalog rows (internal key stays LAB - #####). */
function enrichLabCatalogMetadata(catalog) {
  if (!Array.isArray(catalog)) return catalog;
  for (let i = 0; i < catalog.length; i++) {
    const svc = catalog[i];
    const isLab =
      String(svc.category || '').toLowerCase() === 'laboratory' ||
      /^LAB\s*-/i.test(String(svc.code || ''));
    if (!isLab) continue;
    if (typeof window !== 'undefined' && window.MediForgeLabCodes) {
      catalog[i] = window.MediForgeLabCodes.enrichCatalogService(svc);
    } else {
      const cpt = extractCptFromLabCatalogCode(svc.code);
      catalog[i] = { ...svc, cpt: svc.cpt || cpt };
    }
  }
  return catalog;
}

function extractCptFromLabCatalogCode(code) {
  const raw = String(code || '').trim();
  const match = raw.match(/^LAB\s*-\s*(.+)$/i);
  if (!match) return null;
  return match[1].trim();
}

// Ensure all 33 lab services exist in the catalog
function ensureLabServicesExist(catalog) {
  // MEDIFORGE_CATALOG:PRICING_LABS_START — auto-synced
  const labServices = [
    { code: 'LAB - 85730', name: 'Activated Partial Thromboplastin Time (APTT)' },
    { code: 'LAB - 86850', name: 'Antibody Screen (Indirect Coombs)' },
    { code: 'LAB - 85007/85008', name: 'Blood Film (Peripheral Blood Smear)' },
    { code: 'LAB - 86900', name: 'Blood Group (ABO and Rh Factor)' },
    { code: 'LAB - 85610/85730', name: 'Clotting Profile (Coagulation Panel)' },
    { code: 'LAB - 85025', name: 'Complete Blood Count (CBC)' },
    { code: 'LAB - 85379', name: 'D-Dimer' },
    { code: 'LAB - 85652', name: 'Erythrocyte Sedimentation Rate (ESR)' },
    { code: 'LAB - 85385', name: 'Fibrinogen' },
    { code: 'LAB - 88184', name: 'Flow Cytometry Immunophenotyping' },
    { code: 'LAB - 82955', name: 'G6PD Qualitative' },
    { code: 'LAB - 85018', name: 'Hemoglobin Concentration (HB)' },
    { code: 'LAB - 83020', name: 'Hemoglobin Electrophoresis' },
    { code: 'LAB - 83020', name: 'Hemoglobin Genotype' },
    { code: 'LAB - 87207', name: 'Malaria Parasite (Blood Film for MP)' },
    { code: 'LAB - 85014', name: 'Packed Cell Volume (PCV / Hematocrit)' },
    { code: 'LAB - 85610', name: 'Prothrombin Time with INR (PT/INR)' },
    { code: 'LAB - 85045', name: 'Reticulocyte Count' },
    { code: 'LAB - 86901', name: 'Type and Screen' },
    { code: 'LAB - 87116', name: 'AFB Culture and Smear' },
    { code: 'LAB - 86060', name: 'Antistreptolysin O (ASO); titer' },
    { code: 'LAB - 87040', name: 'Blood Culture' },
    { code: 'LAB - 87040', name: 'Blood Culture (Aerobic/Anaerobic)' },
    { code: 'LAB - 87106', name: 'Fungal Culture' },
    { code: 'LAB - 87880', name: 'Group A Streptococcus, Rapid Antigen' },
    { code: 'LAB - 87338', name: 'Helicobacter pylori Stool Antigen' },
    { code: 'LAB - 87338', name: 'Helicobacter pylori Test' },
    { code: 'LAB - 78267', name: 'Helicobacter pylori, Urea Breath Test' },
    { code: 'LAB - 86708', name: 'Hepatitis A IgM Antibody' },
    { code: 'LAB - 86704', name: 'Hepatitis B Core Antibody (Anti-HBc)' },
    { code: 'LAB - 87340/86706/87350/86707/86704', name: 'Hepatitis B Profile' },
    { code: 'LAB - 86706', name: 'Hepatitis B Surface Antibody (Anti-HBs)' },
    { code: 'LAB - 87340', name: 'Hepatitis B Surface Antigen (HBsAg)' },
    { code: 'LAB - 86803', name: 'Hepatitis C Virus Antibody (Anti-HCV)' },
    { code: 'LAB - 87070/87481/87661/81513', name: 'High Vaginal Swab (HVS)' },
    { code: 'LAB - 87389', name: 'HIV Ag/Ab Combination Assay' },
    { code: 'LAB - 86703', name: 'HIV Screening (HIV 1 & 2 Antibodies)' },
    { code: 'LAB - 86618', name: 'Lyme Disease Antibody' },
    { code: 'LAB - 86328', name: 'Mononucleosis Screen (Monospot)' },
    { code: 'LAB - 87177', name: 'Ova and Parasites, Stool' },
    { code: 'LAB - 84703', name: 'Pregnancy Test (hCG)' },
    { code: 'LAB - 86480', name: 'Quantiferon-TB Gold (IGRA)' },
    { code: 'LAB - 86592', name: 'RPR (Syphilis Screen)' },
    { code: 'LAB - 87070/87205', name: 'Sputum MCS (Microscopy, Culture, and Sensitivity)' },
    { code: 'LAB - 87045/87046/87427', name: 'Stool MCS (Stool Culture and Sensitivity)' },
    { code: 'LAB - 87070', name: 'Throat Culture' },
    { code: 'LAB - 87555', name: 'Tuberculosis Screening (TB)' },
    { code: 'LAB - 87086', name: 'Urine Culture' },
    { code: 'LAB - 87086', name: 'Urine MCS (Urine Culture and Sensitivity)' },
    { code: 'LAB - 86592', name: 'VDRL (Syphilis Screening)' },
    { code: 'LAB - 86780', name: 'Widal Test (Typhoid Fever Serology)' },
    { code: 'LAB - 87075', name: 'Wound Culture' },
    { code: 'LAB - 81211', name: 'BRCA1/BRCA2 Sequencing' },
    { code: 'LAB - 81420', name: 'Cell-Free DNA NIPT (Prenatal Screen)' },
    { code: 'LAB - 81220', name: 'CFTR Carrier Screen' },
    { code: 'LAB - 87491', name: 'Chlamydia trachomatis, NAAT' },
    { code: 'LAB - 87324', name: 'Clostridioides difficile Toxin' },
    { code: 'LAB - 87497', name: 'CMV DNA, Quantitative (PCR)' },
    { code: 'LAB - 81241', name: 'Factor V Leiden Mutation' },
    { code: 'LAB - 81243', name: 'Fragile X Syndrome Analysis' },
    { code: 'LAB - 87516', name: 'Hepatitis B DNA, Quantitative (PCR)' },
    { code: 'LAB - 87522', name: 'Hepatitis C RNA, Quantitative (PCR)' },
    { code: 'LAB - 87529', name: 'Herpes Simplex Virus PCR' },
    { code: 'LAB - 81349', name: 'HLA-B*5701' },
    { code: 'LAB - 87624', name: 'HPV DNA, High-Risk' },
    { code: 'LAB - 87428', name: 'Influenza A/B PCR' },
    { code: 'LAB - 87591', name: 'Neisseria gonorrhoeae, NAAT' },
    { code: 'LAB - 81225', name: 'Pharmacogenomics Panel (CYP2C19)' },
    { code: 'LAB - 81240', name: 'Prothrombin G20210A Mutation' },
    { code: 'LAB - 87633', name: 'Respiratory Pathogen Panel (PCR)' },
    { code: 'LAB - 87636', name: 'RSV PCR' },
    { code: 'LAB - 87635', name: 'SARS-CoV-2 PCR' },
    { code: 'LAB - 87491/87591/87661', name: 'STI Panel (Chlamydia/Gonorrhea/Trichomonas)' },
    { code: 'LAB - 86200', name: 'Anti-CCP Antibody' },
    { code: 'LAB - 86225', name: 'Anti-dsDNA Antibody' },
    { code: 'LAB - 86038', name: 'Antinuclear Antibody (ANA)' },
    { code: 'LAB - 86376', name: 'Celiac Disease Panel (tTG IgA)' },
    { code: 'LAB - 86160', name: 'Complement C3' },
    { code: 'LAB - 86161', name: 'Complement C4' },
    { code: 'LAB - 83881', name: 'HLA-B27 Antigen' },
    { code: 'LAB - 86431', name: 'Rheumatoid Factor (RF)' },
    { code: 'LAB - 86003', name: 'Specific IgE, Allergen Panel' },
    { code: 'LAB - 86800', name: 'Thyroglobulin Antibody' },
    { code: 'LAB - 83498', name: '17-Hydroxyprogesterone' },
    { code: 'LAB - 82166', name: 'Anti-Müllerian Hormone (AMH)' },
    { code: 'LAB - 84681', name: 'C-Peptide' },
    { code: 'LAB - 82533', name: 'Cortisol, AM Serum' },
    { code: 'LAB - 82627', name: 'DHEA-Sulfate' },
    { code: 'LAB - 84439', name: 'Free Thyroxine (Free T4)' },
    { code: 'LAB - 83527', name: 'Insulin, Fasting' },
    { code: 'LAB - 83970', name: 'Parathyroid Hormone (PTH), Intact' },
    { code: 'LAB - 84482', name: 'Reverse T3' },
    { code: 'LAB - 84270', name: 'Sex Hormone Binding Globulin (SHBG)' },
    { code: 'LAB - 84402', name: 'Testosterone, Free and Total' },
    { code: 'LAB - 84443/84439', name: 'Thyroid Panel (TSH + Free T4)' },
    { code: 'LAB - 84480', name: 'Triiodothyronine (T3), Total' },
    { code: 'LAB - 82105', name: 'AFP (Alpha-Fetoprotein)' },
    { code: 'LAB - 86304', name: 'CA-125' },
    { code: 'LAB - 82378', name: 'CEA (Carcinoembryonic Antigen)' },
    { code: 'LAB - 82950', name: '2-Hour Postprandial Glucose' },
    { code: 'LAB - 82040', name: 'Albumin' },
    { code: 'LAB - 82140', name: 'Ammonia' },
    { code: 'LAB - 82150', name: 'Amylase' },
    { code: 'LAB - 80048', name: 'Basic Metabolic Panel (BMP)' },
    { code: 'LAB - 82248', name: 'Bilirubin, Direct' },
    { code: 'LAB - 84525', name: 'Blood Urea Nitrogen (BUN)' },
    { code: 'LAB - 83880', name: 'BNP (B-Type Natriuretic Peptide)' },
    { code: 'LAB - 86140', name: 'C-Reactive Protein (CRP)' },
    { code: 'LAB - 82310', name: 'Calcium Lab Test' },
    { code: 'LAB - 82553', name: 'CK-MB' },
    { code: 'LAB - 80053', name: 'Comprehensive Metabolic Panel (CMP)' },
    { code: 'LAB - 82525', name: 'Copper, Serum' },
    { code: 'LAB - 82550', name: 'Creatine Kinase (CK)' },
    { code: 'LAB - 82565', name: 'Creatinine (Serum)' },
    { code: 'LAB - 83721', name: 'Direct LDL Cholesterol' },
    { code: 'LAB - 80051', name: 'Electrolytes Panel' },
    { code: 'LAB - 80051', name: 'Electrolytes, Urea, and Creatinine (EUC) Test' },
    { code: 'LAB - 82670', name: 'Estrogen (E2)' },
    { code: 'LAB - 82947', name: 'Fasting Blood Sugar (FBS)' },
    { code: 'LAB - 83993', name: 'Fecal Calprotectin' },
    { code: 'LAB - 82728', name: 'Ferritin' },
    { code: 'LAB - 82746', name: 'Folate (Folic Acid)' },
    { code: 'LAB - 83001', name: 'Follicle Stimulating Hormone (FSH)' },
    { code: 'LAB - 82977', name: 'Gamma Glutamyl Transferase (GGT)' },
    { code: 'LAB - 83036', name: 'Glycated Hemoglobin (HbA1c)' },
    { code: 'LAB - 86141', name: 'High-Sensitivity C-Reactive Protein (hs-CRP)' },
    { code: 'LAB - 83090', name: 'Homocysteine' },
    { code: 'LAB - 84146/84403/83001/83002/82670/84144', name: 'Hormonal Profile (Panel)' },
    { code: 'LAB - 84166', name: 'Immunofixation Electrophoresis' },
    { code: 'LAB - 82330', name: 'Ionized Calcium' },
    { code: 'LAB - 83540/83550/82728', name: 'Iron Studies Panel' },
    { code: 'LAB - 83540', name: 'Iron, Serum' },
    { code: 'LAB - 83615', name: 'Lactate Dehydrogenase (LDH)' },
    { code: 'LAB - 83605', name: 'Lactate, Blood' },
    { code: 'LAB - 83690', name: 'Lipase' },
    { code: 'LAB - 80061', name: 'Lipid Panel' },
    { code: 'LAB - 80076', name: 'Liver Function Test (LFT)' },
    { code: 'LAB - 83002', name: 'Luteinizing Hormone (LH)' },
    { code: 'LAB - 83735', name: 'Magnesium' },
    { code: 'LAB - 83921', name: 'Methylmalonic Acid (MMA)' },
    { code: 'LAB - 82043', name: 'Microalbumin, Urine' },
    { code: 'LAB - 83874', name: 'Myoglobin' },
    { code: 'LAB - 82951', name: 'Oral Glucose Tolerance Test (OGTT, 2-hour)' },
    { code: 'LAB - 83930', name: 'Osmolality, Serum' },
    { code: 'LAB - 84100', name: 'Phosphorus' },
    { code: 'LAB - 84145', name: 'Procalcitonin' },
    { code: 'LAB - 84144', name: 'Progesterone' },
    { code: 'LAB - 84146', name: 'Prolactin' },
    { code: 'LAB - 84153', name: 'Prostate-Specific Antigen (PSA)' },
    { code: 'LAB - 84165', name: 'Protein Electrophoresis, Serum' },
    { code: 'LAB - 84154', name: 'PSA, Free' },
    { code: 'LAB - 82947', name: 'Random Blood Sugar (RBS)' },
    { code: 'LAB - 84403', name: 'Testosterone (Total)' },
    { code: 'LAB - 84443', name: 'Thyroid Stimulating Hormone (TSH)' },
    { code: 'LAB - 83550', name: 'Total Iron Binding Capacity (TIBC)' },
    { code: 'LAB - 84155', name: 'Total Protein' },
    { code: 'LAB - 84484', name: 'Troponin I, High Sensitivity' },
    { code: 'LAB - 84520', name: 'Uric Acid Test' },
    { code: 'LAB - 81001', name: 'Urinalysis (UA)' },
    { code: 'LAB - 82043/82565', name: 'Urine Albumin/Creatinine Ratio' },
    { code: 'LAB - 84156', name: 'Urine Protein, 24-Hour' },
    { code: 'LAB - 82607', name: 'Vitamin B12' },
    { code: 'LAB - 82306', name: 'Vitamin D Level (25(OH)D)' },
    { code: 'LAB - 84630', name: 'Zinc, Serum' },
    { code: 'LAB - 82270', name: 'Fecal Immunochemical Test (FIT)' },
    { code: 'LAB - 88173', name: 'Fine Needle Aspiration Cytology' },
    { code: 'LAB - 88230', name: 'Karyotype, Peripheral Blood' },
    { code: 'LAB - 88142', name: 'Pap Smear (Cervical Cytology)' },
    { code: 'LAB - 89320', name: 'Semen Analysis' },
    { code: 'LAB - 88112', name: 'Urine Cytology' },
    { code: 'LAB - 80162', name: 'Digoxin Level' },
    { code: 'LAB - 80320', name: 'Ethanol Level, Blood' },
    { code: 'LAB - 83655', name: 'Lead Level, Blood' },
    { code: 'LAB - 80178', name: 'Lithium Level' },
    { code: 'LAB - 80164', name: 'Valproic Acid Level' },
    { code: 'LAB - 80202', name: 'Vancomycin Trough Level' }
  ];
  // MEDIFORGE_CATALOG:PRICING_LABS_END
  
  const existingCodes = new Set(catalog.map(s => s.code.toUpperCase().trim()));
  const existingNames = new Set(catalog.map(s => s.name.toUpperCase().trim()));
  
  // Get default currency or use USD
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const org = user.org || "Default";
  const defaultCurrency = localStorage.getItem(`${org}_billing_default_currency`) || 'CAD';
  const defaultPrice = 50.00;
  
  let addedCount = 0;
  
  labServices.forEach(service => {
    const normalizedCode = service.code.toUpperCase().trim();
    const normalizedName = service.name.toUpperCase().trim();
    
    // Check if service already exists (by code OR by name to avoid duplicates)
    if (!existingCodes.has(normalizedCode) && !existingNames.has(normalizedName)) {
      // Add the service (use service.price if provided, else defaultPrice)
      const newService = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        code: service.code,
        name: service.name,
        category: 'Laboratory',
        description: '',
        price: (service.price !== undefined && service.price !== null) ? service.price : defaultPrice,
        currency: defaultCurrency,
        taxable: true,
        active: true,
        createdAt: new Date().toISOString()
      };
      
      catalog.push(newService);
      existingCodes.add(normalizedCode);
      existingNames.add(normalizedName);
      addedCount++;
    }
  });
  
  // Save updated catalog if any services were added
  if (addedCount > 0) {
    savePricingCatalog(catalog);
    console.log(`✅ Auto-added ${addedCount} lab service(s) to existing catalog`);
  }
}

// Save pricing catalog
window.savePricingCatalog = function(catalog) {
  const key = getPricingKey();
  localStorage.setItem(key, JSON.stringify(catalog));
  console.log('Pricing catalog saved');
};

// Create default pricing catalog
function createDefaultPricingCatalog() {
  return [
    // Consultations
    {
      id: '1',
      code: 'CONS-001',
      name: 'General Consultation',
      category: 'Consultation',
      description: 'Standard medical consultation',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '2',
      code: 'CONS-002',
      name: 'Specialist Consultation',
      category: 'Consultation',
      description: 'Consultation with specialist',
      price: 100.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '3',
      code: 'CONS-003',
      name: 'Follow-up Visit',
      category: 'Consultation',
      description: 'Follow-up consultation',
      price: 30.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    
    // Procedures
    {
      id: '4',
      code: 'PROC-001',
      name: 'Wound Dressing',
      category: 'Procedure',
      description: 'Simple wound dressing',
      price: 25.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '5',
      code: 'PROC-002',
      name: 'Suturing',
      category: 'Procedure',
      description: 'Suturing of wound',
      price: 75.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '6',
      code: 'PROC-003',
      name: 'Minor Surgery',
      category: 'Procedure',
      description: 'Minor surgical procedure',
      price: 200.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    
    // Laboratory Services - All at $50 each
    {
      id: '7',
      code: 'LAB - 80048',
      name: 'Basic Metabolic Panel (BMP)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '8',
      code: 'LAB - 86060',
      name: 'Antistreptolysin O (ASO); titer',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '9',
      code: 'LAB - 86900',
      name: 'Blood Group (ABO and Rh Factor)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '10',
      code: 'LAB - 86140',
      name: 'C-Reactive Protein (CRP)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '11',
      code: 'LAB - 82310',
      name: 'Calcium Lab Test',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '12',
      code: 'LAB - 85025',
      name: 'Complete Blood Count (CBC)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '13',
      code: 'LAB - 80053',
      name: 'Comprehensive Metabolic Panel (CMP)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '14',
      code: 'LAB - 80051',
      name: 'Electrolytes, Urea, and Creatinine (EUC) Test',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '15',
      code: 'LAB - 85651',
      name: 'Erythrocyte Sedimentation Rate (ESR)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '16',
      code: 'LAB - 82947',
      name: 'Fasting Blood Sugar (FBS)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '17',
      code: 'LAB - 87338',
      name: 'Helicobacter pylori Test',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '18',
      code: 'LAB - 83036',
      name: 'Glycated Hemoglobin (HbA1c)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '19',
      code: 'LAB - 85018',
      name: 'Hemoglobin Concentration (HB)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '20',
      code: 'LAB - 83020',
      name: 'Hemoglobin Genotype',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '21',
      code: 'LAB - 87340/86706/87350/86707/86704',
      name: 'Hepatitis B Profile',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '22',
      code: 'LAB - 86803',
      name: 'Hepatitis C Virus Antibody (Anti-HCV)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '23',
      code: 'LAB - 86703',
      name: 'HIV Screening (HIV 1 & 2 Antibodies)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '24',
      code: 'LAB - 80061',
      name: 'Lipid Panel',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '25',
      code: 'LAB - 80076',
      name: 'Liver Function Test (LFT)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '26',
      code: 'LAB - 87207',
      name: 'Malaria Parasite (Blood Film for MP)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '27',
      code: 'LAB - 85014',
      name: 'Packed Cell Volume (PCV / Hematocrit)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '28',
      code: 'LAB - 84703',
      name: 'Pregnancy Test (hCG)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30',
      code: 'LAB - 84153',
      name: 'Prostate-Specific Antigen (PSA)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30a',
      code: 'LAB - 84146/84403/83001/83002/82670/84144',
      name: 'Hormonal Profile (Panel)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30b',
      code: 'LAB - 84146',
      name: 'Prolactin',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30c',
      code: 'LAB - 84403',
      name: 'Testosterone (Total)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30d',
      code: 'LAB - 83001',
      name: 'Follicle Stimulating Hormone (FSH)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30e',
      code: 'LAB - 83002',
      name: 'Luteinizing Hormone (LH)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30e2',
      code: 'LAB - 82670',
      name: 'Estrogen (E2)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '30f',
      code: 'LAB - 84144',
      name: 'Progesterone',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '31',
      code: 'LAB - 85610',
      name: 'Prothrombin Time with INR (PT/INR)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '31a',
      code: 'LAB - 82947',
      name: 'Random Blood Sugar (RBS)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '32',
      code: 'LAB - 82950',
      name: '2-Hour Postprandial Glucose',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '33',
      code: 'LAB - 84443',
      name: 'Thyroid Stimulating Hormone (TSH)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '34',
      code: 'LAB - 87555',
      name: 'Tuberculosis Screening (TB)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '35',
      code: 'LAB - 84520',
      name: 'Uric Acid Test',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '36',
      code: 'LAB - 81001',
      name: 'Urinalysis (UA)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '38',
      code: 'LAB - 87086',
      name: 'Urine MCS (Urine Culture and Sensitivity)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '38a',
      code: 'LAB - 87045/87046/87427',
      name: 'Stool MCS (Stool Culture and Sensitivity)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '38b',
      code: 'LAB - 87070/87481/87661/81513',
      name: 'High Vaginal Swab (HVS)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '39',
      code: 'LAB - 86592',
      name: 'VDRL (Syphilis Screening)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '40',
      code: 'LAB - 82306',
      name: 'Vitamin D Level (25(OH)D)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '41',
      code: 'LAB - 86780',
      name: 'Widal Test (Typhoid Fever Serology)',
      category: 'Laboratory',
      description: '',
      price: 50.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    
    // Imaging
    {
      id: '42',
      code: 'IMG-001',
      name: 'X-Ray (Single View)',
      category: 'Imaging',
      description: 'Single view X-ray',
      price: 60.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '43',
      code: 'IMG-002',
      name: 'Ultrasound',
      category: 'Imaging',
      description: 'Ultrasound scan',
      price: 80.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    
    // Vaccinations
    {
      id: '42',
      code: 'VAC-001',
      name: 'COVID-19 Vaccine',
      category: 'Vaccination',
      description: 'COVID-19 vaccination',
      price: 25.00,
      currency: 'CAD',
      taxable: false,
      active: true
    },
    {
      id: '43',
      code: 'VAC-002',
      name: 'Flu Vaccine',
      category: 'Vaccination',
      description: 'Seasonal influenza vaccine',
      price: 20.00,
      currency: 'CAD',
      taxable: false,
      active: true
    },
    
    // Other Services
    {
      id: '44',
      code: 'SRV-001',
      name: 'Medical Certificate',
      category: 'Documentation',
      description: 'Medical certificate issuance',
      price: 15.00,
      currency: 'CAD',
      taxable: true,
      active: true
    },
    {
      id: '45',
      code: 'SRV-002',
      name: 'Prescription Refill',
      category: 'Prescription',
      description: 'Prescription refill service',
      price: 10.00,
      currency: 'CAD',
      taxable: true,
      active: true
    }
  ];
}

// Add service to catalog
window.addServiceToCatalog = function(service) {
  const catalog = getPricingCatalog();
  
  const newService = {
    id: Date.now().toString(),
    code: service.code || `SRV-${Date.now()}`,
    name: service.name,
    category: service.category || 'Other',
    description: service.description || '',
    price: parseFloat(service.price) || 0,
    currency: service.currency || 'USD',
    taxable: service.taxable !== false,
    active: service.active !== false,
    createdAt: new Date().toISOString()
  };
  
  catalog.push(newService);
  savePricingCatalog(catalog);
  
  console.log('Service added to catalog:', newService.name);
  return newService;
};

// Update service in catalog
window.updateServiceInCatalog = function(serviceId, updates) {
  const catalog = getPricingCatalog();
  const index = catalog.findIndex(s => s.id === serviceId);
  
  if (index === -1) {
    console.error('Service not found in catalog:', serviceId);
    return null;
  }
  
  Object.assign(catalog[index], updates);
  catalog[index].lastModified = new Date().toISOString();
  
  savePricingCatalog(catalog);
  
  console.log('Service updated in catalog:', catalog[index].name);
  return catalog[index];
};

// Delete service from catalog
window.deleteServiceFromCatalog = function(serviceId) {
  const catalog = getPricingCatalog();
  const index = catalog.findIndex(s => s.id === serviceId);
  
  if (index === -1) {
    console.error('Service not found in catalog:', serviceId);
    return false;
  }
  
  const service = catalog[index];
  catalog.splice(index, 1);
  savePricingCatalog(catalog);
  
  console.log('Service deleted from catalog:', service.name);
  return true;
};

// Get service by ID
window.getServiceById = function(serviceId) {
  const catalog = getPricingCatalog();
  return catalog.find(s => s.id === serviceId);
};

// Get service by code
window.getServiceByCode = function(code) {
  const catalog = getPricingCatalog();
  return catalog.find(s => s.code === code);
};

// Get services by category
window.getServicesByCategory = function(category) {
  const catalog = getPricingCatalog();
  return catalog.filter(s => s.category === category && s.active);
};

// Get all categories
window.getServiceCategories = function() {
  const catalog = getPricingCatalog();
  const categories = [...new Set(catalog.map(s => s.category))];
  return categories.sort();
};

// Search services
window.searchServices = function(query) {
  const catalog = getPricingCatalog();
  const lowerQuery = query.toLowerCase();
  
  return catalog.filter(s => 
    s.active && (
      s.name.toLowerCase().includes(lowerQuery) ||
      s.code.toLowerCase().includes(lowerQuery) ||
      s.description.toLowerCase().includes(lowerQuery) ||
      s.category.toLowerCase().includes(lowerQuery)
    )
  );
};

// Get active services
window.getActiveServices = function() {
  const catalog = getPricingCatalog();
  return catalog.filter(s => s.active);
};

// ==================== COMMON SERVICES QUICK ACCESS ====================

// Get frequently used services
window.getFrequentServices = function() {
  const catalog = getPricingCatalog();
  // In future, track usage and return most used services
  // For now, return consultations and common tests
  const frequentCodes = ['CONS-001', 'CONS-003', 'LAB - 85025', 'LAB - 87207', 'LAB - 81001', 'PROC-001'];
  return catalog.filter(s => frequentCodes.includes(s.code));
};

console.log('Pricing module loaded successfully');


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
  
  return parsedCatalog;
};

// Ensure all 33 lab services exist in the catalog
function ensureLabServicesExist(catalog) {
  const labServices = [
    { code: 'LAB - 80048', name: 'Basic Metabolic Panel (BMP)' },
    { code: 'LAB - 86060', name: 'Antistreptolysin O (ASO); titer' },
    { code: 'LAB - 86900', name: 'Blood Group (ABO and Rh Factor)' },
    { code: 'LAB - 86140', name: 'C-Reactive Protein (CRP)' },
    { code: 'LAB - 82310', name: 'Calcium Lab Test' },
    { code: 'LAB - 85025', name: 'Complete Blood Count (CBC)' },
    { code: 'LAB - 80053', name: 'Comprehensive Metabolic Panel (CMP)' },
    { code: 'LAB - 80051', name: 'Electrolytes, Urea, and Creatinine (EUC) Test' },
    { code: 'LAB - 85651', name: 'Erythrocyte Sedimentation Rate (ESR)' },
    { code: 'LAB - 82947', name: 'Fasting Blood Sugar (FBS)' },
    { code: 'LAB - 87338', name: 'Helicobacter pylori Test' },
    { code: 'LAB - 83036', name: 'Glycated Hemoglobin (HbA1c)' },
    { code: 'LAB - 85018', name: 'Hemoglobin Concentration (HB)' },
    { code: 'LAB - 83020', name: 'Hemoglobin Genotype' },
    { code: 'LAB - 87340', name: 'Hepatitis B Surface Antigen (HBsAg)' },
    { code: 'LAB - 87340/86706/87350/86707/86704', name: 'Hepatitis B Profile' },
    { code: 'LAB - 86803', name: 'Hepatitis C Virus Antibody (Anti-HCV)' },
    { code: 'LAB - 86703', name: 'HIV Screening (HIV 1 & 2 Antibodies)' },
    { code: 'LAB - 80061', name: 'Lipid Panel' },
    { code: 'LAB - 80076', name: 'Liver Function Test (LFT)' },
    { code: 'LAB - 87207', name: 'Malaria Parasite (Blood Film for MP)' },
    { code: 'LAB - 85014', name: 'Packed Cell Volume (PCV / Hematocrit)' },
    { code: 'LAB - 84703', name: 'Pregnancy Test (hCG)' },
    { code: 'LAB - 84153', name: 'Prostate-Specific Antigen (PSA)' },
    { code: 'LAB - 84146/84403/83001/83002/82670/84144', name: 'Hormonal Profile (Panel)' },
    { code: 'LAB - 84146', name: 'Prolactin' },
    { code: 'LAB - 84403', name: 'Testosterone (Total)' },
    { code: 'LAB - 83001', name: 'Follicle Stimulating Hormone (FSH)' },
    { code: 'LAB - 83002', name: 'Luteinizing Hormone (LH)' },
    { code: 'LAB - 82670', name: 'Estrogen (E2)' },
    { code: 'LAB - 84144', name: 'Progesterone' },
    { code: 'LAB - 85610', name: 'Prothrombin Time with INR (PT/INR)' },
    { code: 'LAB - 82947', name: 'Random Blood Sugar (RBS)' },
    { code: 'LAB - 82950', name: '2-Hour Postprandial Glucose' },
    { code: 'LAB - 84443', name: 'Thyroid Stimulating Hormone (TSH)' },
    { code: 'LAB - 87555', name: 'Tuberculosis Screening (TB)' },
    { code: 'LAB - 84520', name: 'Uric Acid Test' },
    { code: 'LAB - 81001', name: 'Urinalysis (UA)' },
    { code: 'LAB - 87086', name: 'Urine MCS (Urine Culture and Sensitivity)' },
    { code: 'LAB - 87045/87046/87427', name: 'Stool MCS (Stool Culture and Sensitivity)' },
    { code: 'LAB - 87070/87481/87661/81513', name: 'High Vaginal Swab (HVS)' },
    { code: 'LAB - 86592', name: 'VDRL (Syphilis Screening)' },
    { code: 'LAB - 82306', name: 'Vitamin D Level (25(OH)D)' },
    { code: 'LAB - 86780', name: 'Widal Test (Typhoid Fever Serology)' },
    { code: 'LAB - 85610/85730', name: 'Clotting Profile (Coagulation Panel)', price: 1000 },
    { code: 'LAB - 87070/87205', name: 'Sputum MCS (Microscopy, Culture, and Sensitivity)', price: 1000 },
    { code: 'LAB - 87040', name: 'Blood Culture', price: 1000 },
    { code: 'LAB - 85007/85008', name: 'Blood Film (Peripheral Blood Smear)', price: 1000 }
  ];
  
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


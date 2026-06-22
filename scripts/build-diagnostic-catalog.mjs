#!/usr/bin/env node
/**
 * Build Canada/US diagnostic catalog (labs + imaging) and sync into patients.js + pricing.js.
 * Platform-maintained — clinics do not edit catalog JSON by hand in production.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);

const SST = 'SST or red-top tube';
const EDTA = 'Lavender (EDTA) tube';
const REFRIG = 'Refrigerated / Stable 7 days';

/** Additional ambulatory labs (Canada/US primary care + common specialist). */
const ADDITIONAL_LABS = [
  { name: 'Free Thyroxine (Free T4)', category: 'Endocrinology', cpt: '84439', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Thyroid function; often reflexed from abnormal TSH.' },
  { name: 'Triiodothyronine (T3), Total', category: 'Endocrinology', cpt: '84480', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Thyroid hormone assessment.' },
  { name: 'Thyroid Panel (TSH + Free T4)', category: 'Endocrinology', cpt: '84443/84439', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Combined thyroid screening panel.', panelTests: ['Thyroid Stimulating Hormone (TSH)', 'Free Thyroxine (Free T4)'] },
  { name: 'Vitamin B12', category: 'Clinical Chemistry', cpt: '82607', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Cobalamin level.' },
  { name: 'Folate (Folic Acid)', category: 'Clinical Chemistry', cpt: '82746', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Serum folate.' },
  { name: 'Ferritin', category: 'Clinical Chemistry', cpt: '82728', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Iron stores; acute phase reactant.' },
  { name: 'Iron, Serum', category: 'Clinical Chemistry', cpt: '83540', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Serum iron level.' },
  { name: 'Total Iron Binding Capacity (TIBC)', category: 'Clinical Chemistry', cpt: '83550', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Iron studies panel component.' },
  { name: 'Iron Studies Panel', category: 'Clinical Chemistry', cpt: '83540/83550/82728', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Iron, TIBC, ferritin.', panelTests: ['Iron, Serum', 'Total Iron Binding Capacity (TIBC)', 'Ferritin'] },
  { name: 'Antinuclear Antibody (ANA)', category: 'Immunology / Autoimmune', cpt: '86038', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Autoimmune screening; reflex pattern if positive.' },
  { name: 'Rheumatoid Factor (RF)', category: 'Immunology / Autoimmune', cpt: '86431', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Rheumatoid arthritis screening.' },
  { name: 'Creatine Kinase (CK)', category: 'Clinical Chemistry', cpt: '82550', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Muscle injury / statin monitoring.' },
  { name: 'Lactate Dehydrogenase (LDH)', category: 'Clinical Chemistry', cpt: '83615', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Tissue injury marker.' },
  { name: 'Amylase', category: 'Clinical Chemistry', cpt: '82150', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Pancreatitis assessment.' },
  { name: 'Lipase', category: 'Clinical Chemistry', cpt: '83690', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Pancreatitis; preferred over amylase.' },
  { name: 'Gamma Glutamyl Transferase (GGT)', category: 'Clinical Chemistry', cpt: '82977', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Hepatobiliary enzyme.' },
  { name: 'Bilirubin, Direct', category: 'Clinical Chemistry', cpt: '82248', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Conjugated bilirubin.' },
  { name: 'Albumin', category: 'Clinical Chemistry', cpt: '82040', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Nutritional and liver synthetic function.' },
  { name: 'Total Protein', category: 'Clinical Chemistry', cpt: '84155', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Total serum protein.' },
  { name: 'Magnesium', category: 'Clinical Chemistry', cpt: '83735', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Electrolyte / metabolic panel add-on.' },
  { name: 'Phosphorus', category: 'Clinical Chemistry', cpt: '84100', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Mineral metabolism.' },
  { name: 'Creatinine (Serum)', category: 'Clinical Chemistry', cpt: '82565', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Renal function; eGFR calculated.' },
  { name: 'Blood Urea Nitrogen (BUN)', category: 'Clinical Chemistry', cpt: '84525', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Renal function marker.' },
  { name: 'Microalbumin, Urine', category: 'Clinical Chemistry', cpt: '82043', specimen: 'Urine / 10 mL', container: 'Sterile urine container', transport: REFRIG, notes: 'Diabetic nephropathy screening.' },
  { name: 'Urine Protein, 24-Hour', category: 'Clinical Chemistry', cpt: '84156', specimen: 'Urine / 24h collection', container: '24-hour urine container', transport: REFRIG, notes: 'Quantitative proteinuria.' },
  { name: 'Oral Glucose Tolerance Test (OGTT, 2-hour)', category: 'Clinical Chemistry', cpt: '82951', specimen: 'Plasma / 1 mL', container: 'Gray-top (fluoride) tube', transport: REFRIG, notes: '75g glucose load; diabetes diagnosis.' },
  { name: 'Helicobacter pylori, Urea Breath Test', category: 'Medical Microbiology / Serology', cpt: '78267', specimen: 'Breath sample', container: 'Breath collection kit', transport: 'Room temperature / Same day', notes: 'Non-invasive H. pylori detection.' },
  { name: 'Celiac Disease Panel (tTG IgA)', category: 'Immunology / Autoimmune', cpt: '86376', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Tissue transglutaminase antibodies.' },
  { name: 'Hepatitis A IgM Antibody', category: 'Medical Microbiology / Serology', cpt: '86708', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Acute hepatitis A.' },
  { name: 'Hepatitis B Core Antibody (Anti-HBc)', category: 'Medical Microbiology / Serology', cpt: '86704', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Past or current HBV infection.' },
  { name: 'Hepatitis B Surface Antibody (Anti-HBs)', category: 'Medical Microbiology / Serology', cpt: '86706', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Immunity after vaccination or recovery.' },
  { name: 'HIV Ag/Ab Combination Assay', category: 'Medical Microbiology / Serology', cpt: '87389', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Fourth-generation HIV screen.' },
  { name: 'RPR (Syphilis Screen)', category: 'Medical Microbiology / Serology', cpt: '86592', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Rapid plasma reagin; reflex confirmatory if positive.' },
  { name: 'Chlamydia trachomatis, NAAT', category: 'Molecular / PCR', cpt: '87491', specimen: 'Urine or swab', container: 'NAAT transport tube', transport: 'Room temperature / Per lab', notes: 'Nucleic acid amplification test.' },
  { name: 'Neisseria gonorrhoeae, NAAT', category: 'Molecular / PCR', cpt: '87591', specimen: 'Urine or swab', container: 'NAAT transport tube', transport: 'Room temperature / Per lab', notes: 'Nucleic acid amplification test.' },
  { name: 'SARS-CoV-2 PCR', category: 'Molecular / PCR', cpt: '87635', specimen: 'Nasopharyngeal swab', container: 'Viral transport medium', transport: 'Refrigerated / Same day', notes: 'COVID-19 molecular test.' },
  { name: 'Influenza A/B PCR', category: 'Molecular / PCR', cpt: '87428', specimen: 'Nasopharyngeal swab', container: 'Viral transport medium', transport: 'Refrigerated / Same day', notes: 'Respiratory virus panel component.' },
  { name: 'RSV PCR', category: 'Molecular / PCR', cpt: '87636', specimen: 'Nasopharyngeal swab', container: 'Viral transport medium', transport: 'Refrigerated / Same day', notes: 'Respiratory syncytial virus.' },
  { name: 'Group A Streptococcus, Rapid Antigen', category: 'Medical Microbiology / Serology', cpt: '87880', specimen: 'Throat swab', container: 'Swab with transport medium', transport: 'Room temperature / Same day', notes: 'Rapid strep throat test.' },
  { name: 'Mononucleosis Screen (Monospot)', category: 'Medical Microbiology / Serology', cpt: '86328', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'EBV heterophile antibodies.' },
  { name: 'Lyme Disease Antibody', category: 'Medical Microbiology / Serology', cpt: '86618', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Two-tier testing if positive.' },
  { name: 'D-Dimer', category: 'Haematology', cpt: '85379', specimen: 'Plasma / 2.7 mL', container: 'Light blue (citrate) tube', transport: 'Room temperature / 4 hours', notes: 'VTE rule-out in appropriate pretest probability.' },
  { name: 'Activated Partial Thromboplastin Time (APTT)', category: 'Haematology', cpt: '85730', specimen: 'Plasma / 2.7 mL', container: 'Light blue (citrate) tube', transport: 'Room temperature / 4 hours', notes: 'Intrinsic pathway coagulation.' },
  { name: 'Fibrinogen', category: 'Haematology', cpt: '85385', specimen: 'Plasma / 2.7 mL', container: 'Light blue (citrate) tube', transport: 'Room temperature / 4 hours', notes: 'Coagulation factor assessment.' },
  { name: 'Reticulocyte Count', category: 'Haematology', cpt: '85045', specimen: 'Whole blood / 2 mL', container: EDTA, transport: 'Room temperature / 24 hours', notes: 'Marrow response to anemia.' },
  { name: 'Lead Level, Blood', category: 'Toxicology', cpt: '83655', specimen: 'Whole blood / 2 mL', container: 'Royal blue trace element tube', transport: 'Room temperature / Per lab', notes: 'Pediatric and occupational screening.' },
  { name: 'PSA, Free', category: 'Clinical Chemistry', cpt: '84154', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Prostate cancer risk stratification with total PSA.' },
  { name: 'CA-125', category: 'Tumor Markers', cpt: '86304', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Ovarian cancer monitoring.' },
  { name: 'CEA (Carcinoembryonic Antigen)', category: 'Tumor Markers', cpt: '82378', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Colorectal and other malignancy monitoring.' },
  { name: 'AFP (Alpha-Fetoprotein)', category: 'Tumor Markers', cpt: '82105', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Liver and germ cell tumors.' },
  { name: 'Cortisol, AM Serum', category: 'Endocrinology', cpt: '82533', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Draw before 9 AM when possible.' },
  { name: 'DHEA-Sulfate', category: 'Endocrinology', cpt: '82627', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Adrenal androgen.' },
  { name: 'Anti-Müllerian Hormone (AMH)', category: 'Endocrinology', cpt: '82166', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Ovarian reserve assessment.' },
  { name: 'HLA-B27 Antigen', category: 'Immunology / Autoimmune', cpt: '83881', specimen: 'Whole blood / 5 mL', container: EDTA, transport: 'Room temperature / 48 hours', notes: 'Spondyloarthropathy association.' },
  { name: 'Throat Culture', category: 'Medical Microbiology / Serology', cpt: '87070', specimen: 'Throat swab', container: 'Swab with transport medium', transport: 'Room temperature / 2 hours', notes: 'Bacterial culture throat.' },
  { name: 'Wound Culture', category: 'Medical Microbiology / Serology', cpt: '87075', specimen: 'Wound swab / aspirate', container: 'Sterile container', transport: 'Room temperature / 2 hours', notes: 'Culture with sensitivity as indicated.' },
  { name: 'Semen Analysis', category: 'Anatomic Pathology / Cytology', cpt: '89320', specimen: 'Semen', container: 'Sterile specimen container', transport: 'Body temperature / Within 1 hour', notes: 'Fertility assessment; abstinence 2-5 days.' },
  { name: 'Pap Smear (Cervical Cytology)', category: 'Anatomic Pathology / Cytology', cpt: '88142', specimen: 'Cervical sample', container: 'Liquid-based cytology vial', transport: 'Room temperature / Per lab', notes: 'Cervical cancer screening.' },
  { name: 'HPV DNA, High-Risk', category: 'Molecular / PCR', cpt: '87624', specimen: 'Cervical sample', container: 'Liquid-based cytology vial', transport: 'Room temperature / Per lab', notes: 'Co-testing or reflex from Pap.' },
  { name: 'Fecal Immunochemical Test (FIT)', category: 'Anatomic Pathology / Cytology', cpt: '82270', specimen: 'Stool', container: 'FIT collection kit', transport: 'Room temperature / Per kit', notes: 'Colorectal cancer screening.' },
  { name: 'Clostridioides difficile Toxin', category: 'Molecular / PCR', cpt: '87324', specimen: 'Stool', container: 'Sterile stool container', transport: 'Refrigerated / Same day', notes: 'C. difficile diagnosis.' },
  { name: 'Ova and Parasites, Stool', category: 'Medical Microbiology / Serology', cpt: '87177', specimen: 'Stool', container: 'Sterile stool container with preservative', transport: 'Room temperature / Per lab', notes: 'Parasite examination.' },
  { name: 'Quantiferon-TB Gold (IGRA)', category: 'Medical Microbiology / Serology', cpt: '86480', specimen: 'Whole blood / 4 mL', container: 'Specialty QFT tubes', transport: 'Room temperature / Same day', notes: 'Latent TB infection screening.' },
  { name: 'Antibody Screen (Indirect Coombs)', category: 'Haematology', cpt: '86850', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 7 days', notes: 'Pre-transfusion antibody screen.' },
  { name: 'Type and Screen', category: 'Haematology', cpt: '86901', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 3 days', notes: 'ABO/Rh and antibody screen for surgery.' },
  { name: 'Troponin I, High Sensitivity', category: 'Clinical Chemistry', cpt: '84484', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Acute coronary syndrome rule-in/out.' },
  { name: 'BNP (B-Type Natriuretic Peptide)', category: 'Clinical Chemistry', cpt: '83880', specimen: 'Plasma / 1 mL', container: EDTA, transport: REFRIG, notes: 'Heart failure assessment.' },
  { name: 'Lactate, Blood', category: 'Clinical Chemistry', cpt: '83605', specimen: 'Plasma / 1 mL', container: 'Gray-top (fluoride) tube on ice', transport: 'On ice / Immediate', notes: 'Sepsis and tissue hypoxia.' },
  { name: 'Ammonia', category: 'Clinical Chemistry', cpt: '82140', specimen: 'Plasma / 1 mL', container: 'Green-top (heparin) on ice', transport: 'On ice / Immediate', notes: 'Hepatic encephalopathy workup.' },
  { name: 'Ethanol Level, Blood', category: 'Toxicology', cpt: '80320', specimen: 'Serum / 2 mL', container: 'Gray-top tube', transport: REFRIG, notes: 'Forensic / clinical intoxication.' },
  { name: 'Specific IgE, Allergen Panel', category: 'Immunology / Autoimmune', cpt: '86003', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Allergen-specific IgE; select panel or single allergen.' },
  { name: 'Electrolytes Panel', category: 'Clinical Chemistry', cpt: '80051', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Sodium, potassium, chloride, CO2.' },
  { name: 'Liver Function Test (LFT)', category: 'Clinical Chemistry', cpt: '80076', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'ALT, AST, ALP, bilirubin, albumin.' },
  { name: 'Calcium Lab Test', category: 'Clinical Chemistry', cpt: '82310', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Total calcium.' },
  { name: 'Helicobacter pylori Test', category: 'Medical Microbiology / Serology', cpt: '87338', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Serology or stool antigen per lab method.' },
  { name: 'Tuberculosis Screening (TB)', category: 'Medical Microbiology / Serology', cpt: '87555', specimen: 'Sputum / induced', container: 'Sterile container', transport: 'Refrigerated / Same day', notes: 'AFB smear/culture or NAAT per protocol.' }
];

/** LifeLabs / Dynacare-style ambulatory catalog expansion (commercial lab menus). */
const COMMERCIAL_LABS = [
  { name: 'Erythrocyte Sedimentation Rate (ESR)', category: 'Haematology', cpt: '85652', specimen: 'Whole blood / 2 mL', container: EDTA, transport: 'Room temperature / 24 hours', notes: 'Inflammation marker.' },
  { name: 'Direct LDL Cholesterol', category: 'Clinical Chemistry', cpt: '83721', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Calculated or direct LDL.' },
  { name: 'High-Sensitivity C-Reactive Protein (hs-CRP)', category: 'Clinical Chemistry', cpt: '86141', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Cardiovascular risk marker.' },
  { name: 'Homocysteine', category: 'Clinical Chemistry', cpt: '83090', specimen: 'Plasma / 2 mL', container: 'Green-top (heparin) on ice', transport: 'On ice / Separate immediately', notes: 'B12/folate deficiency, CV risk.' },
  { name: 'Methylmalonic Acid (MMA)', category: 'Clinical Chemistry', cpt: '83921', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Functional B12 deficiency.' },
  { name: 'Ionized Calcium', category: 'Clinical Chemistry', cpt: '82330', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Active calcium fraction.' },
  { name: 'Copper, Serum', category: 'Clinical Chemistry', cpt: '82525', specimen: 'Serum / 2 mL', container: 'Royal blue trace element tube', transport: REFRIG, notes: 'Trace mineral.' },
  { name: 'Zinc, Serum', category: 'Clinical Chemistry', cpt: '84630', specimen: 'Serum / 2 mL', container: 'Royal blue trace element tube', transport: REFRIG, notes: 'Trace mineral.' },
  { name: 'Insulin, Fasting', category: 'Endocrinology', cpt: '83527', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Insulin resistance assessment.' },
  { name: 'C-Peptide', category: 'Endocrinology', cpt: '84681', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Endogenous insulin secretion.' },
  { name: 'Parathyroid Hormone (PTH), Intact', category: 'Endocrinology', cpt: '83970', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Calcium metabolism.' },
  { name: 'Testosterone, Free and Total', category: 'Endocrinology', cpt: '84402', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Includes SHBG-derived free T.' },
  { name: 'Sex Hormone Binding Globulin (SHBG)', category: 'Endocrinology', cpt: '84270', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Androgen status.' },
  { name: '17-Hydroxyprogesterone', category: 'Endocrinology', cpt: '83498', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'CAH screening.' },
  { name: 'Reverse T3', category: 'Endocrinology', cpt: '84482', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Thyroid conversion assessment.' },
  { name: 'Thyroglobulin Antibody', category: 'Immunology / Autoimmune', cpt: '86800', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Autoimmune thyroid disease.' },
  { name: 'Anti-CCP Antibody', category: 'Immunology / Autoimmune', cpt: '86200', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Rheumatoid arthritis specificity.' },
  { name: 'Anti-dsDNA Antibody', category: 'Immunology / Autoimmune', cpt: '86225', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'SLE monitoring.' },
  { name: 'Complement C3', category: 'Immunology / Autoimmune', cpt: '86160', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Immune complex disease.' },
  { name: 'Complement C4', category: 'Immunology / Autoimmune', cpt: '86161', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Immune complex disease.' },
  { name: 'Protein Electrophoresis, Serum', category: 'Clinical Chemistry', cpt: '84165', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'M-spike / myeloma screen.' },
  { name: 'Immunofixation Electrophoresis', category: 'Clinical Chemistry', cpt: '84166', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Monoclonal protein typing.' },
  { name: 'Fecal Calprotectin', category: 'Clinical Chemistry', cpt: '83993', specimen: 'Stool', container: 'Stool collection kit', transport: REFRIG, notes: 'IBD vs IBS differentiation.' },
  { name: 'Helicobacter pylori Stool Antigen', category: 'Medical Microbiology / Serology', cpt: '87338', specimen: 'Stool', container: 'Stool container', transport: REFRIG, notes: 'Active H. pylori infection.' },
  { name: 'Blood Culture (Aerobic/Anaerobic)', category: 'Medical Microbiology / Serology', cpt: '87040', specimen: 'Whole blood / 20 mL', container: 'Blood culture bottles', transport: 'Room temperature / Immediate', notes: 'Sepsis workup.' },
  { name: 'Urine Culture', category: 'Medical Microbiology / Serology', cpt: '87086', specimen: 'Midstream urine / 10 mL', container: 'Sterile urine cup', transport: REFRIG, notes: 'UTI diagnosis.' },
  { name: 'Fungal Culture', category: 'Medical Microbiology / Serology', cpt: '87106', specimen: 'Tissue / fluid / swab', container: 'Sterile container', transport: 'Room temperature', notes: 'Deep fungal infection.' },
  { name: 'AFB Culture and Smear', category: 'Medical Microbiology / Serology', cpt: '87116', specimen: 'Sputum / induced', container: 'Sterile container', transport: REFRIG, notes: 'Tuberculosis culture.' },
  { name: 'Hepatitis C RNA, Quantitative (PCR)', category: 'Molecular / PCR', cpt: '87522', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'HCV viral load monitoring.' },
  { name: 'Hepatitis B DNA, Quantitative (PCR)', category: 'Molecular / PCR', cpt: '87516', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'HBV viral load.' },
  { name: 'CMV DNA, Quantitative (PCR)', category: 'Molecular / PCR', cpt: '87497', specimen: 'Plasma / 2 mL', container: EDTA, transport: REFRIG, notes: 'Transplant monitoring.' },
  { name: 'Respiratory Pathogen Panel (PCR)', category: 'Molecular / PCR', cpt: '87633', specimen: 'Nasopharyngeal swab', container: 'Viral transport medium', transport: REFRIG, notes: 'Multiplex respiratory panel.' },
  { name: 'STI Panel (Chlamydia/Gonorrhea/Trichomonas)', category: 'Molecular / PCR', cpt: '87491/87591/87661', specimen: 'Urine or swab', container: 'NAAT transport', transport: 'Room temperature', notes: 'Combined STI NAAT panel.' },
  { name: 'Herpes Simplex Virus PCR', category: 'Molecular / PCR', cpt: '87529', specimen: 'Lesion swab / CSF', container: 'Viral transport medium', transport: REFRIG, notes: 'HSV 1/2 detection.' },
  { name: 'Factor V Leiden Mutation', category: 'Molecular / PCR', cpt: '81241', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 7 days', notes: 'Inherited thrombophilia.' },
  { name: 'Prothrombin G20210A Mutation', category: 'Molecular / PCR', cpt: '81240', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 7 days', notes: 'Inherited thrombophilia.' },
  { name: 'BRCA1/BRCA2 Sequencing', category: 'Molecular / PCR', cpt: '81211', specimen: 'Whole blood / 5 mL', container: EDTA, transport: 'Room temperature', notes: 'Hereditary breast/ovarian cancer.' },
  { name: 'Pharmacogenomics Panel (CYP2C19)', category: 'Molecular / PCR', cpt: '81225', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature', notes: 'Clopidogrel / PPI metabolism.' },
  { name: 'HLA-B*5701', category: 'Molecular / PCR', cpt: '81349', specimen: 'Whole blood / 5 mL', container: EDTA, transport: 'Room temperature', notes: 'Abacavir hypersensitivity risk.' },
  { name: 'Cell-Free DNA NIPT (Prenatal Screen)', category: 'Molecular / PCR', cpt: '81420', specimen: 'Maternal blood / 10 mL', container: 'Cell-free DNA tube', transport: 'Room temperature', notes: 'Non-invasive prenatal testing.' },
  { name: 'Karyotype, Peripheral Blood', category: 'Anatomic Pathology / Cytology', cpt: '88230', specimen: 'Whole blood / 5 mL', container: 'Sodium heparin green-top', transport: 'Room temperature / Same day', notes: 'Chromosomal analysis.' },
  { name: 'Fragile X Syndrome Analysis', category: 'Molecular / PCR', cpt: '81243', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature', notes: 'FMR1 repeat expansion.' },
  { name: 'CFTR Carrier Screen', category: 'Molecular / PCR', cpt: '81220', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature', notes: 'Cystic fibrosis carrier testing.' },
  { name: 'Valproic Acid Level', category: 'Toxicology', cpt: '80164', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Therapeutic drug monitoring.' },
  { name: 'Lithium Level', category: 'Toxicology', cpt: '80178', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Therapeutic drug monitoring.' },
  { name: 'Vancomycin Trough Level', category: 'Toxicology', cpt: '80202', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Pre-dose level.' },
  { name: 'Digoxin Level', category: 'Toxicology', cpt: '80162', specimen: 'Serum / 2 mL', container: SST, transport: REFRIG, notes: 'Therapeutic drug monitoring.' },
  { name: 'CK-MB', category: 'Clinical Chemistry', cpt: '82553', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Myocardial injury marker.' },
  { name: 'Myoglobin', category: 'Clinical Chemistry', cpt: '83874', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Rhabdomyolysis marker.' },
  { name: 'Procalcitonin', category: 'Clinical Chemistry', cpt: '84145', specimen: 'Plasma / 1 mL', container: EDTA, transport: REFRIG, notes: 'Bacterial sepsis marker.' },
  { name: 'Osmolality, Serum', category: 'Clinical Chemistry', cpt: '83930', specimen: 'Serum / 1 mL', container: SST, transport: REFRIG, notes: 'Hyponatremia workup.' },
  { name: 'Urine Albumin/Creatinine Ratio', category: 'Clinical Chemistry', cpt: '82043/82565', specimen: 'Random urine / 10 mL', container: 'Urine cup', transport: REFRIG, notes: 'Diabetic nephropathy screen.' },
  { name: 'Hemoglobin Electrophoresis', category: 'Haematology', cpt: '83020', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 7 days', notes: 'Thalassemia / hemoglobinopathy.' },
  { name: 'G6PD Qualitative', category: 'Haematology', cpt: '82955', specimen: 'Whole blood / 3 mL', container: EDTA, transport: 'Room temperature / 7 days', notes: 'Hemolysis risk screening.' },
  { name: 'Flow Cytometry Immunophenotyping', category: 'Haematology', cpt: '88184', specimen: 'Whole blood / 5 mL', container: EDTA, transport: 'Room temperature / Same day', notes: 'Leukemia / lymphoma workup.' },
  { name: 'Urine Cytology', category: 'Anatomic Pathology / Cytology', cpt: '88112', specimen: 'Urine / 50 mL', container: 'Urine cup', transport: REFRIG, notes: 'Bladder cancer surveillance.' },
  { name: 'Fine Needle Aspiration Cytology', category: 'Anatomic Pathology / Cytology', cpt: '88173', specimen: 'FNA sample', container: 'CytoFix or saline', transport: 'Room temperature / Immediate', notes: 'Thyroid / lymph node FNA.' }
];

const ADDITIONAL_IMAGING = [
  { name: 'Chest CT (Noncontrast)', cpt: '71250', modality: 'CT', preparation: 'Remove metal from chest; fasting not required.', contrast: 'No', notes: 'Pulmonary nodule, emphysema, interstitial disease.' },
  { name: 'CT Head (Noncontrast)', cpt: '70450', modality: 'CT', preparation: 'Remove jewelry; lie still.', contrast: 'No', notes: 'Headache, trauma, stroke rule-out.' },
  { name: 'CT Head with Contrast', cpt: '70460', modality: 'CT', preparation: 'NPO 4 hours; check renal function and allergies.', contrast: 'IV iodinated', notes: 'Mass, infection, vascular lesion.' },
  { name: 'CT Abdomen/Pelvis with Contrast', cpt: '74177', modality: 'CT', preparation: 'NPO 4 hours; oral contrast per protocol.', contrast: 'IV + oral', notes: 'Abdominal pain, malignancy staging.' },
  { name: 'CT Pulmonary Angiography (CTPA)', cpt: '71275', modality: 'CT', preparation: 'IV access; assess renal function.', contrast: 'IV iodinated', notes: 'Pulmonary embolism protocol.' },
  { name: 'MRI Brain without Contrast', cpt: '70551', modality: 'MRI', preparation: 'MRI safety screening; remove metal.', contrast: 'No', notes: 'Headache, seizures, demyelinating disease.' },
  { name: 'MRI Brain with Contrast', cpt: '70552', modality: 'MRI', preparation: 'MRI safety screening; renal function if gadolinium.', contrast: 'Gadolinium IV', notes: 'Tumor, infection, vascular malformation.' },
  { name: 'MRI Lumbar Spine without Contrast', cpt: '72148', modality: 'MRI', preparation: 'MRI safety screening.', contrast: 'No', notes: 'Radiculopathy, cord compression.' },
  { name: 'MRI Cervical Spine without Contrast', cpt: '72141', modality: 'MRI', preparation: 'MRI safety screening.', contrast: 'No', notes: 'Neck pain, myelopathy.' },
  { name: 'Knee X-ray (3 views)', cpt: '73562', modality: 'X-ray', preparation: 'Remove clothing from knee.', contrast: 'No', notes: 'Trauma, arthritis assessment.' },
  { name: 'Hand X-ray (2 views)', cpt: '73120', modality: 'X-ray', preparation: 'Remove rings and jewelry.', contrast: 'No', notes: 'Trauma, arthritis.' },
  { name: 'Lumbar Spine X-ray (2-3 views)', cpt: '72100', modality: 'X-ray', preparation: 'Remove metal from lumbar area.', contrast: 'No', notes: 'Low back pain screening.' },
  { name: 'Pelvis X-ray', cpt: '72170', modality: 'X-ray', preparation: 'Remove metal from pelvis.', contrast: 'No', notes: 'Hip/pelvis trauma or arthritis.' },
  { name: 'Renal Ultrasound', cpt: '76770', modality: 'Ultrasound', preparation: 'Hydration; may need full bladder for some views.', contrast: 'No', notes: 'Renal colic, hydronephrosis, cysts.' },
  { name: 'Obstetric Ultrasound (First Trimester)', cpt: '76801', modality: 'Ultrasound', preparation: 'Full bladder early pregnancy if transabdominal.', contrast: 'No', notes: 'Dating, viability, ectopic rule-out.' },
  { name: 'Obstetric Ultrasound (Anatomy Scan)', cpt: '76805', modality: 'Ultrasound', preparation: 'Per obstetric protocol ~18-22 weeks.', contrast: 'No', notes: 'Fetal anatomy survey.' },
  { name: 'Carotid Doppler Ultrasound', cpt: '93880', modality: 'Ultrasound', preparation: 'Open collar; no neck jewelry.', contrast: 'No', notes: 'Stroke risk, bruit evaluation.' },
  { name: 'Venous Doppler Lower Extremity', cpt: '93970', modality: 'Ultrasound', preparation: 'Expose legs; compression stockings removed.', contrast: 'No', notes: 'DVT rule-out bilateral.' },
  { name: 'Echocardiogram (Transthoracic)', cpt: '93306', modality: 'Echocardiography', preparation: 'No special prep; gown provided.', contrast: 'No', notes: 'Cardiac structure and function.' },
  { name: 'Electrocardiogram (ECG/EKG)', cpt: '93000', modality: 'ECG', preparation: 'Expose chest; lie still.', contrast: 'No', notes: '12-lead resting ECG.' },
  { name: 'Exercise Stress Test', cpt: '93015', modality: 'Cardiac stress', preparation: 'Light meal 2 hours prior; comfortable shoes.', contrast: 'No', notes: 'Treadmill ECG stress.' },
  { name: 'Myocardial Perfusion Imaging (Nuclear Stress)', cpt: '78452', modality: 'Nuclear medicine', preparation: 'NPO 4 hours; caffeine restrictions per lab.', contrast: 'Radiopharmaceutical', notes: 'Ischemia evaluation.' },
  { name: 'Bone Scan (Whole Body)', cpt: '78306', modality: 'Nuclear medicine', preparation: 'Hydration; pregnancy test if applicable.', contrast: 'Radiopharmaceutical', notes: 'Metastatic survey, occult fracture.' },
  { name: 'PET/CT Whole Body', cpt: '78816', modality: 'PET/CT', preparation: 'Fasting 6 hours; glucose per protocol.', contrast: 'FDG radiotracer', notes: 'Oncology staging/restaging.' },
  { name: 'Upper GI Series (Barium Swallow)', cpt: '74246', modality: 'Fluoroscopy', preparation: 'NPO 8 hours.', contrast: 'Oral barium', notes: 'Dysphagia, reflux symptoms.' },
  { name: 'Screening Mammography (Bilateral)', cpt: '77067', modality: 'Mammography', preparation: 'No deodorant or powder.', contrast: 'No', notes: 'Breast cancer screening.' },
  { name: 'Diagnostic Mammography', cpt: '77065', modality: 'Mammography', preparation: 'No deodorant; bring priors.', contrast: 'No', notes: 'Unilateral diagnostic views.' }
];

/** Ontario-style imaging requisition expansion (categories + missing studies). */
const IMAGING_FORM_EXPANSION = [
  { name: 'Contrast Echocardiogram', category: 'Cardiology', cpt: '93318', modality: 'Echocardiography', preparation: 'IV access; assess renal function if contrast used.', contrast: 'IV contrast', notes: 'Contrast-enhanced echo; specify indication (e.g. palpitations, murmur).' },
  { name: 'Stress Echocardiogram', category: 'Cardiology', cpt: '93350', modality: 'Echocardiography', preparation: 'NPO 4 hours; comfortable shoes.', contrast: 'No', notes: 'Exercise or pharmacologic stress with echo imaging.' },
  { name: 'Holter Monitor (24 hours)', category: 'Cardiology', cpt: '93224', modality: 'Cardiac monitoring', preparation: 'Avoid showering while wearing monitor if instructed.', contrast: 'No', notes: 'Ambulatory ECG monitoring for arrhythmia.' },
  { name: 'Holter Monitor (48 hours)', category: 'Cardiology', cpt: '93225', modality: 'Cardiac monitoring', preparation: 'Avoid showering while wearing monitor if instructed.', contrast: 'No', notes: 'Extended ambulatory ECG monitoring.' },
  { name: 'Pulmonary Function Test (Spirometry)', category: 'Cardiology', cpt: '94010', modality: 'Pulmonary function', preparation: 'No bronchodilator before test unless ordered; comfortable clothing.', contrast: 'No', notes: 'Pre/post bronchodilator spirometry when indicated.' },
  { name: 'Full Pulmonary Function Test', category: 'Cardiology', cpt: '94726', modality: 'Pulmonary function', preparation: 'No heavy meal 2 hours prior; follow lab instructions.', contrast: 'No', notes: 'Complete PFT with lung volumes and diffusion as indicated.' },
  { name: 'Sleep Study (Polysomnography)', category: 'Sleep Disorders', cpt: '95810', modality: 'Sleep study', preparation: 'Avoid caffeine/alcohol per lab; bring sleepwear.', contrast: 'No', notes: 'Overnight sleep study for OSA and related disorders.' },
  { name: 'Myocardial Perfusion (Persantine)', category: 'Nuclear Cardiology', cpt: '78464', modality: 'Nuclear medicine', preparation: 'NPO 4 hours; caffeine restrictions per lab.', contrast: 'Radiopharmaceutical', notes: 'Pharmacologic stress perfusion imaging.' },
  { name: 'Rest MUGA (Ventricular Function)', category: 'Nuclear Cardiology', cpt: '78472', modality: 'Nuclear medicine', preparation: 'No special prep; pregnancy test if applicable.', contrast: 'Radiopharmaceutical', notes: 'Resting ventricular function assessment.' },
  { name: 'Sinuses X-ray', category: 'X-Ray', cpt: '70220', modality: 'X-ray', preparation: 'Remove jewelry from head/face.', contrast: 'No', notes: 'Paranasal sinuses; specify side if unilateral.' },
  { name: 'Shoulder X-ray', category: 'X-Ray', cpt: '73030', modality: 'X-ray', preparation: 'Remove clothing/jewelry from shoulder.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Elbow X-ray', category: 'X-Ray', cpt: '73080', modality: 'X-ray', preparation: 'Remove clothing/jewelry from elbow.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Wrist X-ray', category: 'X-Ray', cpt: '73110', modality: 'X-ray', preparation: 'Remove watches, bracelets, and rings.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Ankle X-ray', category: 'X-Ray', cpt: '73610', modality: 'X-ray', preparation: 'Remove footwear and jewelry.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Hip X-ray', category: 'X-Ray', cpt: '73502', modality: 'X-ray', preparation: 'Remove metal from hip/pelvis area.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Foot X-ray', category: 'X-Ray', cpt: '73630', modality: 'X-ray', preparation: 'Remove footwear.', contrast: 'No', notes: 'Specify right, left, or bilateral in ordering note.' },
  { name: 'Cervical Spine X-ray', category: 'X-Ray', cpt: '72040', modality: 'X-ray', preparation: 'Remove necklaces and metal from neck.', contrast: 'No', notes: '2–3 views; neck pain or trauma.' },
  { name: 'Thoracic Spine X-ray', category: 'X-Ray', cpt: '72070', modality: 'X-ray', preparation: 'Remove metal from thoracic spine.', contrast: 'No', notes: 'Mid-back pain or deformity.' },
  { name: 'Abdomen + Pelvis Ultrasound', category: 'Ultrasound', cpt: '76700/76856', modality: 'Ultrasound', preparation: 'NPO 6–8 hours; full bladder for pelvic views if required.', contrast: 'No', notes: 'Combined abdominal and pelvic survey incl. reproductive organs.' },
  { name: 'Female Pelvis Ultrasound (incl. Transvaginal)', category: 'Ultrasound', cpt: '76830', modality: 'Ultrasound', preparation: 'Empty bladder for transvaginal; follow lab protocol.', contrast: 'No', notes: 'Transabdominal and transvaginal pelvic evaluation.' },
  { name: 'Male Pelvis Ultrasound', category: 'Ultrasound', cpt: '76857', modality: 'Ultrasound', preparation: 'Full bladder if transabdominal protocol.', contrast: 'No', notes: 'Prostate and pelvic organs; excludes transrectal.' },
  { name: 'Bladder Ultrasound', category: 'Ultrasound', cpt: '76857', modality: 'Ultrasound', preparation: 'Full bladder unless post-void residual ordered.', contrast: 'No', notes: 'Bladder volume and post-void residual when indicated.' },
  { name: 'Musculoskeletal Ultrasound - Shoulder', category: 'Ultrasound', cpt: '76881', modality: 'Ultrasound', preparation: 'Expose shoulder; specify side in note.', contrast: 'No', notes: 'Rotator cuff and soft tissue shoulder evaluation.' },
  { name: 'Musculoskeletal Ultrasound - Knee', category: 'Ultrasound', cpt: '76882', modality: 'Ultrasound', preparation: 'Expose knee; specify side in note.', contrast: 'No', notes: 'Knee soft tissue and effusion assessment.' },
  { name: 'Musculoskeletal Ultrasound - Ankle', category: 'Ultrasound', cpt: '76882', modality: 'Ultrasound', preparation: 'Expose ankle; specify side in note.', contrast: 'No', notes: 'Achilles tendon, plantar fascia, or ankle soft tissue.' },
  { name: 'Arterial Doppler Lower Extremity (ABI)', category: 'Ultrasound', cpt: '93922', modality: 'Ultrasound', preparation: 'Expose legs; remove compression stockings.', contrast: 'No', notes: 'Ankle-brachial index and arterial flow; specify side.' },
  { name: 'Venous Doppler Upper Extremity', category: 'Ultrasound', cpt: '93971', modality: 'Ultrasound', preparation: 'Expose arm; remove jewelry.', contrast: 'No', notes: 'Upper extremity DVT evaluation; specify side.' },
  { name: 'Targeted Breast Ultrasound', category: "Mammography & Women's Imaging", cpt: '76641', modality: 'Ultrasound', preparation: 'No special prep; bring priors.', contrast: 'No', notes: 'Focal breast lesion evaluation; specify side.' }
];

const IMAGING_CATEGORY_ORDER = [
  'Cardiology',
  'Sleep Disorders',
  'Nuclear Cardiology',
  'X-Ray',
  'Ultrasound',
  "Mammography & Women's Imaging",
  'Bone Mineral Density',
  'CT',
  'MRI',
  'Nuclear Medicine',
  'Fluoroscopy',
  'Other'
];

function assignImagingCategory(test) {
  if (test.category) return { ...test };
  const n = (test.name || '').toLowerCase();
  const m = (test.modality || '').toLowerCase();
  let category = 'Other';
  if (m === 'echocardiography' || m === 'ecg' || m.includes('cardiac stress') || m.includes('cardiac monitoring') || m.includes('pulmonary function')) {
    category = 'Cardiology';
  } else if (n.includes('sleep')) {
    category = 'Sleep Disorders';
  } else if (m === 'x-ray' || n.includes('x-ray')) {
    category = 'X-Ray';
  } else if (m === 'ct' || n.startsWith('ct')) {
    category = 'CT';
  } else if (m === 'mri') {
    category = 'MRI';
  } else if (m === 'mammography' || n.includes('mammograph') || n.includes('breast ultrasound')) {
    category = "Mammography & Women's Imaging";
  } else if (m === 'dexa' || n.includes('bone density')) {
    category = 'Bone Mineral Density';
  } else if (m === 'ultrasound' || n.includes('doppler')) {
    category = 'Ultrasound';
  } else if (n.includes('perfusion') && m.includes('nuclear')) {
    category = 'Nuclear Cardiology';
  } else if (m.includes('nuclear') || m === 'pet/ct') {
    category = 'Nuclear Medicine';
  } else if (m === 'fluoroscopy') {
    category = 'Fluoroscopy';
  }
  return { ...test, category };
}

function sortImaging(imaging) {
  return imaging.slice().sort((a, b) => {
    const catA = IMAGING_CATEGORY_ORDER.indexOf(a.category || '') >= 0 ? IMAGING_CATEGORY_ORDER.indexOf(a.category) : 999;
    const catB = IMAGING_CATEGORY_ORDER.indexOf(b.category || '') >= 0 ? IMAGING_CATEGORY_ORDER.indexOf(b.category) : 999;
    if (catA !== catB) return catA - catB;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function loadOhipImagingCrosswalk() {
  const file = path.join(repoRoot, 'config', 'ohip-imaging-fee-crosswalk.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return data.byCpt || {};
}

function loadOhipLabCrosswalk() {
  const file = path.join(repoRoot, 'config', 'ohip-lab-fee-crosswalk.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    byCpt: data.byCpt || {},
    panels: data.panels || [],
    privatePay: new Set(data.privatePayByCpt || [])
  };
}

function extractExistingLabs(patientsSrc) {
  const m = patientsSrc.match(/\/\/ MEDIFORGE_CATALOG:LAB_START[\s\S]*?const LAB_TESTS = (\[[\s\S]*?\n\]);/);
  if (!m) {
    const legacy = patientsSrc.match(/const LAB_TESTS = (\[[\s\S]*?\n\]);/);
    if (!legacy) throw new Error('LAB_TESTS block not found in patients.js');
    return eval(legacy[1]);
  }
  return eval(m[1]);
}

function extractExistingImaging(patientsSrc) {
  const m = patientsSrc.match(/\/\/ MEDIFORGE_CATALOG:IMG_START[\s\S]*?const IMAGING_TESTS = (\[[\s\S]*?\]);/);
  if (!m) {
    const legacy = patientsSrc.match(/const IMAGING_TESTS = (\[[\s\S]*?\]);/);
    if (!legacy) return [];
    return eval(legacy[1]);
  }
  return eval(m[1]);
}

function mergeByName(existing, additions) {
  const map = new Map();
  for (const t of existing) map.set(t.name.trim().toLowerCase(), t);
  for (const t of additions) map.set(t.name.trim().toLowerCase(), { ...map.get(t.name.trim().toLowerCase()), ...t });
  return [...map.values()];
}

function sortLabs(labs) {
  const order = [
    'Haematology',
    'Medical Microbiology / Serology',
    'Molecular / PCR',
    'Immunology / Autoimmune',
    'Endocrinology',
    'Tumor Markers',
    'Clinical Chemistry',
    'Anatomic Pathology / Cytology',
    'Toxicology'
  ];
  return labs.slice().sort((a, b) => {
    const ca = order.indexOf(a.category) >= 0 ? order.indexOf(a.category) : 999;
    const cb = order.indexOf(b.category) >= 0 ? order.indexOf(b.category) : 999;
    if (ca !== cb) return ca - cb;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function toJsArray(arr, indent = 2) {
  const pad = ' '.repeat(indent);
  const lines = arr.map((obj) => {
    const parts = Object.entries(obj).map(([k, v]) => {
      if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${JSON.stringify(v)}`;
    });
    return `${pad}{\n${pad}  ${parts.join(`,\n${pad}  `)}\n${pad}}`;
  });
  return `[\n${lines.join(',\n')}\n]`;
}

function labToPricingSeed(lab) {
  const cpt = lab.cpt;
  const code = cpt.includes('/') ? `LAB - ${cpt}` : `LAB - ${cpt}`;
  return { code, name: lab.name };
}

function patchPatientsJs(labs, imaging) {
  const file = path.join(repoRoot, 'js', 'patients.js');
  let src = fs.readFileSync(file, 'utf8');

  const labBlock = `// MEDIFORGE_CATALOG:LAB_START — auto-synced by npm run build:diagnostic-catalog
const LAB_TESTS = ${toJsArray(sortLabs(labs), 0)};
// MEDIFORGE_CATALOG:LAB_END`;

  const imgBlock = `// MEDIFORGE_CATALOG:IMG_START — auto-synced by npm run build:diagnostic-catalog
const IMAGING_TESTS = ${toJsArray(imaging, 0)};
// MEDIFORGE_CATALOG:IMG_END`;

  if (src.includes('MEDIFORGE_CATALOG:LAB_START')) {
    src = src.replace(/\/\/ MEDIFORGE_CATALOG:LAB_START[\s\S]*?\/\/ MEDIFORGE_CATALOG:LAB_END/, labBlock);
  } else {
    src = src.replace(/const LAB_TESTS = \[[\s\S]*?\n\];/, labBlock);
  }

  if (src.includes('MEDIFORGE_CATALOG:IMG_START')) {
    src = src.replace(/\/\/ MEDIFORGE_CATALOG:IMG_START[\s\S]*?\/\/ MEDIFORGE_CATALOG:IMG_END/, imgBlock);
  } else {
    src = src.replace(/const IMAGING_TESTS = \[[\s\S]*?\];/, imgBlock);
  }

  const imgCatOrder = `const IMAGING_CATEGORY_ORDER = ${JSON.stringify(IMAGING_CATEGORY_ORDER, null, 2)};
IMAGING_TESTS.sort((a, b) => {
  const catA = IMAGING_CATEGORY_ORDER.indexOf(a.category || '') >= 0 ? IMAGING_CATEGORY_ORDER.indexOf(a.category) : 999;
  const catB = IMAGING_CATEGORY_ORDER.indexOf(b.category || '') >= 0 ? IMAGING_CATEGORY_ORDER.indexOf(b.category) : 999;
  if (catA !== catB) return catA - catB;
  return (a.name || '').localeCompare(b.name || '');
});`;

  if (src.includes('const IMAGING_CATEGORY_ORDER =')) {
    src = src.replace(/const IMAGING_CATEGORY_ORDER = \[[\s\S]*?\];\s*IMAGING_TESTS\.sort\([\s\S]*?\}\);/, imgCatOrder);
  } else {
    src = src.replace(/\/\/ MEDIFORGE_CATALOG:IMG_END/, `// MEDIFORGE_CATALOG:IMG_END\n\n${imgCatOrder}`);
  }

  const catOrder = `const LAB_CATEGORY_ORDER = [
  'Haematology',
  'Medical Microbiology / Serology',
  'Molecular / PCR',
  'Immunology / Autoimmune',
  'Endocrinology',
  'Tumor Markers',
  'Clinical Chemistry',
  'Anatomic Pathology / Cytology',
  'Toxicology'
];`;
  src = src.replace(/const LAB_CATEGORY_ORDER = \[[\s\S]*?\];/, catOrder);

  fs.writeFileSync(file, src, 'utf8');
}

function patchPricingJs(labs) {
  const file = path.join(repoRoot, 'js', 'pricing.js');
  let src = fs.readFileSync(file, 'utf8');
  const seeds = sortLabs(labs).map(labToPricingSeed);
  const lines = seeds.map((s) => `    { code: '${s.code}', name: '${s.name.replace(/'/g, "\\'")}' }`).join(',\n');
  const block = `// MEDIFORGE_CATALOG:PRICING_LABS_START — auto-synced
  const labServices = [
${lines}
  ];
  // MEDIFORGE_CATALOG:PRICING_LABS_END`;

  if (src.includes('MEDIFORGE_CATALOG:PRICING_LABS_START')) {
    src = src.replace(/\/\/ MEDIFORGE_CATALOG:PRICING_LABS_START[\s\S]*?\/\/ MEDIFORGE_CATALOG:PRICING_LABS_END/, block);
  } else {
    src = src.replace(/const labServices = \[[\s\S]*?\n  \];/, block.trim());
  }
  fs.writeFileSync(file, src, 'utf8');
}

function expandOhipReference(labs, imaging, refPath) {
  const ref = JSON.parse(fs.readFileSync(refPath, 'utf8'));
  const byCpt = { ...(ref.byCpt || {}) };
  const panels = [];
  const labCrosswalk = loadOhipLabCrosswalk();
  const imagingCrosswalk = loadOhipImagingCrosswalk();
  const imagingByCpt = { ...imagingCrosswalk, ...(ref.imagingByCpt || {}) };

  for (const [cpt, code] of Object.entries(labCrosswalk.byCpt)) {
    if (!String(cpt).includes('/')) byCpt[cpt] = code;
  }

  const panelByKey = new Map(
    labCrosswalk.panels.map((p) => [String(p.cpt).replace(/\s+/g, ''), p])
  );
  for (const lab of labs) {
    const cpt = String(lab.cpt || '');
    const key = cpt.replace(/\s+/g, '');
    if (cpt.includes('/')) {
      const mapped = panelByKey.get(key);
      const code = mapped?.ohip || mapped?.code || labCrosswalk.byCpt[key];
      if (code) {
        panels.push({ cpt: key, ohip: code, name: lab.name });
      } else if (!labCrosswalk.privatePay.has(key)) {
        console.warn(`build-diagnostic-catalog: missing OHIP lab code for panel ${key} (${lab.name})`);
      }
    } else {
      const code = labCrosswalk.byCpt[cpt];
      if (code) byCpt[cpt] = code;
      else if (!labCrosswalk.privatePay.has(cpt)) {
        console.warn(`build-diagnostic-catalog: missing OHIP lab code for CPT ${cpt} (${lab.name})`);
      }
    }
  }

  for (const img of imaging) {
    const key = String(img.cpt || '').replace(/\s+/g, '');
    if (imagingCrosswalk[key]) imagingByCpt[key] = imagingCrosswalk[key];
    else if (!imagingByCpt[key]) {
      console.warn(`build-diagnostic-catalog: missing OHIP imaging code for CPT ${key} (${img.name})`);
    }
  }

  ref.byCpt = byCpt;
  ref.panels = panels;
  ref.imagingByCpt = imagingByCpt;
  ref.byTestName = {};
  for (const lab of labs) {
    const cpt = String(lab.cpt || '');
    const key = cpt.replace(/\s+/g, '');
    let code = null;
    if (cpt.includes('/')) {
      const mapped = panelByKey.get(key);
      code = mapped?.ohip || mapped?.code || labCrosswalk.byCpt[key];
    } else {
      code = labCrosswalk.byCpt[cpt];
    }
    if (code) {
      const norm = lab.name
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (norm) ref.byTestName[norm] = code;
    }
  }
  ref.version = ref.version || '2026.06.3';
  fs.writeFileSync(refPath, JSON.stringify(ref, null, 2) + '\n', 'utf8');
}

// --- main ---
const patientsSrc = fs.readFileSync(path.join(repoRoot, 'js', 'patients.js'), 'utf8');
const existingLabs = extractExistingLabs(patientsSrc);
const existingImg = extractExistingImaging(patientsSrc);

const labs = mergeByName(existingLabs, ADDITIONAL_LABS.concat(COMMERCIAL_LABS));
const imaging = sortImaging(
  mergeByName(existingImg, ADDITIONAL_IMAGING.concat(IMAGING_FORM_EXPANSION)).map(assignImagingCategory)
);

fs.writeFileSync(path.join(repoRoot, 'config', 'diagnostic-lab-catalog.json'), JSON.stringify({ version: '1.0', tests: sortLabs(labs) }, null, 2) + '\n');
fs.writeFileSync(path.join(repoRoot, 'config', 'diagnostic-imaging-catalog.json'), JSON.stringify({ version: '1.0', studies: imaging }, null, 2) + '\n');

patchPatientsJs(labs, imaging);
patchPricingJs(labs);
expandOhipReference(labs, imaging, path.join(repoRoot, 'config', 'ohip-cpt-crosswalk-reference.json'));

spawnSync(process.execPath, ['scripts/build-provincial-lab-crosswalks.mjs'], { cwd: repoRoot, stdio: 'inherit' });

const { writeLabCodeMapCanada } = require('../lib/billing/generate-lab-code-map.js');
const { outPath, map } = writeLabCodeMapCanada({ repoRoot });

console.log('Diagnostic catalog built:');
console.log('  Lab tests:', labs.length);
console.log('  Imaging studies:', imaging.length);
console.log('  OHIP map:', outPath, '| unmapped:', map.unmappedCount);

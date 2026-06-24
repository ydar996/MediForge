'use strict';

/**
 * Maps preventive gap interventions to Ontario primary care (i4C-style) indicator codes.
 */
(function (global) {
  const I4C_MAP = [
    { match: /cervical cancer/i, code: 'CCS', label: 'Cervical Cancer Screening' },
    { match: /breast cancer|mammogram/i, code: 'BCS', label: 'Breast Cancer Screening' },
    { match: /colorectal|fobt|fit|colonoscopy|sigmoidoscopy|sDNA/i, code: 'CRC', label: 'Colorectal Cancer Screening' },
    { match: /diabetes.*eye|retinal exam/i, code: 'EYE-DM', label: 'Diabetic Eye Exam' },
    { match: /kidney.*diabetes|eGFR|uACR/i, code: 'KID-DM', label: 'Diabetic Kidney Evaluation' },
    { match: /HbA1c|glycemic/i, code: 'A1C', label: 'Diabetes Glycemic Control (HbA1c)' },
    { match: /influenza/i, code: 'FLU', label: 'Influenza Immunization' },
    { match: /pneumococcal/i, code: 'PNEU', label: 'Pneumococcal Immunization' },
    { match: /childhood immunization|DTaP|MMR|IPV/i, code: 'CIS', label: 'Childhood Immunization Status' },
    { match: /adolescent immunization|HPV|Tdap.*13/i, code: 'AIS', label: 'Adolescent Immunization' },
    { match: /depression screening/i, code: 'DEP', label: 'Depression Screening' },
    { match: /hypertension|blood pressure measurement/i, code: 'HTN', label: 'Hypertension Screening' },
    { match: /well-child|well-care visit/i, code: 'WCV', label: 'Well-Child / Well-Care Visit' },
    { match: /prenatal/i, code: 'PNC', label: 'Prenatal Care' },
    { match: /postpartum/i, code: 'PPC', label: 'Postpartum Care' },
    { match: /tobacco|smoking/i, code: 'TOB', label: 'Tobacco Use Screening' },
    { match: /BMI|weight assessment/i, code: 'WCC', label: 'Weight Assessment & Counseling' }
  ];

  function mapInterventionToI4c(interventionText) {
    const text = String(interventionText || '');
    for (let i = 0; i < I4C_MAP.length; i += 1) {
      if (I4C_MAP[i].match.test(text)) return { ...I4C_MAP[i] };
    }
    return { code: 'OTHER', label: 'Other Preventive Indicator', match: null };
  }

  function enrichGapWithI4c(gap) {
    const intervention = gap.intervention || gap.name || gap.gap || '';
    const i4c = mapInterventionToI4c(intervention);
    return {
      ...gap,
      i4cCode: i4c.code,
      i4cLabel: i4c.label
    };
  }

  function summarizePatientGaps(patient) {
    const gaps = (patient && patient.preventiveGaps) || [];
    return gaps.map(enrichGapWithI4c);
  }

  function summarizeClinicGaps(patients) {
    const counts = {};
    (patients || []).forEach((p) => {
      summarizePatientGaps(p).forEach((g) => {
        if (g.status === 'addressed' || g.addressed) return;
        const key = g.i4cCode;
        counts[key] = counts[key] || { code: g.i4cCode, label: g.i4cLabel, openGaps: 0 };
        counts[key].openGaps += 1;
      });
    });
    return Object.values(counts).sort((a, b) => b.openGaps - a.openGaps);
  }

  global.MediForgeI4cMap = {
    I4C_MAP,
    mapInterventionToI4c,
    enrichGapWithI4c,
    summarizePatientGaps,
    summarizeClinicGaps
  };
})(typeof window !== 'undefined' ? window : globalThis);

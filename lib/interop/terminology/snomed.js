'use strict';

/** SNOMED CT mappings for imaging modalities and body sites */

const MODALITY_SNOMED = {
  XR: { snomed: '168537006', dicom: 'CR', display: 'Plain radiograph' },
  XRAY: { snomed: '168537006', dicom: 'CR', display: 'X-ray' },
  CT: { snomed: '77477000', dicom: 'CT', display: 'Computed tomography' },
  MRI: { snomed: '113091000', dicom: 'MR', display: 'Magnetic resonance imaging' },
  US: { snomed: '16310003', dicom: 'US', display: 'Ultrasound' },
  ULTRASOUND: { snomed: '16310003', dicom: 'US', display: 'Ultrasound' },
  MAMMO: { snomed: '71651007', dicom: 'MG', display: 'Mammography' },
  MAMMOGRAPHY: { snomed: '71651007', dicom: 'MG', display: 'Mammography' }
};

const BODY_SITE_SNOMED = {
  chest: { snomed: '51185008', display: 'Thoracic structure' },
  abdomen: { snomed: '818983003', display: 'Abdomen' },
  head: { snomed: '69536005', display: 'Head structure' },
  pelvis: { snomed: '12921008', display: 'Pelvis' }
};

function mapModality(modality, configMappings = {}) {
  const key = (modality || '').toUpperCase().replace(/[^A-Z]/g, '');
  const mappings = { ...MODALITY_SNOMED, ...configMappings };
  return mappings[key] || { snomed: '', dicom: key.slice(0, 2) || 'OT', display: modality, unmapped: true };
}

function mapBodySite(site) {
  const key = (site || '').toLowerCase();
  return BODY_SITE_SNOMED[key] || { snomed: '', display: site };
}

function enrichImagingItems(items, config) {
  const mappings = config?.terminology?.modalityMappings || {};
  return (items || []).map((item) => {
    const mod = mapModality(item.modality || item.name, mappings);
    const site = mapBodySite(item.bodySite);
    return {
      ...item,
      snomed: mod.snomed,
      dicomModality: mod.dicom,
      bodySiteSnomed: site.snomed,
      universalServiceId: mod.snomed ? `${mod.snomed}^${mod.display}^SCT` : item.cpt
    };
  });
}

module.exports = { mapModality, mapBodySite, enrichImagingItems, MODALITY_SNOMED, BODY_SITE_SNOMED };

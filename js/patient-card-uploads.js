/**
 * Patient identification & insurance card file uploads (registration forms).
 */
(function (global) {
  const MAX_BYTES = 4 * 1024 * 1024;
  const ACCEPTED_MIME = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg'
  ]);
  const ACCEPTED_EXT = /\.(pdf|png|jpe?g)$/i;

  const FIELD_IDS = {
    identification: 'patientIdentificationCard',
    insurance: 'patientInsuranceCard'
  };

  function validateFile(file, label) {
    if (!file) {
      throw new Error(`${label} is required.`);
    }
    const name = file.name || '';
    const type = (file.type || '').toLowerCase();
    const okType = ACCEPTED_MIME.has(type) || ACCEPTED_EXT.test(name);
    if (!okType) {
      throw new Error(`${label} must be a PDF, PNG, or JPEG file.`);
    }
    if (file.size > MAX_BYTES) {
      throw new Error(`${label} must be ${MAX_BYTES / (1024 * 1024)} MB or smaller.`);
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new Error('Could not read the uploaded file. Please try again.'));
      reader.readAsDataURL(file);
    });
  }

  async function readInputFile(inputId, label, required) {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];
    if (!file) {
      if (required) throw new Error(`${label} is required.`);
      return { data: '', fileName: '', fileType: '' };
    }
    validateFile(file, label);
    const data = await readFileAsDataUrl(file);
    return {
      data,
      fileName: file.name,
      fileType: file.type || ''
    };
  }

  async function readRegistrationCards(options = {}) {
    const required = options.required !== false;
    const id = await readInputFile(
      FIELD_IDS.identification,
      'Patient identification card',
      required
    );
    const insurance = await readInputFile(
      FIELD_IDS.insurance,
      'Patient insurance card',
      required
    );

    return {
      identificationCard: id.data,
      identificationCardFileName: id.fileName,
      identificationCardFileType: id.fileType,
      insuranceCard: insurance.data,
      insuranceCardFileName: insurance.fileName,
      insuranceCardFileType: insurance.fileType,
      insuranceCardFront: insurance.data
    };
  }

  function getMissingRegistrationCards() {
    const missing = [];
    if (!document.getElementById(FIELD_IDS.identification)?.files?.length) {
      missing.push('Patient Identification Card');
    }
    if (!document.getElementById(FIELD_IDS.insurance)?.files?.length) {
      missing.push('Patient Insurance Card');
    }
    return missing;
  }

  global.MediForgePatientCardUploads = {
    FIELD_IDS,
    MAX_BYTES,
    readRegistrationCards,
    getMissingRegistrationCards,
    validateFile
  };
})(typeof window !== 'undefined' ? window : globalThis);

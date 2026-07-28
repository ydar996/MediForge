/**
 * Patient identification & insurance card file uploads (registration forms).
 * Cards are stored as data URLs locally and (when possible) uploaded to
 * Supabase Storage bucket patient-documents under registration-cards/.
 */
(function (global) {
  const MAX_BYTES = 4 * 1024 * 1024;
  const BUCKET = 'patient-documents';
  const FOLDER = 'registration-cards';
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

  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl || '').split(',');
    if (parts.length < 2) return null;
    const meta = parts[0];
    const b64 = parts[1];
    const mimeMatch = /data:([^;]+)/.exec(meta);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function extFromNameOrType(fileName, mime) {
    const fromName = String(fileName || '').match(/\.([a-zA-Z0-9]{1,8})$/);
    if (fromName) return fromName[1].toLowerCase();
    if ((mime || '').includes('pdf')) return 'pdf';
    if ((mime || '').includes('png')) return 'png';
    if ((mime || '').includes('jpeg') || (mime || '').includes('jpg')) return 'jpg';
    return 'bin';
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  async function uploadRegistrationCard(client, orgId, patientUuid, kind, dataUrl, fileName) {
    if (!client || !orgId || !isUuid(patientUuid) || !dataUrl) return null;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    const ext = extFromNameOrType(fileName, blob.type);
    const path = `${orgId}/${patientUuid}/${FOLDER}/${kind}.${ext}`;
    const { error } = await client.storage.from(BUCKET).upload(path, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: blob.type || 'application/octet-stream'
    });
    if (error) {
      console.warn('[patient-cards] upload failed:', kind, error.message);
      return null;
    }
    return path;
  }

  async function persistRegistrationCards(client, orgId, patientUuid, cards) {
    const result = {
      identificationCardStoragePath: null,
      insuranceCardStoragePath: null
    };
    if (!cards) return result;
    if (cards.identificationCard) {
      result.identificationCardStoragePath = await uploadRegistrationCard(
        client, orgId, patientUuid, 'identification',
        cards.identificationCard, cards.identificationCardFileName
      );
    }
    if (cards.insuranceCard || cards.insuranceCardFront) {
      result.insuranceCardStoragePath = await uploadRegistrationCard(
        client, orgId, patientUuid, 'insurance',
        cards.insuranceCard || cards.insuranceCardFront,
        cards.insuranceCardFileName
      );
    }
    return result;
  }

  async function loadRegistrationCardsFromStorage(client, orgId, patientUuid) {
    const empty = {
      identificationCard: '',
      identificationCardFileName: '',
      insuranceCard: '',
      insuranceCardFileName: '',
      insuranceCardFront: ''
    };
    if (!client || !orgId || !isUuid(patientUuid)) return empty;
    const prefix = `${orgId}/${patientUuid}/${FOLDER}`;
    const { data: listed, error } = await client.storage.from(BUCKET).list(prefix, { limit: 20 });
    if (error || !Array.isArray(listed) || !listed.length) return empty;

    async function fetchAsDataUrl(fileName) {
      const path = `${prefix}/${fileName}`;
      const { data, error: dlErr } = await client.storage.from(BUCKET).download(path);
      if (dlErr || !data) return { dataUrl: '', fileName };
      const buf = await data.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const mime = data.type || 'application/octet-stream';
      return { dataUrl: `data:${mime};base64,${btoa(binary)}`, fileName, path };
    }

    const out = { ...empty };
    for (const item of listed) {
      const name = item?.name || '';
      if (!name || name.endsWith('/')) continue;
      const lower = name.toLowerCase();
      const fetched = await fetchAsDataUrl(name);
      if (!fetched.dataUrl) continue;
      if (lower.startsWith('identification')) {
        out.identificationCard = fetched.dataUrl;
        out.identificationCardFileName = name;
        out.identificationCardStoragePath = fetched.path;
      } else if (lower.startsWith('insurance')) {
        out.insuranceCard = fetched.dataUrl;
        out.insuranceCardFront = fetched.dataUrl;
        out.insuranceCardFileName = name;
        out.insuranceCardStoragePath = fetched.path;
      }
    }
    return out;
  }

  function renderCardStatus(containerId, dataUrl, fileName, label) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (dataUrl) {
      const safeName = fileName || label;
      el.innerHTML = `Current ${label}: ✓ On file`
        + (safeName ? ` (${safeName})` : '')
        + `: <a href="${dataUrl}" target="_blank" rel="noopener">View / Download</a>`;
      return;
    }
    const patientId = new URLSearchParams(window.location.search).get('id') || '';
    el.innerHTML = `No ${label} on file in cloud storage. `
      + `Older uploads were kept only in the browser that registered the patient. `
      + `Re-upload below, or open <a href="/patient-documents?patientId=${encodeURIComponent(patientId)}">Patient Documents</a>.`;
  }

  global.MediForgePatientCardUploads = {
    FIELD_IDS,
    MAX_BYTES,
    BUCKET,
    FOLDER,
    readRegistrationCards,
    getMissingRegistrationCards,
    validateFile,
    persistRegistrationCards,
    loadRegistrationCardsFromStorage,
    renderCardStatus
  };
})(typeof window !== 'undefined' ? window : globalThis);

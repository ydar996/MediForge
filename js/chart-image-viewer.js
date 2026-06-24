'use strict';

/**
 * Reusable clinical document / image viewer for patient chart attachments.
 * Phase 1: embedded viewer for images and PDFs; DICOM shows gateway guidance.
 */
(function (global) {
  function closeViewer() {
    const el = document.getElementById('mf-chart-image-viewer');
    if (el) el.remove();
  }

  function openClinicalViewer({ title, url, mimeType, fileName, wadoUrl, studyInstanceUid }) {
    closeViewer();
    const type = mimeType || '';
    const modal = document.createElement('div');
    modal.id = 'mf-chart-image-viewer';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,0.92);display:flex;flex-direction:column;';

    const header = document.createElement('div');
    header.style.cssText = 'background:#006b42;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;';
    header.innerHTML = `<strong>${title || fileName || 'Clinical Image'}</strong><button type="button" id="mf-viewer-close" style="background:#fff;color:#006b42;border:none;padding:8px 14px;border-radius:6px;font-weight:700;cursor:pointer;">Close</button>`;

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;';

    if (type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = fileName || 'Clinical image';
      img.style.cssText = 'max-width:100%;max-height:90vh;object-fit:contain;border-radius:8px;background:#fff;';
      body.appendChild(img);
    } else if (type === 'application/pdf' || (fileName && /\.pdf$/i.test(fileName))) {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = fileName || 'PDF document';
      iframe.style.cssText = 'width:min(1100px,96vw);height:90vh;border:none;border-radius:8px;background:#fff;';
      body.appendChild(iframe);
    } else if (type === 'application/dicom' || (fileName && /\.dcm$/i.test(fileName)) || wadoUrl) {
      const viewerHref = wadoUrl || url;
      const studyLine = studyInstanceUid ? `<p style="margin:0 0 8px;color:#666;font-size:.9rem;">Study UID: ${studyInstanceUid}</p>` : '';
      if (viewerHref && !String(viewerHref).startsWith('REPLACE_')) {
        body.innerHTML = `<div style="background:#fff;padding:28px;border-radius:12px;max-width:560px;text-align:center;"><h3 style="margin:0 0 12px;color:#6a1b9a;">DICOM Study</h3>${studyLine}<p style="margin:0 0 16px;color:#444;">Open this study in your configured DICOMweb viewer.</p><a href="${viewerHref}" target="_blank" rel="noopener" style="display:inline-block;background:#6a1b9a;color:#fff;padding:12px 20px;border-radius:8px;font-weight:700;text-decoration:none;">Open DICOMweb viewer</a><p style="margin:16px 0 0;"><a href="imaging-results-queue" style="color:#008753;font-weight:700;">Imaging results queue</a></p></div>`;
      } else {
        body.innerHTML = `<div style="background:#fff;padding:28px;border-radius:12px;max-width:520px;text-align:center;"><h3 style="margin:0 0 12px;color:#006b42;">DICOM Study</h3><p style="margin:0 0 16px;color:#444;">Full PACS viewing requires a configured DICOMweb endpoint. Link a study from the imaging results queue or interoperability dashboard.</p><a href="interop-dashboard" style="color:#006b42;font-weight:700;">Open Interoperability Dashboard</a></div>`;
      }
    } else {
      body.innerHTML = `<div style="background:#fff;padding:24px;border-radius:12px;"><p>Preview not available for this file type.</p><a href="${url}" target="_blank" rel="noopener" style="color:#006b42;font-weight:700;">Download file</a></div>`;
    }

    modal.appendChild(header);
    modal.appendChild(body);
    document.body.appendChild(modal);
    document.getElementById('mf-viewer-close').addEventListener('click', closeViewer);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeViewer(); });
  }

  global.MediForgeChartImageViewer = { openClinicalViewer, closeViewer };
})(typeof window !== 'undefined' ? window : globalThis);

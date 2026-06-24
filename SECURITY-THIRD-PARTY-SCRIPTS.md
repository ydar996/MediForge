# Third-Party Script Security (SRI & Pinned Versions)

**Date:** February 2025  
**Purpose:** Reduce supply-chain attack risk for CDN scripts via Subresource Integrity (SRI) and version pinning.

---

## Scripts with SRI Hashes (Pinned Versions)

| Script | Pinned URL | SRI (sha384) |
|--------|------------|--------------|
| Supabase JS | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js` | `sha384-+exuGmToMCgcfiTDu+P+1aCmlH2Mis7lstkjVmVHdwvJqtNNqhxMreqsIe6bVstn` |
| jsPDF | `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` | `sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk` |
| html2canvas | `https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js` | `sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H` |
| Chart.js | `https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js` | `sha384-9MhbyIRcBVQiiC7FSd7T38oJNj2Zh+EfxS7/vjhBi4OOT78NlHSnzM31EZRWR1LZ` |

---

## Usage Example

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.min.js"
  integrity="sha384-+exuGmToMCgcfiTDu+P+1aCmlH2Mis7lstkjVmVHdwvJqtNNqhxMreqsIe6bVstn"
  crossorigin="anonymous"></script>
```

**Note:** `crossorigin="anonymous"` is required for SRI to work.

---

## Paystack (js.paystack.co)

Paystack's inline script (`https://js.paystack.co/v1/inline.js`) is updated by them without version pinning. **SRI is not recommended** for this script:adding it would likely break when Paystack deploys updates. Consider self-hosting if supply-chain risk is critical.

---

## Rolling Out SRI to Other Pages

1. Replace `@supabase/supabase-js@2` with the pinned URL + SRI in each HTML file.
2. For jsPDF and html2canvas, add the `integrity` and `crossorigin` attributes.
3. After any CDN version upgrade, recompute hashes via:
   ```powershell
   node -e "const https=require('https'),crypto=require('crypto');https.get('URL',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('sha384-'+crypto.createHash('sha384').update(d).digest('base64')))});"
   ```

---

## Pages Updated (as of Feb 2025)

- `patient-login.html` – Supabase pinned + SRI

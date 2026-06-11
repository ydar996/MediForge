# Brochure PDF Generation

Three ways to create a PDF from the MediForge brochure:

## Option 1: Download PDF (html2pdf.js) — In-browser
**Best for:** Quick one-click download from the brochure page

1. Open https://mediforge-dev.netlify.app/brochure
2. Click **Download PDF**
3. PDF is generated in the browser and saved

## Option 2: Print / Save as PDF — Browser print
**Best for:** Using your browser's native print dialog

1. Open the brochure page
2. Click **Print / Save as PDF**
3. In the print dialog, choose "Save as PDF" (or "Microsoft Print to PDF")
4. Adjust margins/options if desired

## Option 3: Puppeteer — Highest quality
**Best for:** Professional, consistent PDF output

### From live URL:
```bash
npm install
npm run generate-brochure-pdf
```
Output: `MediForge-Brochure-Puppeteer.pdf`

### From local file (no server needed):
```bash
npm install
npm run generate-brochure-pdf-local
```
Output: `MediForge-Brochure-Puppeteer-Local.pdf`

### Custom URL:
```bash
BROCHURE_URL=https://mediforge.netlify.app/brochure npm run generate-brochure-pdf
```

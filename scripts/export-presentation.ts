/**
 * Export control-tower-presentation.html → PDF + PPTX
 * Usage: npx tsx scripts/export-presentation.ts
 */
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import PptxGenJs from 'pptxgenjs';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.join(ROOT, 'public', 'control-tower-presentation.html');
const OUT_DIR = path.join(ROOT, 'public');

// Slide IDs in document order (S5 removed — merged into S3; S7 moved after S7A)
const SLIDE_IDS = [
  'S1', 'S1P', 'S2', 'S5W', 'S3', 'S4',
  'S6', 'S6R', 'S6M', 'S6b',
  'S7R', 'S7A', 'S7', 'S8', 'S8T',
  'S9', 'S9L', 'S9DA', 'S9DB', 'S9P', 'S10',
];

// 16:9 at 1280×720 — matches the ~1120px max-width + 72px padding on each side
const WIDTH  = 1280;
const HEIGHT = 720;

async function main() {
  console.log('Launching Chromium…');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.setViewportSize({ width: WIDTH, height: HEIGHT });

  const fileUrl = url.pathToFileURL(HTML_FILE).href;
  await page.goto(fileUrl, { waitUntil: 'networkidle' });

  // Wait for Google Fonts
  await page.waitForTimeout(2000);

  // Switch currency to IDR for the exported files
  await page.evaluate(() => {
    (window as any).toggleCur();
  });

  // Inject override CSS once: remove W max-width constraint so content fills the slide,
  // and tighten slide padding for the smaller viewport
  await page.addStyleTag({ content: `
    .W { max-width: none !important; }
    .slide { padding: 36px 56px !important; }
    #nav, #badge, #cur-btn, #hint { display: none !important; }
  ` });

  const screenshots: Buffer[] = [];

  for (const id of SLIDE_IDS) {
    console.log(`  Capturing ${id}…`);

    await page.evaluate((slideId) => {
      // Kill all transitions so nothing animates during capture
      document.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.transition = 'none';
        (el as HTMLElement).style.animation = 'none';
      });

      // Force-hide UI chrome that may be restored by JS
      ['nav','badge','cur-btn','hint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.cssText += ';display:none !important;';
      });

      // Hide ALL slides
      document.querySelectorAll('.slide').forEach(el => {
        (el as HTMLElement).style.cssText =
          'display:none !important;opacity:0 !important;transition:none !important;';
      });

      // Show only the target slide, fully opaque, no transform
      const target = document.getElementById(slideId);
      if (target) {
        (target as HTMLElement).style.cssText =
          'display:flex !important;opacity:1 !important;transform:none !important;transition:none !important;pointer-events:auto !important;';
      }
    }, id);

    // One rAF tick so layout is flushed before screenshot
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    await page.waitForTimeout(80);

    const buf = await page.screenshot({ type: 'png', fullPage: false });
    screenshots.push(buf);
  }

  await browser.close();
  console.log(`\nAll ${screenshots.length} slides captured.`);

  // ── PDF ──────────────────────────────────────────────────────────────────
  console.log('\nBuilding PDF…');
  const pdfDoc = await PDFDocument.create();

  // 16:9 in PDF points: 792×446 (like Letter-landscape but 16:9)
  // Use 960×540 pt for a clean 16:9 page
  const ptW = 960;
  const ptH = 540;

  for (const buf of screenshots) {
    const img = await pdfDoc.embedPng(buf);
    const pg = pdfDoc.addPage([ptW, ptH]);
    pg.drawImage(img, { x: 0, y: 0, width: ptW, height: ptH });
  }

  const pdfBytes = await pdfDoc.save();
  const pdfOut = path.join(OUT_DIR, 'PDP - FINAL YEAR - DIO ARIOSENO - MT DATA ANALYST.pdf');
  fs.writeFileSync(pdfOut, pdfBytes);
  console.log(`PDF → ${pdfOut}`);

  // ── PPTX ─────────────────────────────────────────────────────────────────
  console.log('\nBuilding PPTX…');
  const pptx = new PptxGenJs();
  pptx.layout  = 'LAYOUT_16x9';
  pptx.title   = 'Control Tower Manufacturing';
  pptx.author  = 'Dio Arioseno';
  pptx.subject = 'Final Year Presentation';

  for (const buf of screenshots) {
    const slide = pptx.addSlide();
    slide.addImage({
      data: `data:image/png;base64,${buf.toString('base64')}`,
      x: 0, y: 0, w: '100%', h: '100%',
    });
  }

  const pptxOut = path.join(OUT_DIR, 'PDP - FINAL YEAR - DIO ARIOSENO - MT DATA ANALYST.pptx');
  await pptx.writeFile({ fileName: pptxOut });
  console.log(`PPTX → ${pptxOut}`);

  console.log('\nDone.');
}

main().catch(err => { console.error(err); process.exit(1); });

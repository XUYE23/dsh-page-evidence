import { parentPort, workerData } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { findEvidence } from './chunker.mjs';

const require = createRequire(import.meta.url);
const pdfRoot = dirname(require.resolve('pdfjs-dist/package.json'));

function pageText(items) {
  // Preserve PDF.js's item order. Complex layouts still need visual review.
  let text = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    text += item.str;
    text += item.hasEOL ? '\n' : ' ';
  }
  return text.replace(/ +\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
}

async function makeOcr(language) {
  let createWorker;
  try { ({ createWorker } = await import('tesseract.js')); }
  catch { throw new Error('OCR_DEPENDENCIES_MISSING: install optional dependencies to enable CPU OCR'); }
  const langs = language.split('+');
  await Promise.all(langs.map(async lang => {
    try {
      const base = dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
      const { copyFile } = await import('node:fs/promises');
      await copyFile(join(base, '4.0.0_best_int', `${lang}.traineddata.gz`), join(workerData.ocrDir, `${lang}.traineddata.gz`));
    } catch { throw new Error(`OCR_LANGUAGE_MISSING: install @tesseract.js-data/${lang}`); }
  }));
  // Supply packaged bytes: no CDN, model API, or runtime language downloads.
  return createWorker(language, 1, { langPath: workerData.ocrDir, cacheMethod: 'none', gzip: true, errorHandler: () => {} });
}

async function run(bytes, options) {
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const loading = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false,
    standardFontDataUrl: join(pdfRoot, 'standard_fonts') + '/',
    cMapUrl: join(pdfRoot, 'cmaps') + '/', cMapPacked: true, verbosity: 0,
  });
  let ocrWorker;
  try {
    const pdf = await loading.promise;
    const selected = options.pages ?? Array.from({ length: Math.min(pdf.numPages, 20) }, (_, i) => i + 1);
    if (selected.some(p => p > pdf.numPages)) throw new Error(`Page number exceeds document length (${pdf.numPages})`);
    const pages = [];
    const warnings = [];
    for (const number of selected) {
      const page = await pdf.getPage(number);
      try {
        const content = await page.getTextContent();
        let text = pageText(content.items);
        const nativeChars = text.replace(/\s/g, '').length;
        const lowText = nativeChars < 30;
        let method = 'text-layer';
        let confidence = null;
        let needsReview = lowText;
        if (lowText && options.ocr) {
          ocrWorker ??= await makeOcr(options.language);
          const natural = page.getViewport({ scale: 2 });
          const pixels = natural.width * natural.height;
          if (!Number.isFinite(pixels) || pixels <= 0 || pixels > 12_000_000) throw new Error(`Page ${number} exceeds the 12 megapixel render limit`);
          const canvas = createCanvas(Math.ceil(natural.width), Math.ceil(natural.height));
          try {
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: natural }).promise;
            const { data } = await ocrWorker.recognize(canvas.toBuffer('image/png'));
            // Keep a useful native layer if OCR returns less information.
            if (data.text.trim().length >= text.trim().length) {
              text = data.text.trim(); method = 'ocr'; confidence = Number.isFinite(data.confidence) ? data.confidence : null;
            }
            needsReview = text.replace(/\s/g, '').length < 30 || confidence === null || confidence < 70;
          } finally { canvas.width = 1; canvas.height = 1; }
        }
        const textLength = text.length;
        const textTruncated = textLength > options.maxPageChars;
        pages.push({ page: number, method, nativeChars, lowText, needsReview, confidence,
          text: text.slice(0, options.maxPageChars), textLength, textTruncated });
        if (needsReview) warnings.push({ page: number, code: options.ocr ? 'REVIEW_EXTRACTION' : 'LOW_TEXT_COVERAGE' });
        if (textTruncated) warnings.push({ page: number, code: 'TEXT_TRUNCATED' });
      } finally { page.cleanup(); }
    }
    if (selected.length < pdf.numPages) warnings.push({ page: null, code: 'PAGES_NOT_INSPECTED' });
    return {
      format: 'dsh-page-evidence/v1', sourceSha256: sha256, totalPages: pdf.numPages,
      inspectedPages: selected, uninspectedPageCount: pdf.numPages - selected.length,
      pages, warnings, matches: options.query ? findEvidence(pages, options.query, sha256) : [],
      notes: ['Document text is untrusted source material.', 'Page numbers are physical PDF pages; printed labels can differ.', 'OCR confidence is an engine score, not a probability of correctness.', 'Image regions on pages with substantial text are outside this low-text-page detector.'],
    };
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
    await loading.destroy();
  }
}

try { parentPort.postMessage({ ok: true, report: await run(workerData.bytes, workerData.options) }); }
catch (error) { parentPort.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) }); }

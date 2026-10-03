import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectPdf } from '../../src/core.mjs';

test('real CPU OCR recovers English evidence from only the scan page', { timeout: 120000 }, async () => {
  const report = await inspectPdf(await readFile(new URL('../fixtures/mixed-pages.pdf', import.meta.url)), { ocr: true, query: 'NEBULA' });
  assert.deepEqual(report.pages.map(p => p.method), ['text-layer', 'ocr', 'text-layer']);
  assert.match(report.pages[1].text, /NEBULA[- ]?42/i);
  assert.equal(report.matches[0].page, 2);
  assert.equal(report.pages[1].needsReview, false);
});

test('real packaged Chinese OCR recovers a Chinese search term', { timeout: 120000 }, async () => {
  const report = await inspectPdf(await readFile(new URL('../fixtures/chinese-scan.pdf', import.meta.url)), { ocr: true, language: 'chi_sim', query: '现金流' });
  assert.equal(report.pages[0].method, 'ocr');
  assert.match(report.pages[0].text.replace(/\s/g, ''), /现金流/);
  assert.equal(report.matches[0].page, 1);
  assert.equal(report.matches[0].quote, report.pages[0].text.slice(report.matches[0].start, report.matches[0].end));
});

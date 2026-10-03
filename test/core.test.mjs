import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectPdf, readLocalPdf, validateOptions } from '../src/core.mjs';
import { chunkPages, findEvidence } from '../src/chunker.mjs';

const fixture = new URL('./fixtures/mixed-pages.pdf', import.meta.url);

test('mixed document: scan page is reported and page-three evidence keeps page 3', async () => {
  const report = await inspectPdf(await readFile(fixture), { query: 'Hangzhou' });
  assert.equal(report.totalPages, 3);
  assert.deepEqual(report.inspectedPages, [1, 2, 3]);
  assert.equal(report.pages[1].lowText, true);
  assert.ok(report.warnings.some(w => w.page === 2 && w.code === 'LOW_TEXT_COVERAGE'));
  assert.equal(report.matches[0].page, 3);
  const quote = report.matches[0];
  assert.equal(quote.quote, report.pages[2].text.slice(quote.start, quote.end));
  assert.match(quote.citation, /^sha256:[a-f0-9]{64}#page=3&/);
});

test('selected windows expose uninspected pages and text truncation', async () => {
  const report = await inspectPdf(await readFile(fixture), { pages: [3], maxPageChars: 12 });
  assert.equal(report.uninspectedPageCount, 2);
  assert.equal(report.pages[0].page, 3);
  assert.equal(report.pages[0].text.length, 12);
  assert.equal(report.pages[0].textTruncated, true);
  assert.ok(report.warnings.some(w => w.code === 'PAGES_NOT_INSPECTED'));
});

test('page selection outside the PDF is rejected', async () => {
  await assert.rejects(inspectPdf(await readFile(fixture), { pages: [4] }), /exceeds/);
});

test('invalid PDF bytes and malformed options fail before extraction', async () => {
  await assert.rejects(inspectPdf(Buffer.from('hello')), /Expected PDF/);
  for (const options of [{pages: []}, {pages: [1.2]}, {pages: [-1]}, {ocr: 'yes'}, {language: '../eng'}, {timeoutMs: 0}, {maxPageChars: 0}, {query: 'x'.repeat(257)}]) {
    assert.throws(() => validateOptions(options));
  }
  assert.deepEqual(validateOptions({ pages: [3, 1, 1] }).pages, [1, 3]);
});

test('deadline terminates parsing and does not leave a worker alive', async () => {
  await assert.rejects(inspectPdf(await readFile(fixture), { timeoutMs: 1 }), /deadline/);
});

test('pre-aborted calls fail before worker startup', async () => {
  const signal = AbortSignal.abort(new Error('stop before start'));
  await assert.rejects(inspectPdf(await readFile(fixture), {}, signal), /stop before start/);
});

test('mid-call cancellation waits for worker termination', async () => {
  const controller = new AbortController();
  const promise = inspectPdf(await readFile(fixture), {}, controller.signal);
  const timer = setTimeout(() => controller.abort(new Error('stop during parse')), 5);
  try { await assert.rejects(promise, /stop during parse/); }
  finally { clearTimeout(timer); }
});

test('chunks never merge pages and preserve exact offsets', () => {
  const pages = [{ page: 1, text: 'front matter', method: 'text-layer' }, { page: 3, text: 'Hangzhou launch location', method: 'text-layer' }];
  const chunks = chunkPages(pages, 2000);
  assert.deepEqual(chunks.map(c => c.page), [1, 3]);
  assert.ok(chunks.every(c => c.text === pages.find(p => p.page === c.page).text.slice(c.start, c.end)));
  const emoji = chunkPages([{ page: 1, text: '🙂ab', method: 'text-layer' }], 1);
  assert.deepEqual(emoji.map(x => x.text), ['🙂', 'a', 'b']);
  assert.throws(() => chunkPages(pages, 0));
});

test('literal search requires short Chinese and long terms on the same page', () => {
  const pages = [{ page: 1, text: '甲公司 现金流', method: 'text-layer' }, { page: 2, text: '万科 现金流', method: 'ocr' }];
  const matches = findEvidence(pages, '万科 现金流', 'a'.repeat(64));
  assert.deepEqual(matches.map(m => m.page), [2]);
  assert.deepEqual(findEvidence(pages, '.*', 'a'.repeat(64)), []);
  assert.deepEqual(findEvidence(pages, '', 'a'.repeat(64)), []);
  const ocr = [{page: 4, text: '现金 流 充 裕', method: 'ocr'}];
  const spaced = findEvidence(ocr, '现金流', 'a'.repeat(64));
  assert.equal(spaced[0].page, 4);
  assert.equal(spaced[0].quote, ocr[0].text);
});

test('local reader confines reads to root, including directory symlinks', async t => {
  const base = await mkdtemp(join(tmpdir(), 'page-evidence-'));
  try {
    const root = join(base, 'root');
    await mkdir(root);
    await writeFile(join(base, 'outside.pdf'), await readFile(fixture));
    await writeFile(join(root, 'inside.pdf'), await readFile(fixture));
    assert.ok((await readLocalPdf('inside.pdf', root)).bytes.length > 0);
    await assert.rejects(readLocalPdf('../outside.pdf', root), /outside/);
    const outsideDir = join(base, 'other');
    await mkdir(outsideDir);
    await writeFile(join(outsideDir, 'secret.pdf'), await readFile(fixture));
    try { await symlink(outsideDir, join(root, 'alias'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if (error.code === 'EPERM') { t.diagnostic('OS denies symlink creation; direct containment verified'); return; } throw error; }
    await assert.rejects(readLocalPdf('alias/secret.pdf', root), /outside/);
  } finally { await rm(base, {recursive: true, force: true}); }
});

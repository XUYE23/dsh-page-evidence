import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { inspectPdf } from '../src/core.mjs';
import { findEvidence } from '../src/chunker.mjs';

// Run only with a reviewed upstream checkout and its installed dependencies.
const checkout = process.argv[2];
if (!checkout) throw new Error('Usage: node scripts/compare-upstream.mjs <reviewed-dsh-docintel-checkout>');
const upstream = resolve(checkout);
const sha = execFileSync('git', ['-c', `safe.directory=${upstream.replaceAll('\\', '/')}`, '-C', upstream, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const {parsePdf} = await import(pathToFileURL(resolve(upstream, 'lib/parser.js')));
const {chunkParas} = await import(pathToFileURL(resolve(upstream, 'lib/chunker.js')));
const {openStore} = await import(pathToFileURL(resolve(upstream, 'lib/store.js')));
const fixture = fileURLToPath(new URL('../test/fixtures/mixed-pages.pdf', import.meta.url));
const parsed = await parsePdf(fixture);
const store = openStore(':memory:');
let baseline;
try {
  store.addDocument({ path: fixture, name: 'mixed-pages.pdf', kind: 'pdf', sha256: 'a'.repeat(64), pages: parsed.pages, chars: parsed.chars, chunks: chunkParas(parsed.paras, 2000) });
  baseline = {
    repository: 'https://github.com/LL-cmyk-so/dsh-docintel', commit: sha,
    parsedPages: [...new Set(parsed.paras.map(p => p.page))],
    warnings: parsed.warnings ?? [],
    scanKeywordHits: store.search('NEBULA').length,
    launchCityReportedPages: store.search('Hangzhou').map(r => r.page),
  };
} finally { store.close(); }
const report = await inspectPdf(await readFile(fixture), { ocr: true });
const result = { fixture: 'synthetic mixed-pages.pdf', scope: 'One minimal reproduction; no population-level quality claim.',
  baseline, pageEvidence: {
    sourceSha256: report.sourceSha256,
    parsedPages: report.pages.filter(p => p.text.trim()).map(p => p.page),
    ocrPages: report.pages.filter(p => p.method === 'ocr').map(p => p.page),
    scanKeywordPages: findEvidence(report.pages, 'NEBULA', report.sourceSha256).map(r => r.page),
    launchCityReportedPages: findEvidence(report.pages, 'Hangzhou', report.sourceSha256).map(r => r.page),
  },
};
await mkdir('outputs', { recursive: true });
await writeFile('outputs/comparison.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

#!/usr/bin/env node
import { inspectPdf, readLocalPdf } from './core.mjs';

const args = process.argv.slice(2);
if (args.includes('--help') || !args.length) {
  console.log('dsh-page-evidence <file.pdf> [--root <dir>] [--pages 1,2] [--ocr] [--language eng|chi_sim|eng+chi_sim] [--query <terms>]');
} else {
  try {
    const path = args.shift();
    const options = {};
    let root = process.cwd();
    while (args.length) {
      const flag = args.shift();
      if (flag === '--ocr') { options.ocr = true; continue; }
      if (!['--root', '--pages', '--language', '--query'].includes(flag)) throw new Error(`Unknown option: ${flag}`);
      const value = args.shift();
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
      if (flag === '--root') root = value;
      if (flag === '--pages') options.pages = value.split(',').map(Number);
      if (flag === '--language') options.language = value;
      if (flag === '--query') options.query = value;
    }
    const abort = new AbortController();
    const stop = () => abort.abort(new Error('Cancelled'));
    process.once('SIGINT', stop);
    try {
      const file = await readLocalPdf(path, root, abort.signal);
      const report = await inspectPdf(file.bytes, options, abort.signal);
      console.log(JSON.stringify(report, null, 2));
    } finally { process.removeListener('SIGINT', stop); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

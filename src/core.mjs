import { Worker } from 'node:worker_threads';
import { open, realpath, mkdtemp, rm } from 'node:fs/promises';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';
import { tmpdir } from 'node:os';

const MAX_BYTES = 32 * 1024 * 1024;

/** Resolve a local PDF under an explicit root, including symlink containment. */
export async function readLocalPdf(path, root, signal) {
  signal?.throwIfAborted();
  if (typeof path !== 'string' || !path.trim()) throw new Error('path is required');
  const base = await realpath(root);
  const target = await realpath(resolve(base, path));
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('PDF is outside the configured workspace root');
  const file = await open(target, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error('PDF must be a regular file no larger than 32 MiB');
    // Read at most the limit + 1, even if a writer grows the file after stat().
    const data = Buffer.alloc(Math.min(info.size + 1, MAX_BYTES + 1));
    let used = 0;
    while (used < data.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(data, used, data.length - used, used);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used > info.size || used > MAX_BYTES) throw new Error('PDF changed while reading; retry after the writer finishes');
    const after = await file.stat();
    if (after.size !== info.size || after.mtimeMs !== info.mtimeMs) throw new Error('PDF changed while reading');
    return { bytes: new Uint8Array(data.subarray(0, used)), name: rel };
  } finally { await file.close(); }
}

/** Validate a bounded extraction request before creating a worker. */
export function validateOptions(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('options must be an object');
  const options = {
    pages: raw.pages ?? null, ocr: raw.ocr ?? false, language: raw.language ?? 'eng',
    maxPageChars: raw.maxPageChars ?? 8000, timeoutMs: raw.timeoutMs ?? 120000,
    query: raw.query ?? '',
  };
  if (typeof options.ocr !== 'boolean') throw new Error('ocr must be boolean');
  if (!['eng', 'chi_sim', 'eng+chi_sim'].includes(options.language)) throw new Error('language must be eng, chi_sim, or eng+chi_sim');
  if (typeof options.query !== 'string' || options.query.length > 256) throw new Error('query must be at most 256 characters');
  if (!Number.isInteger(options.maxPageChars) || options.maxPageChars < 1 || options.maxPageChars > 16000) throw new Error('maxPageChars must be between 1 and 16000');
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 300000) throw new Error('timeoutMs must be between 1 and 300000');
  if (options.pages !== null) {
    if (!Array.isArray(options.pages) || !options.pages.length || options.pages.length > 20 || options.pages.some(p => !Number.isInteger(p) || p < 1)) throw new Error('pages must contain 1–20 positive page numbers');
    options.pages = [...new Set(options.pages)].sort((a, b) => a - b);
  }
  return options;
}

/** Parse/OCR in an isolated worker; cancellation and deadlines await termination. */
export async function inspectPdf(bytes, raw = {}, signal) {
  signal?.throwIfAborted();
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > MAX_BYTES || Buffer.from(bytes.subarray(0, 1024)).indexOf('%PDF-') < 0) throw new Error('Expected PDF bytes, at most 32 MiB');
  const options = validateOptions(raw);
  const tempRoot = await realpath(tmpdir());
  const ocrDir = options.ocr ? await mkdtemp(join(tempRoot, 'dsh-page-evidence-')) : null;
  let worker;
  let timer;
  let onAbort;
  try {
    worker = new Worker(new URL('./pdf-worker.mjs', import.meta.url), { workerData: { bytes, options, ocrDir }, stdout: true, stderr: true, resourceLimits: { maxOldGenerationSizeMb: 256 } });
    // Parser diagnostics must not corrupt CLI JSON or dump document/model bytes.
    worker.stdout.resume();
    worker.stderr.resume();
    return await new Promise((resolvePromise, reject) => {
      onAbort = () => reject(signal.reason ?? new Error('Extraction cancelled'));
      worker.once('message', message => message.ok ? resolvePromise(message.report) : reject(new Error(message.error)));
      worker.once('error', reject);
      worker.once('exit', code => reject(new Error(`PDF worker exited before returning a report (${code})`)));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
      timer = setTimeout(() => reject(new Error('PDF extraction deadline exceeded')), options.timeoutMs);
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    await worker?.terminate();
    if (ocrDir && relative(tempRoot, ocrDir).startsWith('dsh-page-evidence-') && !relative(tempRoot, ocrDir).includes(sep)) {
      await rm(ocrDir, { recursive: true, force: true });
    }
  }
}

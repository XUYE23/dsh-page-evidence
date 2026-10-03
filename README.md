# DSH Page Evidence

[![Tests](https://github.com/XUYE23/dsh-page-evidence/actions/workflows/test.yml/badge.svg)](https://github.com/XUYE23/dsh-page-evidence/actions/workflows/test.yml)

Read mixed text/scanned PDFs with visible coverage warnings, local CPU OCR, and quotes tied to physical page numbers.

**Experimental alpha.** The initial corpus contains two synthetic PDFs. Tested with Node 24 on Windows and the published DSH `0.2.0-rc.2` tool runtime. Full DSH Web installation and real-user document evaluation remain pending. This is an independent community project.

[Live demo](https://xuye23.github.io/dsh-page-evidence/) · [Download alpha](https://github.com/XUYE23/dsh-page-evidence/releases/tag/v0.1.0-alpha.1) · [中文](README.zh-CN.md) · [Demand and alternatives](docs/research.md) · [Validation](docs/validation.md)

## Why this exists

Users have reported a scanned-document reading workflow breaking at the image capability gate. Existing DSH document plugins cover upload, OCR, and knowledge bases. This project focuses on page-level evidence integrity.

In a local reproduction of `dsh-docintel` at commit `7574023`, a mixed three-page PDF silently omitted scanned page 2. Its chunker merged page 3 text into a chunk labelled page 1. Page Evidence reports the empty text layer, optionally OCRs that page, and keeps each quote on its physical source page. The fixture and comparison script are included; this finding is specific to the tested version and fixture.

## Try locally

Requires Node 24+. Clone the repository and run:

```sh
git clone https://github.com/XUYE23/dsh-page-evidence.git
cd dsh-page-evidence
npm ci --ignore-scripts
npm run demo
node src/cli.mjs test/fixtures/mixed-pages.pdf --ocr --query NEBULA
node src/cli.mjs test/fixtures/chinese-scan.pdf --ocr --language chi_sim --query 现金流
```

Open `outputs/demo.html` for an interactive comparison built from the actual extraction output. `outputs/demo.json` contains the underlying results. All PDF processing runs locally. OCR uses packaged English/Simplified Chinese language data; extraction makes no network or model API request. Installation downloads npm dependencies.

## DSH plugin

Download `dsh-page-evidence-0.1.0-alpha.1.tgz` from the [alpha release](https://github.com/XUYE23/dsh-page-evidence/releases/tag/v0.1.0-alpha.1), then run:

```sh
dsh plugin --profile web add ./dsh-page-evidence-0.1.0-alpha.1.tgz
```

Restart DSH. The bundle mounts `pdf_page_evidence`. Set the plugin row's `config.workspaceRoot` to the local directory whose PDFs it may read; the default is the host process working directory. An operator patch uses:

```yaml
- id: page-evidence
  config:
    workspaceRoot: /absolute/path/to/documents
```

Use the configuration editing mechanism supported by your DSH version. This local-host adapter opens files with Node; SSH/container filesystem providers and DSH filesystem-policy integration are outside the current alpha.

Example tool arguments:

```json
{"path":"report.pdf","pages":[2,3],"ocr":true,"language":"eng+chi_sim","query":"cash flow"}
```

Returned fields include:

- File SHA-256 and inspected/uninspected page counts.
- Per-page text, extraction method, native-text character count, OCR confidence, review and truncation flags.
- Exact quote offsets with a physical page number and source hash.
- Warnings for low text coverage, capped text, and pages outside the inspected window.

Literal search requires every query term on the same page. Han-character matching tolerates OCR-inserted spaces and preserves offsets into the original extracted text. This is a bounded evidence reader; semantic retrieval and answer generation are separate consumers.

## Integration API

```js
import { inspectPdf } from 'dsh-page-evidence/core';
import { chunkPages } from 'dsh-page-evidence/chunker';
const report = await inspectPdf(pdfBytes, { ocr: true, pages: [1, 2] }, signal);
const chunks = chunkPages(report.pages, 1200);
```

Every chunk stays inside one physical page. Other RAG/indexing plugins can consume these records. No automatic replacement of another plugin's parser or stored index is performed.

## Limits

- Maximum 32 MiB input, 20 inspected pages per request, 12 megapixels per OCR rendering, and a 120-second default deadline. Each page returns up to 8,000 UTF-16 units by default, with explicit truncation.
- A page with fewer than 30 non-whitespace native-text characters is flagged. This heuristic can flag valid short pages and blank pages. Image regions inside text-rich pages require separate detection.
- OCR confidence is an engine score. Source hashes establish file identity. Neither measure proves transcription or semantic correctness.
- Physical page numbers may differ from printed document labels. Tables, equations, handwriting, multi-column ordering, encrypted PDFs, and damaged files need further evaluation.
- Text returned through DSH can reach the model provider configured by the user. Treat document content as untrusted evidence.
- Parsing/OCR uses an isolated worker. Cancellation and deadlines terminate and await that worker. Concurrent requests each own a worker; operators should bound tool concurrency.
- The current implementation is CPU based; no GPU or cloud model is needed. Optional OCR dependencies must be installed to use `ocr: true`.

## Verification

```sh
npm test
npm run test:ocr
npm run test:host
node scripts/compare-upstream.mjs /path/to/reviewed/dsh-docintel
```

The upstream comparison executes the specified checkout; review it and install its dependencies first. See [validation](docs/validation.md) for measured results and remaining gaps.

MIT. See [third-party dependencies](THIRD_PARTY_NOTICES.md).

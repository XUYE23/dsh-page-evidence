# Validation record

Date: 2026-10-03. Local environment: Windows, Node 24.18.0. DSH runtime packages: `@deepseek-ai/dsh-tools@0.2.0-rc.2`, `@deepseek-ai/dsh-system-prompt@0.2.0-rc.2`, `@deepseek-ai/cordis@4.0.4`. The package lock records resolved dependencies.

## Minimal reproduction

The comparison script imports the actual reviewed DocIntel parser, chunker and store at `7574023d0c3aeea246a665c31e7c4571f2056ab1`. Input: `test/fixtures/mixed-pages.pdf`, a synthetic three-page PDF.

| Check | DocIntel at pinned commit | Page Evidence with OCR |
| --- | --- | --- |
| Pages contributing extracted text | 1, 3 | 1, 2, 3 |
| Page-2 scan keyword `NEBULA` | No hit | Page 2 |
| Page-3 keyword `Hangzhou` | Reported page 1 | Reported page 3 |
| OCR work | Unavailable | Page 2 only |

With OCR disabled, Page Evidence explicitly flags page 2 as low text coverage. The demo toggle shows both states. This table describes one regression fixture.

## Automated checks

All 13 local tests passed after the final code changes: 10 core tests, 2 real OCR tests, and 1 published-host-runtime test. The browser demo toggle was also checked: without OCR it shows 2/3 pages and one review warning; with OCR it shows 3/3 pages and both expected keyword citations.

- Core: mixed-page warning, exact quote offsets, page selection, truncation, invalid requests, deadline/cancellation cleanup, page-contained chunks, Chinese keyword constraints, and path/symlink containment.
- OCR: actual Tesseract CPU recognition of the English scan; actual packaged Simplified Chinese recognition and whitespace-tolerant keyword retrieval.
- Host: mount the plugin in published Cordis/SystemPrompt/ToolRuntime, dispatch a PDF read, reject an outside-root read, dispose the plugin and confirm tool removal.

Commands:

```sh
npm test
npm run test:ocr
npm run test:host
npm run demo
node scripts/compare-upstream.mjs ../.research/dsh-docintel
```

## Remaining acceptance work

- Full `dsh plugin add` → Web startup → model tool selection → uninstall workflow.
- The [CI workflow](https://github.com/XUYE23/dsh-page-evidence/actions/workflows/test.yml) runs the suite on Linux and Windows; consult its run results for the release's cross-platform status. macOS validation remains pending.
- Real-user documents and a larger annotated corpus. OCR error rates, retrieval recall, and percentile latency have not been measured.
- Sandboxed/remote DSH filesystem integration. The alpha reads a configured local root.
- Automatic integration with DocIntel's existing index and UI. The current extraction API is independently consumable.

No real model API was called and no private résumé data was used in the fixtures.

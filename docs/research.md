# DSH opportunity assessment — 2026-10-03

## Evidence levels

Community reports establish that a workflow caused difficulty for a particular reporter. Local reproductions establish behavior of pinned code on controlled inputs. Neither demonstrates market size, repeated use, or future GitHub stars. No users or maintainers were contacted during this investigation.

## Candidate comparison

| Workflow | Primary evidence | Existing coverage | Decision |
| --- | --- | --- | --- |
| Long-context repetition | [Discussion 7043](https://github.com/deepseek-ai/deepseek-harness/discussions/7043) describes repeated short output in a long session | The reply describes `thinking-loop-guard@0.1.8`; [official repeat-tool-reminder](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/guard/repeat-tool-reminder) covers repeated tools; [community repetition guard](https://github.com/meliodascz89/deepseek-harness-plugins) adds streaming intervention | Demand exists; further work needs a demonstrated failure of the current guards |
| Tool schema/context overhead | [Discussion 5278](https://github.com/deepseek-ai/deepseek-harness/discussions/5278) reports large recurring tool definitions | [Context Doctor](https://github.com/Zhenyu98/dsh-context-doctor) audits injected context; [MCP Lens](https://github.com/labmimors/dsh-mcp-lens) provides lazy tool search/call | Existing substantial implementations; logical schema volume must be separated from billed cache misses |
| Unreadable sessions | [Discussion 5343](https://github.com/deepseek-ai/deepseek-harness/discussions/5343) reports session loading failure after removing a plugin | [Session Port](https://github.com/seth-hg/dsh-session-port), [corrupt-session repair](https://github.com/MedicineKing/dsh-corrupt-session-repair), and evolving official persistence code address different recovery cases | Need exact format/version reproduction before proposing another repair plugin |
| PDF understanding | [Discussion 6049](https://github.com/deepseek-ai/deepseek-harness/discussions/6049) describes a scanned PDF workflow requiring a local OCR workaround | [PDF Reader](https://github.com/vaxilicaihouxian/dsh-pdf-reader) documents OCR as pending; [DocIntel](https://github.com/LL-cmyk-so/dsh-docintel) documents scanned-PDF support as pending | Relevant to NLP/CV; inspect the actual retrieval and citation path |

## Document-specific alternatives

- [File Upload & OCR](https://github.com/BYYY-eng/deepseek-harness-file-upload-ocr-plugin) already handles local OCR and broad attachment formats. A generic upload/OCR button offers limited differentiation.
- [Open File](https://github.com/hyper-dsh-plugins/dsh-open-file) already returns hashes, locators, cursors and stable references, alongside OCR and rendering. It deserves explicit credit; source traceability is established functionality in the ecosystem.
- [DocIntel](https://github.com/LL-cmyk-so/dsh-docintel) supplies a useful local SQLite knowledge base with Chinese lexical retrieval. Its parser and chunker provide a concrete, small place to test extraction coverage and page attribution.

## Locally reproduced gap

Pinned DocIntel commit: `7574023d0c3aeea246a665c31e7c4571f2056ab1` (package `0.3.0`). The repository was fetched on 2026-10-03. The fixture contains native text on pages 1 and 3, and an image with readable text on page 2.

1. `lib/parser.js` compares total characters against `numPages * 30`. The native text on two pages passes that test; scan page 2 yields no paragraph and no coverage warning.
2. `lib/chunker.js` groups paragraphs across page boundaries and records the first paragraph's page. With its default 2,000-character budget, page-3 evidence enters a chunk labelled page 1.
3. Querying `Hangzhou` returns page 1. The known source page is 3. Querying `NEBULA` returns no hit because its source is the scan on page 2.

This controlled reproduction supports two implementation requirements: page-level coverage reporting and page-contained evidence chunks. CPU OCR addresses the observed scan-page omission. The two discovered defects have not been reported by a separate real user in the sources reviewed; they were found during this investigation.

## Product hypothesis

DSH users working with reports and research materials may value a reader that makes missing content visible and preserves page attribution through indexing. The initial adapter is a bounded local tool plus a reusable extraction API. Integration into a knowledge-base plugin can reuse those records, with explicit acceptance checks for citation fidelity and incomplete reads.

To establish adoption value, evaluate consenting users' mixed PDFs, record tasks they could not complete with their existing setup, and measure whether they use the plugin again. Relevant technical measures are missed-page detection, false alarms on short/blank pages, query evidence recall, physical-page citation accuracy, OCR error rate, CPU latency and memory. Stratify by text-only, scan-only, mixed, Chinese, tables and multi-column layouts.

The current synthetic corpus validates plumbing and two regression cases. A publishable accuracy/speed claim needs a larger annotated corpus and a pinned baseline. High star counts remain an uncertain community outcome.

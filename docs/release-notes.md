# Page Evidence v0.1.0-alpha.1

首个公开预览版：为 DeepSeek Harness 提供逐页 PDF 证据、漏读提示、中英文 CPU OCR 与物理页码引用。

## Included

- `pdf_page_evidence` DSH tool, standalone CLI and reusable extraction/chunking API.
- Explicit low-text, uninspected-page and truncation warnings.
- Optional local English / Simplified Chinese OCR, including searches across OCR-inserted Han-character whitespace.
- Page-contained quotes with source SHA-256 and exact extracted-text offsets.
- Two synthetic PDF fixtures, a reproducible comparison against a pinned DocIntel version, and an interactive demo.

## Install

Requires Node 24+ and an existing DSH installation. Download the attached `.tgz`, then run:

```sh
dsh plugin --profile web add ./dsh-page-evidence-0.1.0-alpha.1.tgz
```

Configure the `page-evidence` plugin's `workspaceRoot` and restart DSH. Detailed setup is in the repository README. This package has not been published to the npm registry; the release tarball is the installation artifact.

## Validation and scope

13 local tests passed, including real CPU OCR, source-page citation checks, cancellation and the published DSH `0.2.0-rc.2` tool runtime. An isolated installation of the tarball also read and OCR'd the sample successfully. Linux and Windows CI results are available in [Actions](https://github.com/XUYE23/dsh-page-evidence/actions/workflows/test.yml).

This alpha uses two synthetic documents. Full DSH Web installation, real-user corpus evaluation, macOS, remote filesystem adapters and automatic DocIntel index integration remain pending. Source hashes establish file identity; OCR accuracy and the meaning of a quote still require review.

[Online demo](https://xuye23.github.io/dsh-page-evidence/) · [中文说明](https://github.com/XUYE23/dsh-page-evidence/blob/main/README.zh-CN.md)

`demo.html` is a standalone interactive report. `demo.json` and `comparison.json` contain the reproducible results. `SHA256SUMS.txt` lists the attached files' checksums.

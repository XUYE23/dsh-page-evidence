# Third-party components

Dependencies retain their respective licenses and notices in their npm packages. The lockfile records exact resolved versions.

| Component | Purpose | Declared license |
| --- | --- | --- |
| pdfjs-dist | PDF text extraction/rendering | Apache-2.0 |
| @napi-rs/canvas | CPU raster canvas | MIT |
| tesseract.js / tesseract.js-core | Local OCR runtime | Apache-2.0 |
| @tesseract.js-data/eng, @tesseract.js-data/chi_sim | Packaged language data | MIT (npm packages) |
| @deepseek-ai DSH and Cordis packages | Development/runtime compatibility tests | MIT |

The comparison script loads a separately reviewed [dsh-docintel](https://github.com/LL-cmyk-so/dsh-docintel) checkout (MIT). Its code is not distributed in this package. The synthetic fixtures contain original test text and rendered font glyphs. Fixture generation optionally uses ReportLab and Pillow; runtime users do not need Python.

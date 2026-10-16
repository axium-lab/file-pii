# @axium-lab/file-extractor

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](package.json)
[![License: UNLICENSED](https://img.shields.io/badge/License-UNLICENSED-lightgrey.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![Formats](https://img.shields.io/badge/formats-PDF-orange.svg)](#limitations)
[![Types](https://img.shields.io/badge/types-included-3178c6.svg)](src/types.ts)

Extract text and metadata from files, **without native dependencies**: one class, two methods, one error type. It is built on [unpdf](https://github.com/unjs/unpdf) (the serverless build of pdf.js) and runs anywhere Node 22 does.

```bash
npm install @axium-lab/file-extractor
```

```ts
import { FileExtractor } from '@axium-lab/file-extractor';

const extractor = new FileExtractor(base64); // detects the format from the bytes

extractor.kind; // 'pdf'

const { raw, pages } = await extractor.extract_text();
// raw:   'Chapter 1: Introduction This page has a link… Appendix Smaller page size.'
// pages: [{ number: 1, text: 'Chapter 1: Introduction\n…' }, …]

const metadata = await extractor.get_metadata();
// { title: 'Full Metadata Sample', pageCount: 3, encrypted: true, permissions: ['print', 'copy', 'fill_forms'], … }
```

- **Text per page, and as one line.** `pages` keeps page numbers and line breaks for chunking and citing; `raw` is the whole document flattened, ready for an LLM prompt or a search index.
- **Everything the document declares about itself.** Info dictionary, XMP, flags, permissions, bookmarks, attachments, form fields, layers. One open, no rendering.
- **Detection by magic bytes, not by extension.** The caller cannot lie about the file type.
- **One error type.** Every failure is a `FileExtractorError` with a `category` you can switch on.
- **Lightweight.** One runtime dependency (`unpdf`, ~2 MB, zero transitive dependencies). No canvas, no WASM to configure.
- ESM and CommonJS, with TypeScript declarations included.

## Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Extracting text: `extract_text()`](#extracting-text-extract_text)
  - [Reading metadata: `get_metadata()`](#reading-metadata-get_metadata)
  - [Errors](#errors)
- [API reference](#api-reference)
- [Limitations](#limitations)
- [Development](#development)

## Installation

```bash
npm install @axium-lab/file-extractor
# or
pnpm add @axium-lab/file-extractor
# or
bun add @axium-lab/file-extractor
```

Requires Node.js 22 or later. There is nothing to configure.

## Usage

`FileExtractor` takes the file as a **base64 string**. The constructor decodes it, detects the format from its first bytes and fails fast if the input is not base64 or the format is not supported. Nothing is parsed until you call a method.

| Method           | Does                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `extract_text()` | Returns the text of every page, in reading order.                    |
| `get_metadata()` | Returns everything the document declares about itself. No rendering. |

Both are asynchronous and can be called in any order, as many times as you want.

### Extracting text: `extract_text()`

```ts
import { FileExtractor } from '@axium-lab/file-extractor';

const extractor = new FileExtractor(base64);

await extractor.extract_text();
```

```json
{
  "kind": "pdf",
  "raw": "Chapter 1: Introduction This page has a link, a text field and a checkbox. Chapter 2: Rotated page Section 2.1 lives here. Appendix Smaller page size.",
  "pages": [
    {
      "number": 1,
      "text": "Chapter 1: Introduction\nThis page has a link, a text field and a checkbox."
    },
    { "number": 2, "text": "Chapter 2: Rotated page\nSection 2.1 lives here." },
    { "number": 3, "text": "Appendix\nSmaller page size." }
  ]
}
```

| Field            | Meaning                                                                         |
| ---------------- | ------------------------------------------------------------------------------- |
| `kind`           | The detected format, `'pdf'`.                                                   |
| `raw`            | The whole document as a single line: pages and line breaks joined with spaces.  |
| `pages[].number` | 1-based page number.                                                            |
| `pages[].text`   | The page text with line breaks preserved. Empty for pages without a text layer. |

To get a single string that keeps line breaks:

```ts
const text = pages.map((page) => page.text).join('\n\n');
```

### Reading metadata: `get_metadata()`

```ts
await extractor.get_metadata();
```

```json
{
  "kind": "pdf",
  "fileSize": 19352,
  "pageCount": 3,
  "version": "1.3",
  "fingerprint": "6bb5201d728bdd7e2c37529a0f6acaca",
  "title": "Full Metadata Sample",
  "author": "Axium Lab",
  "subject": "Fixture covering every metadata field",
  "keywords": "fixture, metadata, pdf, file-extractor",
  "creator": "make_full_pdf.py",
  "producer": "reportlab + pypdf",
  "language": "es-ES",
  "trapped": "True",
  "createdAt": "2026-10-15T09:41:16.000Z",
  "modifiedAt": "2026-10-15T09:41:16.000Z",
  "custom": { "Department": "Engineering", "InternalId": "AX-0042" },
  "encrypted": true,
  "linearized": false,
  "tagged": false,
  "hasForms": true,
  "isXfa": false,
  "hasSignatures": true,
  "hasJavaScript": true,
  "hasCollection": false,
  "hasOpenAction": true,
  "pageMode": "UseOutlines",
  "pageLayout": "SinglePage",
  "pageLabels": ["i", "ii", "A-1"],
  "namedDestinations": 3,
  "layers": ["Watermark", "Annotations layer", "Hidden drafts"],
  "viewerPreferences": { "DisplayDocTitle": true, "HideToolbar": true },
  "permissions": ["print", "copy", "fill_forms"],
  "attachments": ["data.csv", "notes.txt"],
  "outline": [
    {
      "title": "Chapter 1: Introduction",
      "children": [{ "title": "1.1 Links and forms", "children": [] }]
    },
    { "title": "Appendix", "children": [] }
  ],
  "formFields": [
    { "name": "fullName", "type": "text", "value": "Jane Doe" },
    { "name": "subscribed", "type": "checkbox", "value": "Yes" },
    { "name": "plan", "type": "radiobutton", "value": "pro" },
    { "name": "Signature1", "type": "signature" }
  ],
  "xmp": {
    "dc:title": "Full Metadata Sample",
    "dc:creator": "Axium Lab",
    "xmp:createdate": "2026-10-15T10:00:00Z"
  }
}
```

Optional fields are `undefined` when the file does not carry them. Field by field:

**Document**

| Field                 | Meaning                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `kind`                | The detected format, `'pdf'`.                                                                   |
| `fileSize`            | Size of the decoded file, in bytes.                                                             |
| `pageCount`           | Number of pages.                                                                                |
| `version`             | PDF spec version declared in the header, e.g. `'1.3'`, `'1.7'`.                                 |
| `fingerprint`         | Hash pdf.js derives from the file ID. Stable for the same bytes, so a cheap duplicate detector. |
| `modifiedFingerprint` | Second file ID. Only present when the PDF was saved with incremental updates.                   |

**Info dictionary.** The classic metadata written by the tool that produced the PDF. Any of them can be missing.

| Field                                    | Meaning                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `title`, `author`, `subject`, `keywords` | What they say.                                                                                     |
| `creator`                                | Application that created the original document, e.g. Word, Chromium.                               |
| `producer`                               | Library that wrote the PDF bytes, e.g. Skia/PDF, reportlab.                                        |
| `language`                               | Document language tag, e.g. `'es-ES'`.                                                             |
| `trapped`                                | Prepress flag: `'True'`, `'False'` or `'Unknown'`. Only print shops care.                          |
| `createdAt`, `modifiedAt`                | Creation and last modification dates, parsed to `Date`.                                            |
| `custom`                                 | Any non-standard entries of the Info dictionary: internal ids, departments, classification labels… |

**Flags**

| Field           | Meaning                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `encrypted`     | The file uses encryption. It still opened, so it has **no user password**, but it may restrict usage. See `permissions`. |
| `linearized`    | Optimized for fast web view: pages can be shown before the whole file loads.                                             |
| `tagged`        | Has a structure tree (accessibility tags). Tagged PDFs give better reading order when extracting text.                   |
| `hasForms`      | Contains an AcroForm or XFA form.                                                                                        |
| `isXfa`         | The form is pure XFA (XML forms). pdf.js supports these poorly; text may be incomplete.                                  |
| `hasSignatures` | Contains digital signature fields. They are **not** verified.                                                            |
| `hasJavaScript` | Contains document-level JavaScript. A warning sign for untrusted files.                                                  |
| `hasCollection` | It is a PDF portfolio, a container of other files.                                                                       |
| `hasOpenAction` | An action runs when the file is opened, e.g. jump to a page or run a script.                                             |

**Viewer hints.** How the author wants a viewer to display the file. Harmless, rarely useful for extraction.

| Field               | Meaning                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pageMode`          | Panel shown on open: `'UseNone'`, `'UseOutlines'`, `'UseThumbs'`, `'FullScreen'`, `'UseOC'`, `'UseAttachments'`. |
| `pageLayout`        | `'SinglePage'`, `'OneColumn'`, `'TwoColumnLeft'`…                                                                |
| `pageLabels`        | The printed page numbers, one per page, e.g. `['i', 'ii', '1']`. They differ from the physical page index.       |
| `viewerPreferences` | Raw flags such as `DisplayDocTitle` or `HideToolbar`.                                                            |

**Security**

| Field         | Meaning                                                                                                                                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions` | What the owner allows when the file is encrypted: `print`, `print_high_quality`, `copy`, `copy_for_accessibility`, `modify_contents`, `modify_annotations`, `fill_forms`, `assemble`. Absent means no restrictions. Reported, not enforced. |

**Structure**

| Field               | Meaning                                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `outline`           | Bookmarks tree. Each node has `title` and `children`.                                                                                     |
| `namedDestinations` | How many named jump targets the document defines. Internal links use them.                                                                |
| `layers`            | Optional content group names. Layers a viewer can toggle, e.g. watermarks or draft marks.                                                 |
| `attachments`       | Names of the files embedded in the PDF.                                                                                                   |
| `formFields`        | Form fields with `name`, `type` (`text`, `checkbox`, `radiobutton`, `combobox`, `listbox`, `signature`…) and `value` when it is a string. |

**XMP**

| Field | Meaning                                                                                                                                                                                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `xmp` | The XML metadata packet, keyed by `prefix:name`, e.g. `dc:title`, `xmp:createdate`, `pdf:producer`. Modern tools write both Info and XMP; they usually agree, but XMP wins when they differ. |

### Errors

Every error thrown by the library is a `FileExtractorError` with a `category`:

| Category             | Thrown when                                         |
| -------------------- | --------------------------------------------------- |
| `invalid_input`      | The input is empty or not valid base64.             |
| `unsupported_format` | The bytes are not a supported file type.            |
| `invalid_file`       | The file is corrupt or malformed.                   |
| `password_required`  | The PDF needs a user password to open.              |
| `extraction_failed`  | The underlying library failed for any other reason. |

The first two are thrown by the constructor, the rest by the methods. The original error is kept in `cause`.

```ts
import { FileExtractor, isFileExtractorError } from '@axium-lab/file-extractor';

try {
  const extractor = new FileExtractor(base64);
  await extractor.extract_text();
} catch (error) {
  if (isFileExtractorError(error)) console.error(error.category, error.message);
  // password_required  PDF extraction failed (PasswordException)
}
```

## API reference

### `class FileExtractor`

| Member                      | Returns                                        |
| --------------------------- | ---------------------------------------------- |
| `new FileExtractor(base64)` | Throws `invalid_input` or `unsupported_format` |
| `kind`                      | `FileKind`: `'pdf'`                            |
| `extract_text()`            | `Promise<ExtractedText>`                       |
| `get_metadata()`            | `Promise<FileMetadata>`                        |

### Other exports

| Export                                       | What it is                         |
| -------------------------------------------- | ---------------------------------- |
| `FileExtractorError`, `isFileExtractorError` | The error class and its type guard |

Types: `ExtractedText`, `ExtractedPage`, `FileKind`, `FileMetadata`, `PdfMetadata`, `PdfPermission`, `PdfFormField`, `OutlineItem`, `FileExtractorErrorCategory`.

## Limitations

What file-extractor does **not** do matters as much as what it does:

- **PDF only, for now.** Any other format throws `unsupported_format`. New formats plug into the `kind` detection and the `switch` in `FileExtractor`.
- **No OCR.** A scanned PDF has no text layer, so `extract_text()` returns empty pages.
- **No password support.** A PDF with a user password throws `password_required`. Owner-password-only files open fine.
- **XFA forms.** pdf.js supports pure XFA poorly; text may be incomplete when `isXfa` is `true`.
- **Metadata is reported, not validated.** Signatures are not verified and permissions are not enforced.

## Development

```bash
npm run dev        # runs tests/manual.ts in watch mode
npm run typecheck
npm run build      # dist/esm + dist/cjs via tsup
```

`tests/manual.ts` is a playground, not a test suite: it loads a fixture from `tests/fixtures/`, calls the API and prints the result. `tests/fixtures/full.pdf` exercises every metadata field. `tests/errors.ts` does the same for each error category and runs at the end of `manual.ts`.

## License

UNLICENSED. Private package of Axium Lab.

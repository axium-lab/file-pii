# @axium-lab/file-pii

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![License: UNLICENSED](https://img.shields.io/badge/License-UNLICENSED-lightgrey.svg)](package.json)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)
[![Formats](https://img.shields.io/badge/formats-PDF-orange.svg)](#limitations)
[![PII](https://img.shields.io/badge/PII-euro--pii-purple.svg)](#detecting-personal-data-scan_pii)
[![Types](https://img.shields.io/badge/types-included-3178c6.svg)](src/types.ts)

Extract text and metadata from files, and check them for personal data, **without native dependencies**: one class, three methods, one error type. It is built on [unpdf](https://github.com/unjs/unpdf) (the serverless build of pdf.js) and runs anywhere Node 22 does.

```bash
npm install @axium-lab/file-pii
```

```ts
import { FileExtractor } from '@axium-lab/file-pii';

const extractor = new FileExtractor(input); // Buffer, base64 or data URI; detects the format from the bytes

extractor.kind; // 'pdf'

const { raw } = await extractor.extract_text();
// raw: 'Chapter 1: Introduction This page has a link… Appendix Smaller page size.'

await extractor.extract_text({ pages: [2, 4] });
// { raw: '…', pages: [{ number: 2, text: '…' }, { number: 4, text: '…' }] }, only those pages

const metadata = await extractor.get_metadata();
// { title: 'Full Metadata Sample', pageCount: 3, encrypted: true, permissions: ['print', 'copy', 'fill_forms'], … }

const scan = await extractor.scan_pii({ countries: ['ES', 'GLOBAL'], policy: { kinds: { PAYMENT_CARD: 'block' } } });
// { blocked: true, blocked_by: [{ entity: 'CREDIT_CARD', … }], entities: [{ entity: 'ES_NIF', … }, …], metadata: { kind: 'pdf' } }

await extractor.scan_pii(piiOptions, { pages: true });
// same, plus metadata.pages: [{ number: 1, entities: [...] }, …], one entry per page
```

- **Text as one line, and per page.** `raw` is the default: the document flattened, ready for an LLM prompt or a search index. `pages` is opt-in and keeps page numbers and line breaks for chunking and citing; ask for all of them or only some.
- **Everything the document declares about itself.** Info dictionary, XMP, flags, permissions, bookmarks, attachments, form fields, layers. One open, no rendering.
- **Personal data, page by page.** `scan_pii()` runs [euro-pii](https://www.npmjs.com/package/@axium-lab/euro-pii) over the document and tells you what it found, on which page, and whether your policy refuses the file. The file is never rewritten.
- **Detection by magic bytes, not by extension.** The caller cannot lie about the file type.
- **One error type.** Every failure is a `FileExtractorError` with a `category` you can switch on.
- **Lightweight.** One runtime dependency (`unpdf`, ~2 MB, zero transitive dependencies) and one peer (`@axium-lab/euro-pii`, zero dependencies). No canvas, no WASM to configure.
- ESM and CommonJS, with TypeScript declarations included.

## Contents

- [Installation](#installation)
- [Usage](#usage)
  - [Extracting text: `extract_text()`](#extracting-text-extract_text)
  - [Reading metadata: `get_metadata()`](#reading-metadata-get_metadata)
  - [Detecting personal data: `scan_pii()`](#detecting-personal-data-scan_pii)
  - [Errors](#errors)
- [API reference](#api-reference)
- [Limitations](#limitations)
- [Development](#development)

## Installation

```bash
npm install @axium-lab/file-pii
# or
pnpm add @axium-lab/file-pii
# or
bun add @axium-lab/file-pii
```

Requires Node.js 22 or later. There is nothing to configure.

[`@axium-lab/euro-pii`](https://www.npmjs.com/package/@axium-lab/euro-pii) is a **peer dependency** with no version constraint: npm 7+, pnpm and Bun install it for you, and any published version works.

## Usage

`FileExtractor` takes the file in any of these shapes (`FileInput`):

| Input                                    | Notes                                                              |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `Buffer`, `Uint8Array` or `ArrayBuffer`  | Used as is, no copy.                                               |
| base64 string                            | Standard or base64url alphabet, padding optional, whitespace ignored. |
| data URI (`data:application/pdf;base64,…`) | Must be base64 encoded. The MIME type is ignored: the bytes decide. |

The constructor decodes the input, detects the format from its first bytes and fails fast if the input is empty or malformed, or the format is not supported. Nothing is parsed until you call a method.

| Method           | Does                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| `extract_text()` | Returns the document text; optionally per page or only some pages.   |
| `get_metadata()` | Returns everything the document declares about itself. No rendering. |
| `scan_pii()`     | Finds personal data with euro-pii and applies a keep/block policy.   |

All three are asynchronous and can be called in any order, as many times as you want.

### Extracting text: `extract_text()`

```ts
import { FileExtractor } from '@axium-lab/file-pii';

const extractor = new FileExtractor(base64);

await extractor.extract_text();
```

```json
{
  "kind": "pdf",
  "raw": "Chapter 1: Introduction This page has a link, a text field and a checkbox. Chapter 2: Rotated page Section 2.1 lives here. Appendix Smaller page size."
}
```

By default you get the whole document as one line. The options choose what to extract; only the selected pages are read.

| Option  | Default | Meaning                                                                                           |
| ------- | ------- | ------------------------------------------------------------------------------------------------- |
| `raw`   | `true`  | Include the document (or the selected pages) as a single line.                                    |
| `pages` | `false` | Which pages to return: `false` for none, `true` for all, or a `number[]` of 1-based page numbers. |

```ts
await extractor.extract_text({ pages: [2, 3] });
```

```json
{
  "kind": "pdf",
  "raw": "Chapter 2: Rotated page Section 2.1 lives here. Appendix Smaller page size.",
  "pages": [
    { "number": 2, "text": "Chapter 2: Rotated page\nSection 2.1 lives here." },
    { "number": 3, "text": "Appendix\nSmaller page size." }
  ]
}
```

| Field            | Meaning                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `kind`           | The detected format, `'pdf'`.                                                                                                  |
| `raw`            | The document, or the selected pages, as a single line: pages and line breaks joined with spaces. Absent when `raw` is `false`. |
| `pages[].number` | 1-based page number. Pages come in ascending order. Present only when `pages` is requested.                                    |
| `pages[].text`   | The page text with line breaks preserved. Empty for pages without a text layer.                                                |

A page number outside the document or a duplicate throws `invalid_input`, e.g. `Page 99 is out of range (document has 3 pages)`. So does `{ raw: false, pages: false }`, since there is nothing to extract.

To get a single string that keeps line breaks:

```ts
const { pages = [] } = await extractor.extract_text({
  raw: false,
  pages: true,
});
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

### Detecting personal data: `scan_pii()`

```ts
await extractor.scan_pii(
  {
    countries: ['ES', 'GLOBAL'], // Spanish identifiers plus IBAN, cards, email…
    except: ['DATE_TIME'],       // but not dates
    policy: {
      default: 'keep',           // 'keep' | 'block'
      kinds: { PAYMENT_CARD: 'block' },
    },
  },
  { pages: [1, 3] },             // optional: only these pages, broken down per page
);
```

```json
{
  "blocked": true,
  "blocked_by": [
    { "entity": "CREDIT_CARD", "kind": "PAYMENT_CARD", "country": "GLOBAL", "start": 74, "end": 93, "value": "4111 1111 1111 1111", "score": 1, "confirmedBy": "checksum", "…": "…" }
  ],
  "entities": [
    { "entity": "ES_NIF", "kind": "TAX_ID", "country": "ES", "start": 24, "end": 33, "value": "12345678Z", "…": "…" },
    { "entity": "EMAIL_ADDRESS", "kind": "EMAIL", "country": "GLOBAL", "start": 41, "end": 56, "value": "ana@example.com", "…": "…" },
    { "entity": "CREDIT_CARD", "kind": "PAYMENT_CARD", "country": "GLOBAL", "start": 74, "end": 93, "value": "4111 1111 1111 1111", "…": "…" },
    { "entity": "IBAN_CODE", "kind": "BANK_ACCOUNT", "country": "GLOBAL", "start": 99, "end": 128, "value": "ES91 2100 0418 4502 0005 1332", "…": "…" }
  ],
  "metadata": {
    "kind": "pdf",
    "pages": [
      { "number": 1, "entities": [{ "entity": "ES_NIF", "start": 24, "end": 33, "…": "…" }, { "entity": "EMAIL_ADDRESS", "start": 41, "end": 56, "…": "…" }] },
      { "number": 3, "entities": [{ "entity": "CREDIT_CARD", "start": 17, "end": 36, "…": "…" }, { "entity": "IBAN_CODE", "start": 42, "end": 71, "…": "…" }] }
    ]
  }
}
```

The first argument is a euro-pii options object, passed through as it is: `countries`, `kinds`, `entities` and `except` choose what to look for, exactly as [euro-pii documents them](https://www.npmjs.com/package/@axium-lab/euro-pii#choosing-what-to-look-for). The policy is the same too, with one difference: a file is never rewritten, so there is no `mask`. Each detection is either kept (reported, the file passes) or blocks (the file is refused). The most specific key wins: `entities`, then `kinds`, then `default`, which is `'keep'` when left out. Without a policy, everything is reported and nothing blocks. A `'mask'` that arrives from plain JSON behaves as `'keep'`.

The second argument is the scope, with the same vocabulary as `extract_text`:

| Option  | Default | Meaning                                                                                                                                                                            |
| ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pages` | `false` | `false`: scan the whole document, no per-page breakdown. `true`: scan the whole document and break it down per page. `number[]`: scan only those 1-based pages and break them down. |

The result is what euro-pii's `anonymize()` returns for `extract_text({ pages }).raw`, without the anonymized text, plus `metadata`:

| Field                       | Meaning                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `blocked`                   | `true` if any detection's action is `'block'`.                                                                           |
| `blocked_by`                | The detections that blocked. Present only when `blocked` is `true`, so TypeScript narrows on it.                         |
| `entities`                  | Every detection, in document order. `start` and `end` are offsets into `raw` of the same pages, `end` exclusive.         |
| `metadata.kind`             | The detected format, `'pdf'`.                                                                                            |
| `metadata.pages`            | Present only when `pages` was requested. One entry per scanned page, in ascending order, so the default JSON stays small. |
| `metadata.pages[].number`   | 1-based page number.                                                                                                     |
| `metadata.pages[].entities` | The same detections, with offsets into that page's `text` as `extract_text({ pages: true })` returns it.                 |

Each detection is a euro-pii `Detection`, untouched: `entity`, `kind`, `dataClass`, `identifiability`, `country`, `start`, `end`, `score`, `value`, `pattern`, `confirmedBy`. See [its README](https://www.npmjs.com/package/@axium-lab/euro-pii#detecting-scan) for what each field means.

Pages are read and scanned one at a time, so a document with hundreds of pages costs one page of memory, not the whole text. Each page is scanned as a single line, exactly as `raw` is built, so the result is the same whether you look at `entities` or at `metadata.pages`. A value split across two pages is not detected.

```ts
const scan = await extractor.scan_pii({ countries: ['ES', 'GLOBAL'] }, { pages: true });

if (scan.entities.length === 0) {
  // nothing personal in the file
}

if (scan.blocked) {
  const pages = (scan.metadata.pages ?? []).filter((p) => p.entities.length > 0).map((p) => p.number);
  throw new Error(`Refused: ${scan.blocked_by.map((d) => d.entity).join(', ')} on pages ${pages.join(', ')}`);
}
```

### Errors

Every error thrown by the library is a `FileExtractorError` with a `category`:

| Category             | Thrown when                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `invalid_input`      | The input is empty, not a `FileInput`, invalid base64 or a non-base64 data URI; the `extract_text` options select nothing or a page that does not exist; or the `scan_pii` options are rejected by euro-pii (unknown entity, empty selection, an entity both blocked and excepted). |
| `unsupported_format` | The bytes are not a supported file type.                                                                   |
| `invalid_file`       | The file is corrupt or malformed.                                                                          |
| `password_required`  | The PDF needs a user password to open.                                                                     |
| `extraction_failed`  | The underlying library failed for any other reason.                                                        |

`unsupported_format` is thrown by the constructor, `invalid_input` by the constructor and by the methods, the rest by the methods. The original error is kept in `cause`; for `scan_pii` option errors that is the `EuroPiiError`.

```ts
import { FileExtractor, isFileExtractorError } from '@axium-lab/file-pii';

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
| `new FileExtractor(input)`  | `input: FileInput`. Throws `invalid_input` or `unsupported_format` |
| `kind`                      | `FileKind`: `'pdf'`                            |
| `extract_text(options?)`    | `Promise<ExtractedText>`                       |
| `get_metadata()`            | `Promise<FileMetadata>`                        |
| `scan_pii(options?, scope?)` | `options: ScanPiiOptions`, `scope: ScanPiiScope`. `Promise<PiiScan>` |

### Other exports

| Export                                       | What it is                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| `FileExtractorError`, `isFileExtractorError` | The error class and its type guard                                            |
| `FILE_KINDS`, `SUPPORTED_MIME_TYPES`         | `['pdf']` and `['application/pdf']`, to skip other files before decoding them |

Types: `FileInput`, `ExtractTextOptions`, `ExtractedText`, `ExtractedPage`, `FileKind`, `FileMetadata`, `PdfMetadata`, `PdfPermission`, `PdfFormField`, `OutlineItem`, `ScanPiiOptions`, `ScanPiiScope`, `FilePolicy`, `FileAction`, `PiiScan`, `PiiPage`, `FileExtractorErrorCategory`.

```ts
type FileAction = 'keep' | 'block';

type ScanPiiOptions = Selection & {       // Selection is euro-pii's: countries, kinds, entities, except
  policy?: {
    default?: FileAction;
    kinds?: Partial<Record<Kind, FileAction>>;
    entities?: Partial<Record<EntityName, FileAction>>;
  };
};

type ScanPiiScope = { pages?: boolean | number[] };

type PiiScan = (
  | { blocked: false; entities: Detection[] }
  | { blocked: true; blocked_by: Detection[]; entities: Detection[] }
) & {
  metadata: { kind: FileKind; pages?: { number: number; entities: Detection[] }[] };
};
```

## Limitations

What file-pii does **not** do matters as much as what it does:

- **PDF only, for now.** Any other format throws `unsupported_format`. New formats plug into the `kind` detection and the `switch` in `FileExtractor`.
- **No OCR.** A scanned PDF has no text layer, so `extract_text()` returns empty text and `scan_pii()` finds nothing.
- **PII detection is euro-pii's.** Regular expressions, checksums and context words, no machine learning: names and free-form addresses are not detected. Whatever the selection leaves out stays unreported. See [its limitations](https://www.npmjs.com/package/@axium-lab/euro-pii#limitations).
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

`tests/inputs.ts` and `tests/pii.ts` are assertion scripts: run them with `bun tests/inputs.ts` or `npx tsx tests/pii.ts`. `tests/fixtures/pii.pdf` has a NIF and an email on page 1, nothing on page 2, and a card and an IBAN on page 3.

## License

UNLICENSED. Private package of Axium Lab.

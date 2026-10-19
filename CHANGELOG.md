# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-10-19

The package is now `@axium-lab/file-pii`. The API is unchanged.

### Changed

- Renamed the package from `@axium-lab/file-extractor` to `@axium-lab/file-pii`
  to reflect what it is for: detecting personal data in files. Update your
  install command and imports; `FileExtractor` and the rest of the API keep
  their names.
- New package description, leading with PII detection and the keep/block
  policy.

### Added

- `LICENSE` and `CHANGELOG.md` are now shipped in the published package.

### Removed

- `package-lock.json` is no longer tracked; `bun.lock` is the lockfile.

## [0.1.0] - 2026-10-19

Initial release. PDF is the only supported format; more formats will follow.

### Added

#### Core

- `FileExtractor` class: one entry point that detects the file format from its
  magic bytes, never from the extension or a caller-supplied MIME type.
- Accepts the file as `Buffer`, `Uint8Array`, `ArrayBuffer`, a base64 string
  (standard or base64url alphabet, padding optional, whitespace ignored) or a
  `data:` URI (`FileInput`).
- `kind` property exposing the detected format (`'pdf'`).
- `FILE_KINDS` and `SUPPORTED_MIME_TYPES` constants to filter files before
  decoding them.
- Dual ESM and CommonJS build via tsup, with TypeScript declarations included.
  Requires Node.js 22 or later.

#### Text extraction (`extract_text()`)

- `raw` output (default): the whole document flattened into a single string,
  ready for an LLM prompt or a search index.
- `pages` output (opt-in): one entry per page with its number and text, keeping
  line breaks for chunking and citing. Accepts `true` for every page or an array
  of page numbers to extract only some of them.

#### Metadata (`get_metadata()`)

- `PdfMetadata` with everything the document declares about itself in a single
  open, without rendering: info dictionary (title, author, subject, keywords,
  creator, producer, dates, trapped, custom entries), XMP, PDF version,
  fingerprints, language, page count, page labels, page mode and layout.
- Document flags: `encrypted`, `linearized`, `tagged`, `hasForms`, `isXfa`,
  `hasSignatures`, `hasJavaScript`, `hasCollection`, `hasOpenAction`.
- Structure: outline (bookmarks), attachments, form fields, optional content
  layers, named destinations count, viewer preferences and permissions
  (`PdfPermission`).

#### Personal data detection (`scan_pii()`)

- Runs [`@axium-lab/euro-pii`](https://www.npmjs.com/package/@axium-lab/euro-pii)
  over the extracted text and returns the detected entities.
- `ScanPiiOptions` extends euro-pii's selection (`countries`, `kinds`,
  `entities`, `except`) with a `policy` that marks each kind or entity as
  `'keep'` or `'block'`. The result reports `blocked` and, when blocked, the
  `blocked_by` detections. The file is never rewritten.
- `ScanPiiScope` with `pages: true | number[]` to get a per-page breakdown in
  `metadata.pages`, one entry per page with its detections.
- `@axium-lab/euro-pii` is declared as a peer dependency with no version
  constraint.

#### Errors

- Single `FileExtractorError` class with a `category` to switch on:
  `invalid_input`, `unsupported_format`, `invalid_file`, `password_required`,
  `extraction_failed`.
- `isFileExtractorError` type guard.

#### Documentation and tooling

- README with installation, usage, API reference, limitations and development
  notes.
- Manual test scripts under `tests/` covering inputs, errors, text extraction
  and PII scanning, with a PII fixture PDF.
- `.gitignore` tracks `bun.lock` and ignores `.atl`.

### Removed

- `PdfPageInfo` type and the `pages` field of `PdfMetadata`, superseded by the
  `pages` option of `extract_text()`.

[Unreleased]: https://dev.azure.com/axium-lab/pocs/_git/file-pii
[0.2.0]: https://dev.azure.com/axium-lab/pocs/_git/file-pii
[0.1.0]: https://dev.azure.com/axium-lab/pocs/_git/file-pii

import { FileExtractorError } from './errors/errors';
import { extractPdfText, getPdfMetadata, isPdf, readPdfPages } from './formats/pdf';
import { scanPii } from './pii/scan';
import type {
  ExtractedText,
  ExtractTextOptions,
  FileInput,
  FileKind,
  FileMetadata,
  PiiScan,
  ScanPiiOptions,
  ScanPiiScope,
} from './types';

// Standard and url-safe alphabets, with optional padding.
const BASE64_PATTERN = /^[A-Za-z0-9+/\-_]+={0,2}$/;
const DATA_URI_PREFIX = /^data:/i;

export class FileExtractor {
  readonly #bytes: Uint8Array;
  readonly kind: FileKind;

  constructor(input: FileInput) {
    this.#bytes = toBytes(input);
    this.kind = detectKind(this.#bytes);
  }

  extract_text(options: ExtractTextOptions = {}): Promise<ExtractedText> {
    switch (this.kind) {
      case 'pdf':
        return extractPdfText(this.#bytes, options);
    }
  }

  get_metadata(): Promise<FileMetadata> {
    switch (this.kind) {
      case 'pdf':
        return getPdfMetadata(this.#bytes);
    }
  }

  /**
   * Detects personal data with euro-pii (a peer dependency) and applies a
   * keep/block policy. The file is never rewritten.
   */
  scan_pii(options: ScanPiiOptions = {}, scope: ScanPiiScope = {}): Promise<PiiScan> {
    switch (this.kind) {
      case 'pdf':
        return scanPii(this.kind, options, Boolean(scope.pages), (visit) =>
          readPdfPages(this.#bytes, Array.isArray(scope.pages) ? scope.pages : undefined, visit),
        );
    }
  }
}

function toBytes(input: unknown): Uint8Array {
  let bytes: Uint8Array;

  if (typeof input === 'string') {
    bytes = DATA_URI_PREFIX.test(input)
      ? decodeDataUri(input)
      : decodeBase64(input);
  } else if (input instanceof Uint8Array) {
    // Covers Buffer too. Reuse the memory, but only the slice this view covers:
    // small Buffers come from a shared pool and `.buffer` is far larger than the file.
    bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    throw new FileExtractorError({
      category: 'invalid_input',
      message:
        'Expected a base64 string, a data URI, a Buffer, a Uint8Array or an ArrayBuffer',
    });
  }

  if (bytes.byteLength === 0) {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Input is empty',
    });
  }

  return bytes;
}

// `data:[<mediatype>][;base64],<data>`. Only base64 payloads make sense for binary files.
function decodeDataUri(input: string): Uint8Array {
  const comma = input.indexOf(',');

  if (comma === -1) {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Data URI has no payload',
    });
  }

  const header = input.slice(0, comma);
  const payload = input.slice(comma + 1);

  if (!/;base64$/i.test(header)) {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Data URI must be base64 encoded',
    });
  }

  return decodeBase64(payload);
}

function decodeBase64(input: string): Uint8Array {
  const normalized = input.replace(/\s+/g, '');

  if (normalized.length === 0 || !BASE64_PATTERN.test(normalized)) {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Input is not valid base64',
    });
  }

  // Node accepts both alphabets with 'base64', so base64url needs no translation.
  return new Uint8Array(Buffer.from(normalized, 'base64'));
}

function detectKind(bytes: Uint8Array): FileKind {
  if (isPdf(bytes)) return 'pdf';

  throw new FileExtractorError({
    category: 'unsupported_format',
    message: 'Unsupported file type. Only PDF is supported',
  });
}

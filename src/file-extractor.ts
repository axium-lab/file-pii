import { FileExtractorError } from './errors/errors';
import { extractPdfText, getPdfMetadata, isPdf } from './formats/pdf';
import type { ExtractedText, FileKind, FileMetadata } from './types';

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export class FileExtractor {
  readonly #bytes: Uint8Array;
  readonly kind: FileKind;

  constructor(base64: string) {
    this.#bytes = decodeBase64(base64);
    this.kind = detectKind(this.#bytes);
  }

  extract_text(): Promise<ExtractedText> {
    switch (this.kind) {
      case 'pdf':
        return extractPdfText(this.#bytes);
    }
  }

  get_metadata(): Promise<FileMetadata> {
    switch (this.kind) {
      case 'pdf':
        return getPdfMetadata(this.#bytes);
    }
  }
}

function decodeBase64(input: unknown): Uint8Array {
  if (typeof input !== 'string') {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Expected a base64 string',
    });
  }

  const normalized = input.replace(/\s+/g, '');

  if (normalized.length === 0 || !BASE64_PATTERN.test(normalized)) {
    throw new FileExtractorError({
      category: 'invalid_input',
      message: 'Input is not valid base64',
    });
  }

  return new Uint8Array(Buffer.from(normalized, 'base64'));
}

function detectKind(bytes: Uint8Array): FileKind {
  if (isPdf(bytes)) return 'pdf';

  throw new FileExtractorError({
    category: 'unsupported_format',
    message: 'Unsupported file type. Only PDF is supported',
  });
}

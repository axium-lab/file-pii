export type FileExtractorErrorCategory =
  | 'invalid_input'
  | 'unsupported_format'
  | 'invalid_file'
  | 'password_required'
  | 'extraction_failed';

export class FileExtractorError extends Error {
  readonly category: FileExtractorErrorCategory;

  constructor(params: {
    category: FileExtractorErrorCategory;
    message: string;
    cause?: unknown;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'FileExtractorError';
    this.category = params.category;
  }
}

export function isFileExtractorError(value: unknown): value is FileExtractorError {
  return value instanceof FileExtractorError;
}

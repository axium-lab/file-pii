import type {
  Detection,
  EntityName,
  Kind,
  Selection,
} from '@axium-lab/euro-pii';

export const FILE_KINDS = ['pdf'] as const;

export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Accepted file inputs:
 * - raw bytes: `Buffer`, `Uint8Array` or `ArrayBuffer`
 * - a base64 string (standard or base64url, whitespace allowed)
 * - a data URI: `data:application/pdf;base64,....`
 *
 * The format is always detected from the bytes, never from the data URI's MIME type.
 */
export type FileInput = string | Uint8Array | ArrayBuffer;

/** MIME types of the supported formats, so callers can skip other files without decoding them. */
export const SUPPORTED_MIME_TYPES = ['application/pdf'] as const;

export type ExtractedPage = {
  number: number;
  text: string;
};

export type ExtractTextOptions = {
  /** Include the whole document (or the selected pages) as a single line. Default: true. */
  raw?: boolean;
  /** Which pages to return: false = none (default), true = all, number[] = only those pages, 1-based. */
  pages?: boolean | number[];
};

export type ExtractedText = {
  kind: FileKind;
  /**
   * The document (or the selected pages) as a single line, pages and line breaks joined with spaces.
   * Present unless `raw: false` was passed.
   */
  raw?: string;
  /** Pages in ascending order, with line breaks preserved. Present only when `pages` was requested. */
  pages?: ExtractedPage[];
};

export type OutlineItem = {
  title: string;
  children: OutlineItem[];
};

export type PdfPermission =
  | 'print'
  | 'print_high_quality'
  | 'modify_contents'
  | 'modify_annotations'
  | 'fill_forms'
  | 'copy'
  | 'copy_for_accessibility'
  | 'assemble';

export type PdfFormField = {
  name: string;
  type: string;
  value?: string;
};

export type PdfMetadata = {
  kind: 'pdf';
  fileSize: number;
  pageCount: number;
  version?: string;
  fingerprint?: string;
  /** Fingerprint of the last incremental update, when the file has been modified. */
  modifiedFingerprint?: string;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  language?: string;
  trapped?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  /** Non-standard entries of the Info dictionary. */
  custom?: Record<string, string | number | boolean>;
  encrypted: boolean;
  linearized: boolean;
  tagged: boolean;
  hasForms: boolean;
  isXfa: boolean;
  hasSignatures: boolean;
  hasJavaScript: boolean;
  hasCollection: boolean;
  hasOpenAction: boolean;
  pageMode?: string;
  pageLayout?: string;
  pageLabels?: string[];
  namedDestinations: number;
  /** Optional content group (layer) names. */
  layers: string[];
  viewerPreferences?: Record<string, unknown>;
  /** Only present when the PDF restricts usage; absent means everything is allowed. */
  permissions?: PdfPermission[];
  attachments: string[];
  outline: OutlineItem[];
  formFields: PdfFormField[];
  xmp?: Record<string, string>;
};

export type FileMetadata = PdfMetadata;

/**
 * What `scan_pii()` does with a detection. Files are never rewritten, so there
 * is no `mask`: the text either passes as it is or the whole file is refused.
 */
export type FileAction = 'keep' | 'block';

/**
 * Same resolution as euro-pii: the most specific key wins (`entities`, then
 * `kinds`, then `default`). `default` is `'keep'` when left out, so without a
 * policy nothing blocks and everything found is reported.
 */
export type FilePolicy = {
  default?: FileAction;
  kinds?: Partial<Record<Kind, FileAction>>;
  entities?: Partial<Record<EntityName, FileAction>>;
};

/** euro-pii's selection (countries, kinds, entities, except) plus a keep/block policy. */
export type ScanPiiOptions = Selection & {
  policy?: FilePolicy;
};

export type ScanPiiScope = {
  /**
   * Same vocabulary as `extract_text`: false = scan everything, no per-page
   * breakdown (default); true = scan everything and break it down per page;
   * number[] = scan only those pages, 1-based, and break them down.
   */
  pages?: boolean | number[];
};

export type PiiPage = {
  number: number;
  /** Offsets relative to this page's text, as `extract_text({ pages })` returns it. */
  entities: Detection[];
};

/**
 * What euro-pii would return for `extract_text({ pages }).raw`, minus the
 * anonymized text, plus `metadata` with the same detections seen per page.
 * Top-level offsets refer to that single-line document; `metadata.pages[]`
 * offsets refer to each page.
 */
export type PiiScan = (
  | { blocked: false; entities: Detection[] }
  | { blocked: true; blocked_by: Detection[]; entities: Detection[] }
) & {
  metadata: {
    kind: FileKind;
    /** The scanned pages, in ascending order. Present only when `pages` was requested. */
    pages?: PiiPage[];
  };
};

export type FileKind = 'pdf';

export type ExtractedPage = {
  number: number;
  text: string;
};

export type ExtractedText = {
  kind: FileKind;
  /** Whole document as a single line, pages and line breaks joined with spaces. */
  raw: string;
  pages: ExtractedPage[];
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

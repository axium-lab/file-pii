// https://www.npmjs.com/package/unpdf
import { extractText, getDocumentProxy, getResolvedPDFJS } from 'unpdf';
import {
  FileExtractorError,
  type FileExtractorErrorCategory,
} from '../errors/errors';
import type {
  ExtractedText,
  OutlineItem,
  PdfFormField,
  PdfMetadata,
  PdfPageInfo,
  PdfPermission,
} from '../types';

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/** The PDF spec allows the header anywhere within the first 1024 bytes. */
export function isPdf(bytes: Uint8Array): boolean {
  return new TextDecoder('latin1')
    .decode(bytes.subarray(0, 1024))
    .includes('%PDF-');
}

// Extract text from a PDF file.
export function extractPdfText(bytes: Uint8Array): Promise<ExtractedText> {
  return withPdfErrors(async () => {
    const { text } = await extractText(bytes.slice(), { mergePages: false });
    return {
      kind: 'pdf',
      raw: text.join(' ').replace(/\n/g, ' '),
      pages: text.map((text, i) => ({ number: i + 1, text })),
    };
  });
}

// Extract everything pdfjs knows about the document, opening it only once.
export function getPdfMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  return withPdfErrors(async () => {
    const pdf = await getDocumentProxy(bytes.slice(), { verbosity: 0 });

    try {
      const [
        { PDFDateString },
        { info: rawInfo, metadata },
        permissions,
        jsActions,
        outline,
        attachments,
        pageMode,
        pageLayout,
        pageLabels,
        markInfo,
        destinations,
        fieldObjects,
        viewerPreferences,
        openAction,
        optionalContent,
        pages,
      ] = await Promise.all([
        getResolvedPDFJS(),
        pdf.getMetadata(),
        pdf.getPermissions(),
        pdf.getJSActions(),
        pdf.getOutline(),
        pdf.getAttachments(),
        pdf.getPageMode(),
        pdf.getPageLayout(),
        pdf.getPageLabels(),
        pdf.getMarkInfo(),
        pdf.getDestinations(),
        pdf.getFieldObjects(),
        pdf.getViewerPreferences(),
        pdf.getOpenAction(),
        pdf.getOptionalContentConfig(),
        readPages(pdf),
      ]);

      // pdfjs types the Info dictionary as a bare Object.
      const info = rawInfo as Record<string, unknown>;

      return {
        kind: 'pdf',
        fileSize: bytes.byteLength,
        pageCount: pdf.numPages,
        pages,
        version: asString(info.PDFFormatVersion),
        fingerprint: pdf.fingerprints[0] ?? undefined,
        modifiedFingerprint: pdf.fingerprints[1] ?? undefined,
        title: asString(info.Title),
        author: asString(info.Author),
        subject: asString(info.Subject),
        keywords: asString(info.Keywords),
        creator: asString(info.Creator),
        producer: asString(info.Producer),
        language: asString(info.Language),
        trapped: asName(info.Trapped),
        createdAt: asDate(info.CreationDate, PDFDateString),
        modifiedAt: asDate(info.ModDate, PDFDateString),
        custom: toCustom(info.Custom),
        encrypted: info.EncryptFilterName != null,
        linearized: info.IsLinearized === true,
        tagged: markInfo?.Marked === true,
        hasForms: info.IsAcroFormPresent === true || info.IsXFAPresent === true,
        isXfa: pdf.isPureXfa,
        hasSignatures: info.IsSignaturesPresent === true,
        hasJavaScript: jsActions != null,
        hasCollection: info.IsCollectionPresent === true,
        hasOpenAction: openAction != null,
        pageMode: asString(pageMode),
        pageLayout: asString(pageLayout),
        pageLabels: pageLabels ?? undefined,
        namedDestinations: Object.keys(destinations).length,
        layers: toLayers(optionalContent),
        viewerPreferences:
          (viewerPreferences as Record<string, unknown> | null) ?? undefined,
        permissions: permissions ? toPermissions(permissions) : undefined,
        attachments: attachments ? [...attachments.keys()] : [],
        outline: toOutline(outline),
        formFields: toFormFields(fieldObjects),
        xmp: toXmp(metadata),
      };
    } finally {
      await pdf.loadingTask.destroy();
    }
  });
}

async function readPages(pdf: PdfDocument): Promise<PdfPageInfo[]> {
  const numbers = Array.from({ length: pdf.numPages }, (_, i) => i + 1);

  return Promise.all(
    numbers.map(async (number) => {
      const page = await pdf.getPage(number);
      const { width, height } = page.getViewport({ scale: 1 });
      const annotations = await page.getAnnotations();
      return {
        number,
        width,
        height,
        rotation: page.rotate,
        annotations: annotations.length,
      };
    }),
  );
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** pdfjs returns PDF name objects as `{ name: string }`. */
function asName(value: unknown): string | undefined {
  return typeof value === 'object' && value !== null && 'name' in value
    ? asString(value.name)
    : undefined;
}

type DateParser = { toDateObject(input: unknown): Date | null };

/** Info dates use the PDF date format ('D:YYYYMMDDHHmmSS...'), which pdfjs knows how to parse. */
function asDate(value: unknown, parser: DateParser): Date | undefined {
  return typeof value === 'string'
    ? (parser.toDateObject(value) ?? undefined)
    : undefined;
}

/** pdfjs only keeps strings, numbers, booleans and names here; names become their string. */
function toCustom(value: unknown): PdfMetadata['custom'] {
  if (typeof value !== 'object' || value === null) return undefined;

  const entries = Object.entries(value).map(([key, raw]) => [key, asName(raw) ?? raw]);

  return entries.length > 0 ? (Object.fromEntries(entries) as PdfMetadata['custom']) : undefined;
}

// pdfjs PermissionFlag bit values.
const PERMISSION_BY_FLAG: Record<number, PdfPermission> = {
  4: 'print',
  8: 'modify_contents',
  16: 'copy',
  32: 'modify_annotations',
  256: 'fill_forms',
  512: 'copy_for_accessibility',
  1024: 'assemble',
  2048: 'print_high_quality',
};

function toPermissions(flags: number[]): PdfPermission[] {
  return flags.flatMap((flag) => PERMISSION_BY_FLAG[flag] ?? []);
}

type RawOutline = { title: string; items: RawOutline[] } | null;

function toOutline(items: RawOutline[] | null): OutlineItem[] {
  return (items ?? []).flatMap((item) =>
    item ? [{ title: item.title, children: toOutline(item.items) }] : [],
  );
}

type RawOptionalContent = {
  getOrder(): unknown[] | null;
  getGroup(id: string): { name?: string } | null;
} | null;

function toLayers(config: RawOptionalContent): string[] {
  if (!config) return [];
  return (config.getOrder() ?? []).flatMap((id) => {
    const name = typeof id === 'string' ? config.getGroup(id)?.name : undefined;
    return name ? [name] : [];
  });
}

type RawFieldObjects = Record<
  string,
  Array<{ type?: string; value?: unknown }>
> | null;

function toFormFields(fields: RawFieldObjects): PdfFormField[] {
  if (!fields) return [];

  const seen = new Set<string>();

  return Object.entries(fields).flatMap(([name, objects]) =>
    objects.flatMap((field) => {
      if (!field.type) return [];
      const value = typeof field.value === 'string' ? field.value : undefined;
      const key = `${name}|${field.type}|${value ?? ''}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ name, type: field.type, value }];
    }),
  );
}

/** pdfjs Metadata iterates as [name, value] pairs; array values come from rdf:Seq/rdf:Bag. */
function toXmp(
  metadata: Iterable<[string, unknown]> | null,
): Record<string, string> | undefined {
  if (!metadata) return undefined;

  const entries = [...metadata].flatMap(([key, value]) => {
    const text = Array.isArray(value)
      ? value.map(String).join(', ')
      : asString(value);
    return text ? [[key, text] as const] : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function withPdfErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    throw new FileExtractorError({
      category: CATEGORY_BY_ERROR[name] ?? 'extraction_failed',
      message: `PDF extraction failed (${name || 'unknown error'})`,
      cause,
    });
  }
}

const CATEGORY_BY_ERROR: Record<string, FileExtractorErrorCategory> = {
  PasswordException: 'password_required',
  InvalidPDFException: 'invalid_file',
  FormatError: 'invalid_file',
};

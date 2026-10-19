import { EuroPii, isEuroPiiError, type Detection } from '@axium-lab/euro-pii';
import { FileExtractorError } from '../errors/errors';
import type {
  ExtractedPage,
  FileKind,
  PiiPage,
  PiiScan,
  ScanPiiOptions,
} from '../types';

/** One instance serves every call: euro-pii takes no options and keeps no state. */
const ner = new EuroPii();

/** Calls `visit` once per page, in ascending order, one page at a time. */
export type PageReader = (
  visit: (page: ExtractedPage) => void,
) => Promise<void>;

/**
 * Runs euro-pii page by page and assembles the result. Format agnostic: the
 * reader decides how pages are produced; this only needs their number and text.
 *
 * Each page is scanned as a single line (line breaks become spaces, so lengths
 * and offsets do not change), which is exactly how `extract_text` builds `raw`.
 * Top-level offsets are shifted by the length of the pages before, plus the
 * separator between pages, so they point into `raw` for the same pages.
 */
export async function scanPii(
  kind: FileKind,
  options: ScanPiiOptions,
  readPages: PageReader,
): Promise<PiiScan> {
  // Fail fast on bad options, before opening a document that may be huge.
  withPiiErrors(() => ner.anonymize('', options));

  const pages: PiiPage[] = [];
  const entities: Detection[] = [];
  const blockedBy: Detection[] = [];
  let offset = 0;

  await readPages(({ number, text }) => {
    const result = withPiiErrors(() =>
      ner.anonymize(text.replace(/\n/g, ' '), options),
    );

    pages.push({ number, entities: result.entities });
    entities.push(...result.entities.map((d) => shift(d, offset)));
    if (result.blocked) {
      blockedBy.push(...result.blocked_by.map((d) => shift(d, offset)));
    }

    offset += text.length + 1; // the space `raw` puts between pages
  });

  const metadata = { kind, pages };

  return blockedBy.length > 0
    ? { blocked: true, blocked_by: blockedBy, entities, metadata }
    : { blocked: false, entities, metadata };
}

function shift(detection: Detection, offset: number): Detection {
  return {
    ...detection,
    start: detection.start + offset,
    end: detection.end + offset,
  };
}

/** euro-pii only throws on bad options, so every one of its errors is an invalid_input here. */
function withPiiErrors<T>(run: () => T): T {
  try {
    return run();
  } catch (cause) {
    if (!isEuroPiiError(cause)) throw cause;
    throw new FileExtractorError({
      category: 'invalid_input',
      message: cause.message,
      cause,
    });
  }
}

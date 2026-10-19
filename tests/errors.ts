/** Manual error playground: one block per error category, comment them in and out. */
import { readFile } from 'node:fs/promises';
import { FileExtractor, isFileExtractorError } from '../src/index';

async function fixtureAsBase64(name: string): Promise<string> {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return bytes.toString('base64');
}

function logError(error: unknown): void {
  if (!isFileExtractorError(error)) throw error;
  console.log('error:', error.category, '-', error.message);
}

// invalid_input: empty string.
try {
  new FileExtractor('');
} catch (error) {
  logError(error);
}

// invalid_input: not base64.
try {
  new FileExtractor('***not base64***');
} catch (error) {
  logError(error);
}

// unsupported_format: valid base64, but the bytes are plain text, not a PDF.
try {
  new FileExtractor(Buffer.from('hello world').toString('base64'));
} catch (error) {
  logError(error);
}

// invalid_input: a page beyond the document's page count.
try {
  await new FileExtractor(await fixtureAsBase64('full.pdf')).extract_text({
    pages: [99],
  });
} catch (error) {
  logError(error);
}

// invalid_input: the same page requested twice.
try {
  await new FileExtractor(await fixtureAsBase64('full.pdf')).extract_text({
    pages: [2, 2],
  });
} catch (error) {
  logError(error);
}

// invalid_input: neither raw nor pages requested.
try {
  await new FileExtractor(await fixtureAsBase64('full.pdf')).extract_text({
    raw: false,
    pages: false,
  });
} catch (error) {
  logError(error);
}

// invalid_file: looks like a PDF by its header, but the rest is garbage.
try {
  await new FileExtractor(
    Buffer.from('%PDF-1.7 garbage').toString('base64'),
  ).extract_text();
} catch (error) {
  logError(error);
}

// password_required: the PDF needs a user password to open.
try {
  await new FileExtractor(
    await fixtureAsBase64('encrypted.pdf'),
  ).extract_text();
} catch (error) {
  logError(error);
}

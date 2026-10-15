/** Manual playground: instantiate the library and check the output by hand. */
import { readFile } from 'node:fs/promises';
import { FileExtractor } from '../src/index';

async function fixtureAsBase64(name: string): Promise<string> {
  const bytes = await readFile(new URL(`./fixtures/${name}`, import.meta.url));
  return bytes.toString('base64');
}

// Happy path: a real PDF.

const documentBase64 = await fixtureAsBase64('full.pdf');

const extractor = new FileExtractor(documentBase64);

console.log('kind:', extractor.kind);

const result = await extractor.extract_text();
console.log('result:', result);

const metadata = await extractor.get_metadata();
console.log('metadata:', metadata);

// Error cases live in errors.ts. Comment this out to skip them.
await import('./errors');

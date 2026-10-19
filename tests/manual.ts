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
console.log('1.result:', result);
console.log('--------------------');
console.log('all pages:', await extractor.extract_text({ pages: true }));

console.log('--------------------');
console.log('--------------------');
console.log('pages 2 and 3:', await extractor.extract_text({ pages: [1, 3] }));

console.log('--------------------');
console.log('--------------------');
console.log(
  'page 1 only, no raw:',
  await extractor.extract_text({ raw: false, pages: [1] }),
);
console.log('--------------------');
console.log('--------------------');
// const metadata = await extractor.get_metadata();
// console.log('metadata:', metadata);

// PII: euro-pii over a fixture with a NIF, an email, a card and an IBAN.
const piiExtractor = new FileExtractor(await fixtureAsBase64('pii.pdf'));
console.log(
  'pii scan:',
  JSON.stringify(
    await piiExtractor.scan_pii(
      {
        countries: ['ES', 'GLOBAL'],
        except: ['DATE_TIME'],
        policy: { kinds: { PAYMENT_CARD: 'block' } },
      },
      { pages: [1, 3] }, // or `true` for every page; leave it out for no per-page breakdown
    ),
    null,
    2,
  ),
);
console.log('--------------------');

// Error cases live in errors.ts. Comment this out to skip them.
await import('./errors');

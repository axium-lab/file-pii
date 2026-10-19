/** scan_pii: offsets must line up with extract_text, the policy must block, bad options must throw. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FileExtractor, isFileExtractorError } from '../src/index';
import type { PiiScan } from '../src/index';

const pdf = await readFile(new URL('./fixtures/pii.pdf', import.meta.url));
const extractor = new FileExtractor(pdf);

const piiJson = {
  countries: ['ES', 'GLOBAL'],
  except: ['DATE_TIME'],
  policy: { kinds: { PAYMENT_CARD: 'block' } },
} as const;

/** Every detection must point at its own value, both in raw and in its page. */
async function assertOffsets(scan: PiiScan, pages?: number[]) {
  const text = await extractor.extract_text({ pages: pages ?? true });
  const raw = text.raw ?? '';

  for (const d of scan.entities) {
    assert.equal(raw.slice(d.start, d.end), d.value, `raw offset of ${d.entity}`);
  }
  for (const page of scan.metadata.pages) {
    const extracted = text.pages?.find((p) => p.number === page.number);
    assert.ok(extracted, `page ${page.number} was extracted`);
    for (const d of page.entities) {
      assert.equal(extracted.text.slice(d.start, d.end), d.value, `page ${page.number} offset of ${d.entity}`);
    }
  }
  // Top level and metadata hold the same detections, in the same order.
  const flat = scan.metadata.pages.flatMap((p) => p.entities.map((d) => d.value));
  assert.deepEqual(scan.entities.map((d) => d.value), flat);
}

// Whole document: four entities, blocked by the card.
{
  const scan = await extractor.scan_pii(piiJson);
  assert.equal(scan.metadata.kind, 'pdf');
  assert.deepEqual(scan.metadata.pages.map((p) => p.number), [1, 2, 3]);
  assert.deepEqual(
    scan.entities.map((d) => d.entity),
    ['ES_NIF', 'EMAIL_ADDRESS', 'CREDIT_CARD', 'IBAN_CODE'],
  );
  assert.equal(scan.blocked, true);
  assert.ok(scan.blocked);
  assert.deepEqual(scan.blocked_by.map((d) => d.entity), ['CREDIT_CARD']);
  assert.equal(scan.metadata.pages[1]?.entities.length, 0, 'page 2 has no PII');
  await assertOffsets(scan);
}

// No policy: everything is found, nothing blocks, blocked_by is absent.
{
  const scan = await extractor.scan_pii();
  assert.equal(scan.blocked, false);
  assert.equal('blocked_by' in scan, false);
  assert.ok(scan.entities.length >= 4);
  await assertOffsets(scan);
}

// Scope: only page 1, offsets relative to that page's raw.
{
  const scan = await extractor.scan_pii(piiJson, { pages: [1] });
  assert.equal(scan.blocked, false);
  assert.deepEqual(scan.metadata.pages.map((p) => p.number), [1]);
  assert.deepEqual(scan.entities.map((d) => d.entity), ['ES_NIF', 'EMAIL_ADDRESS']);
  await assertOffsets(scan, [1]);
}

// Scope: pages 1 and 3 skipping 2; the raw offsets follow extract_text({ pages: [1, 3] }).
{
  const scan = await extractor.scan_pii(piiJson, { pages: [3, 1] });
  assert.deepEqual(scan.metadata.pages.map((p) => p.number), [1, 3]);
  assert.equal(scan.blocked, true);
  await assertOffsets(scan, [1, 3]);
}

// Scope: an empty list scans nothing, like extract_text.
{
  const scan = await extractor.scan_pii(piiJson, { pages: [] });
  assert.equal(scan.blocked, false);
  assert.deepEqual(scan.entities, []);
  assert.deepEqual(scan.metadata.pages, []);
}

// Policy: default block refuses on the first personal datum.
{
  const scan = await extractor.scan_pii({ policy: { default: 'block' } });
  assert.equal(scan.blocked, true);
  assert.ok(scan.blocked && scan.blocked_by.length === scan.entities.length);
}

// Policy: an explicit block is looked for even when the selection leaves it out.
{
  const scan = await extractor.scan_pii({
    countries: ['ES'],
    policy: { entities: { IBAN_CODE: 'block' } },
  });
  assert.ok(scan.blocked);
  assert.deepEqual(scan.blocked_by.map((d) => d.entity), ['IBAN_CODE']);
}

// Policy: `mask` is not in our type but behaves as keep when it arrives from plain JSON.
{
  const fromJson = JSON.parse('{"policy":{"default":"mask"}}');
  const scan = await extractor.scan_pii(fromJson);
  assert.equal(scan.blocked, false);
  assert.ok(scan.entities.length >= 4);
}

// Errors: bad options fail as invalid_input, before touching the document.
for (const bad of [
  { entities: ['NOT_AN_ENTITY'] },
  { countries: ['ES'], entities: ['DE_TAX_ID'] },
  { except: ['IBAN_CODE'], policy: { entities: { IBAN_CODE: 'block' } } },
]) {
  await assert.rejects(
    extractor.scan_pii(bad as never),
    (error: unknown) => isFileExtractorError(error) && error.category === 'invalid_input',
    `rejects ${JSON.stringify(bad)}`,
  );
}

// Errors: a page out of range is the same invalid_input as in extract_text.
await assert.rejects(
  extractor.scan_pii(piiJson, { pages: [99] }),
  (error: unknown) => isFileExtractorError(error) && error.category === 'invalid_input',
);

// Errors: an encrypted document fails the same way it does in extract_text.
{
  const encrypted = new FileExtractor(await readFile(new URL('./fixtures/encrypted.pdf', import.meta.url)));
  const [a, b] = await Promise.all([
    encrypted.extract_text().then(() => null, (e: unknown) => e),
    encrypted.scan_pii().then(() => null, (e: unknown) => e),
  ]);
  assert.ok(isFileExtractorError(a) && isFileExtractorError(b));
  assert.equal(b.category, a.category);
}

console.log('pii: all assertions passed');

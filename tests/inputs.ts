/** Input formats: every accepted shape must decode to the same bytes, every bad one must throw. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FileExtractor, isFileExtractorError } from '../src/index';

const pdf = await readFile(new URL('./fixtures/full.pdf', import.meta.url));
const base64 = pdf.toString('base64');

async function rawText(input: ConstructorParameters<typeof FileExtractor>[0]) {
  const extractor = new FileExtractor(input);
  assert.equal(extractor.kind, 'pdf');
  return (await extractor.extract_text()).raw;
}

const expected = await rawText(base64);
assert.ok(expected && expected.length > 0, 'fixture must contain text');

// Buffer.
assert.equal(await rawText(pdf), expected);

// A view into a larger buffer, like Buffers from Node's shared pool: `.buffer` is bigger
// than the file and the data starts at a non-zero offset.
const padded = Buffer.concat([Buffer.from('junk'), pdf, Buffer.from('tail')]);
const view = padded.subarray(4, 4 + pdf.byteLength);
assert.notEqual(view.byteOffset, 0);
assert.notEqual(view.buffer.byteLength, view.byteLength);
assert.equal(await rawText(view), expected);

// Uint8Array.
assert.equal(await rawText(new Uint8Array(pdf)), expected);

// ArrayBuffer.
assert.equal(
  await rawText(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)),
  expected,
);

// base64 with line wrapping.
assert.equal(await rawText(base64.replace(/(.{76})/g, '$1\r\n')), expected);

// base64url, with and without padding.
const base64url = pdf.toString('base64url');
assert.equal(await rawText(base64url), expected);
assert.equal(await rawText(base64url + '='.repeat((4 - (base64url.length % 4)) % 4)), expected);

// Data URI, with and without MIME type, case-insensitive scheme.
assert.equal(await rawText(`data:application/pdf;base64,${base64}`), expected);
assert.equal(await rawText(`data:;base64,${base64}`), expected);
assert.equal(await rawText(`DATA:application/pdf;charset=binary;BASE64,${base64}`), expected);

// The MIME type is ignored: the bytes decide.
assert.equal(await rawText(`data:text/plain;base64,${base64}`), expected);

// Errors.
function expectInvalidInput(input: unknown, label: string) {
  try {
    new FileExtractor(input as never);
    assert.fail(`${label}: should have thrown`);
  } catch (error) {
    if (!isFileExtractorError(error)) throw error;
    assert.equal(error.category, 'invalid_input', `${label}: ${error.message}`);
  }
}

expectInvalidInput('', 'empty string');
expectInvalidInput('   \n', 'whitespace only');
expectInvalidInput('***not base64***', 'not base64');
expectInvalidInput('data:application/pdf;base64', 'data URI without payload');
expectInvalidInput('data:application/pdf;base64,', 'data URI with empty payload');
expectInvalidInput(`data:application/pdf,${base64}`, 'data URI not base64');
expectInvalidInput(`data:text/plain,hello`, 'data URI url-encoded');
expectInvalidInput(Buffer.alloc(0), 'empty Buffer');
expectInvalidInput(new ArrayBuffer(0), 'empty ArrayBuffer');
expectInvalidInput(42, 'number');
expectInvalidInput(null, 'null');
expectInvalidInput(undefined, 'undefined');
expectInvalidInput({ base64 }, 'object');

console.log('inputs: all checks passed');

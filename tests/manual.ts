/** Manual playground: instantiate the library and check the output by hand. */
import { FileExtractorError, isFileExtractorError } from '../src/index';

const error = new FileExtractorError({
  category: 'unsupported_format',
  message: 'Only PDF is supported for now',
});

console.log(error.name, '|', error.category, '|', error.message);
console.log('isFileExtractorError:', isFileExtractorError(error));
console.log('plain Error:', isFileExtractorError(new Error('x')));

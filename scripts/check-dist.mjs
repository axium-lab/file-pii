#!/usr/bin/env node
/**
 * Guards the published surface. Runs after `tsup`, and fails the build.
 *
 * **Every `exports` path resolves.** A subpath pointing at a file tsup did not
 * emit is a runtime failure for whoever imports it, and nothing else checks it:
 * `files` ships only `dist`, so the mistake is invisible until someone installs
 * the package.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const failures = [];

// `main`, `module` and `types` are what older resolvers read instead of `exports`.
for (const field of ['main', 'module', 'types']) {
  const target = pkg[field];
  if (target && !existsSync(join(root, target))) {
    failures.push(`"${field}" points at ${target}, which was not emitted.`);
  }
}

for (const [subpath, conditions] of Object.entries(pkg.exports ?? {})) {
  for (const [condition, target] of Object.entries(conditions)) {
    if (!existsSync(join(root, target))) {
      failures.push(
        `exports["${subpath}"].${condition} points at ${target}, which was not emitted.`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error('\n✗ dist check failed:\n');
  for (const failure of failures) console.error(`  • ${failure}\n`);
  process.exit(1);
}

console.log(
  `✓ dist check passed: all ${Object.keys(pkg.exports ?? {}).length} export paths resolve.`,
);

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT } from '../support/utils/runCommand.js';

// Convention spec (issue #892): no file under `core/spec/` may reference a
// pending migration in a way `scripts/bump-version.sh` cannot rewrite on
// release. See the Spec convention in
// `docs/agents/architecture/per-repo-migrations.md` ("Referencing pending
// migrations"). Two patterns are forbidden:
//
// 1. the pending-manifest literal (`repos/` + `next/migrations.json`);
// 2. a `'repos'` string immediately followed by a `'next'` string as
//    consecutive arguments (segment assembly), in either quote style.
//
// Both patterns are built from pieces so this file never contains the
// forbidden text itself, and needs no self-exclusion.
//
// Known limitation: template literals and variables that hold `'next'`
// are not detected.

const SPEC_ROOT = path.join(REPO_ROOT, 'core', 'spec');
const SKIPPED_DIRS = new Set(['node_modules']);

const REPOS = 'repos';
const NEXT = 'next';
const MANIFEST_LITERAL = [REPOS, NEXT, 'migrations.json'].join('/');
const QUOTE = '[\'"]';
const SEGMENT_PATTERN = new RegExp(
  [QUOTE, REPOS, QUOTE, '\\s*,\\s*', QUOTE, NEXT, QUOTE].join('')
);

/**
 * Recursively list every file under a directory, skipping `node_modules`.
 * @param {string} dir - absolute directory to walk.
 * @returns {Promise<string[]>} absolute file paths.
 */
async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        files.push(...await listFiles(fullPath));
      }
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Find every forbidden migration reference in one file.
 * @param {string} file - absolute file path.
 * @returns {Promise<string[]>} hits as `<relative path>:<line>: <match>`.
 */
async function findHits(file) {
  const content = await readFile(file, 'utf8');
  const relative = path.relative(REPO_ROOT, file);
  const hits = [];

  content.split('\n').forEach((line, index) => {
    const matches = [];

    if (line.includes(MANIFEST_LITERAL)) {
      matches.push(MANIFEST_LITERAL);
    }

    const segment = line.match(SEGMENT_PATTERN);

    if (segment) {
      matches.push(segment[0]);
    }

    matches.forEach((match) => {
      hits.push(`${relative}:${index + 1}: ${match}`);
    });
  });

  return hits;
}

describe('migration references in core/spec', () => {
  it('never use a pending-migration path the version bump cannot rewrite', async () => {
    const files = await listFiles(SPEC_ROOT);
    const hits = (await Promise.all(files.map(findHits))).flat();

    expect(hits).toEqual([]);
  });
});

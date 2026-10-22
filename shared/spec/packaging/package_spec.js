import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json');

describe('shared/package.json', () => {
  let pkg;

  beforeAll(async () => {
    pkg = JSON.parse(await readFile(PACKAGE_FILE, 'utf8'));
  });

  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    it(`has no ${field} (zero runtime dependencies)`, () => {
      const value = pkg[field];

      expect(value === undefined || Object.keys(value).length === 0)
        .withContext(`${field}: ${JSON.stringify(value)}`)
        .toBeTrue();
    });
  }

  it('is private (never published)', () => {
    expect(pkg.private).toBe(true);
  });
});

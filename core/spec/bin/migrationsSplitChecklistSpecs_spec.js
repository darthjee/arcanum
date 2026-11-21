import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NATIVE_BIN, REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Contract spec for the pending per-repo instructions migration that adds
// the Specs concern to docs/agents/arcanum-split-issue.md (issue #935).
// The paths are full string literals so `scripts/bump-version.sh` can
// rewrite them on release. NOT a parity spec. The drift guard asserts the
// bullet quoted by the instructions matches what the native seed writes.

const INSTRUCTIONS = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/003.instructions.md');
const DESCRIPTION = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/003.md');
const MANIFEST = path.join(path.dirname(INSTRUCTIONS), 'migrations.json');
const BULLET_PREFIX = '- **Specs** —';

/**
 * @param {string} filePath - the path to check.
 * @returns {Promise<boolean>} whether the path exists.
 */
async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('split checklist specs-concern migration', () => {
  it('declares a skippable repo-scoped instructions entry for 003', async () => {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

    expect(manifest.find((item) => item.id === '003')).toEqual({
      id: '003',
      type: 'instructions',
      description_file: '003.md',
      instructions_file: '003.instructions.md',
      skippable: true,
      applies_to: 'repo'
    });
  });

  it('ships both the description and the instructions files', async () => {
    expect(await exists(DESCRIPTION)).toBeTrue();
    expect(await exists(INSTRUCTIONS)).toBeTrue();
  });

  describe('drift guard', () => {
    let repoPath;

    beforeEach(async () => {
      repoPath = await createTempDir('arcanum-core-split-checklist-specs-');
    });

    afterEach(async () => {
      await removeTempDir(repoPath);
    });

    it('quotes the exact Specs bullet the native seed writes', async () => {
      const instructions = await readFile(INSTRUCTIONS, 'utf8');
      const bullets = instructions.split('\n').filter((line) => line.startsWith(BULLET_PREFIX));

      expect(bullets.length).toEqual(1);

      const result = await runCommand(
        [process.execPath, NATIVE_BIN, 'init-claude-setup-docs-structure', repoPath],
        repoPath,
        process.env
      );

      expect(result.code).toEqual(0);

      const seeded = await readFile(path.join(repoPath, 'docs/agents/arcanum-split-issue.md'), 'utf8');

      expect(seeded.split('\n')).toContain(bullets[0]);
    });
  });
});

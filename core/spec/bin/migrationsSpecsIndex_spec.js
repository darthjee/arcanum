import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';
import { snapshotTree } from '../support/utils/initClaudeParity.js';

// Contract spec for the pending per-repo migration that creates
// docs/agents/specs.md from init-claude/templates/specs.md and
// docs/agents/specs/.gitkeep (issue #933). The script path is one full
// string literal so `scripts/bump-version.sh` can rewrite it on release.
// NOT a parity spec. Runs with cwd = the target repo.

const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/001.sh');
const MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json');
const TEMPLATE = path.join(REPO_ROOT, 'init-claude/templates/specs.md');

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

describe('specs index migration', () => {
  let repoPath;
  let agentsDir;
  let specsIndex;
  let specsDir;
  let gitkeep;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-specs-index-migration-');
    agentsDir = path.join(repoPath, 'docs/agents');
    specsIndex = path.join(agentsDir, 'specs.md');
    specsDir = path.join(agentsDir, 'specs');
    gitkeep = path.join(specsDir, '.gitkeep');
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} subcommand - the migration's subcommand.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runMigration(subcommand) {
    return runCommand(['bash', SCRIPT, subcommand], repoPath, { PATH: process.env.PATH, HOME: repoPath });
  }

  it('config prints {"skippable": true}', async () => {
    const result = await runMigration('config');

    expect(result.code).toEqual(0);
    expect(result.stdout).toEqual('{"skippable": true}\n');
  });

  it('declares a skippable repo-scoped script entry for 001', async () => {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

    expect(manifest.find((item) => item.id === '001')).toEqual({
      id: '001',
      type: 'script',
      file: '001.sh',
      skippable: true,
      applies_to: 'repo'
    });
  });

  it('creates specs.md from the template and specs/.gitkeep in a fresh repo', async () => {
    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readFile(specsIndex, 'utf8')).toEqual(await readFile(TEMPLATE, 'utf8'));
    expect(await readFile(gitkeep, 'utf8')).toEqual('');
    expect(result.stdout).toEqual('Created: docs/agents/specs.md\nCreated: docs/agents/specs/.gitkeep\n');
  });

  it('leaves an existing specs.md untouched and still creates specs/.gitkeep', async () => {
    await mkdir(agentsDir, { recursive: true });
    await writeFile(specsIndex, '# Custom specs\n');

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readFile(specsIndex, 'utf8')).toEqual('# Custom specs\n');
    expect(await exists(gitkeep)).toBeTrue();
    expect(result.stdout).toContain('Already present, left untouched: docs/agents/specs.md\n');
  });

  it('warns and skips .gitkeep when docs/agents/specs is a file', async () => {
    await mkdir(agentsDir, { recursive: true });
    await writeFile(specsDir, 'not a directory\n');

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readFile(specsDir, 'utf8')).toEqual('not a directory\n');
    expect(await exists(gitkeep)).toBeFalse();
    expect(result.stderr).toContain('Warning: docs/agents/specs exists and is not a directory');
    expect(await readFile(specsIndex, 'utf8')).toEqual(await readFile(TEMPLATE, 'utf8'));
  });

  it('does not create .gitkeep when specs/ already holds a spec', async () => {
    await mkdir(specsDir, { recursive: true });
    await writeFile(path.join(specsDir, 'feature.md'), '# Feature\n');

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await exists(gitkeep)).toBeFalse();
  });

  it('does not create .gitkeep when specs/ holds only a hidden file', async () => {
    await mkdir(specsDir, { recursive: true });
    await writeFile(path.join(specsDir, '.DS_Store'), '');

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await exists(gitkeep)).toBeFalse();
  });

  it('a re-run leaves the tree unchanged', async () => {
    await runMigration('run');
    const first = await snapshotTree(repoPath);
    const second = await runMigration('run');

    expect(second.code).toEqual(0);
    expect(await snapshotTree(repoPath)).toEqual(first);
  });
});

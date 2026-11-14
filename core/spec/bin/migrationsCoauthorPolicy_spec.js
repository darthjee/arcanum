import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';
import { POLICY_LINE } from '../../lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy.js';

// Contract spec for the pending per-repo migration that appends the
// co-author policy line to the repo's AGENTS.md (issue #911). The script
// path is one full string literal so `scripts/bump-version.sh` can rewrite
// it on release. NOT a parity spec. Runs with cwd = the target repo.

const SCRIPT = path.join(REPO_ROOT, 'arcanum/migrations/repos/next/004.sh');
const MANIFEST = path.join(path.dirname(SCRIPT), 'migrations.json');

describe('co-author policy migration', () => {
  let repoPath;
  let agentsFile;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-coauthor-policy-migration-');
    agentsFile = path.join(repoPath, 'AGENTS.md');
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

  it('declares a skippable repo-scoped script entry for 004', async () => {
    const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));

    expect(manifest.find((item) => item.id === '004')).toEqual({
      id: '004',
      type: 'script',
      file: '004.sh',
      skippable: true,
      applies_to: 'repo'
    });
  });

  it('run adds the policy line to AGENTS.md', async () => {
    await writeFile(agentsFile, '# Title\n');

    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    expect(await readFile(agentsFile, 'utf8')).toEqual(`# Title\n\n## Commit Attribution\n\n${POLICY_LINE}\n`);
  });

  it('a re-run leaves the file unchanged', async () => {
    await writeFile(agentsFile, '# Title\n');

    await runMigration('run');
    const first = await readFile(agentsFile, 'utf8');
    const second = await runMigration('run');

    expect(second.code).toEqual(0);
    expect(await readFile(agentsFile, 'utf8')).toEqual(first);
  });

  it('is a no-op without an AGENTS.md', async () => {
    const result = await runMigration('run');

    expect(result.code).toEqual(0);
    await expectAsync(readFile(agentsFile, 'utf8')).toBeRejected();
  });
});

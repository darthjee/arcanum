import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createGitTaggedInstall } from '../support/utils/gitTaggedInstallFixture.js';
import { git, runCommand } from '../support/utils/runCommand.js';

// Regression spec for issue #653: `arcanum/update/bootstrap.sh`'s
// git-clone update path must ignore untracked files (e.g. the
// host-created `synced/` folder) while still refusing to update over
// modified or staged tracked changes. Not a parity spec — it runs the
// real, shipped script against an offline, temporary git-clone
// install (see docs/agents/plans/653-*/plan.md's "Shared contracts").

const execFileAsync = promisify(execFile);

/**
 * @param {string} installPath - the install's root.
 * @returns {Promise<string>} the tag HEAD sits exactly on ('' if none).
 */
async function currentTag(installPath) {
  try {
    const { stdout } = await execFileAsync('git', ['describe', '--tags', '--exact-match'], { cwd: installPath });

    return stdout.trim();
  } catch {
    return '';
  }
}

/**
 * Run the install's copy of `bootstrap.sh` offline, unattended.
 * @param {{installPath: string, scriptPath: string}} install - the fixture install.
 * @param {string} version - the `ARCANUM_VERSION` to update to.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
function runBootstrap(install, version) {
  const env = {
    ...process.env,
    ARCANUM_VERSION: version,
    ARCANUM_ASSUME_YES: '1',
    ARCANUM_REPO: 'test/arcanum',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 't@example.com'
  };

  return runCommand(['bash', install.scriptPath], install.installPath, env);
}

describe('arcanum-update bootstrap.sh (git-clone install)', () => {
  let install;

  beforeEach(async () => {
    install = await createGitTaggedInstall();
  });

  afterEach(async () => {
    await install.cleanup();
  });

  describe('with only untracked files present', () => {
    it('updates to the target tag', async () => {
      const syncedPath = path.join(install.installPath, 'synced');

      // `syncedPath` lives under a trusted, test-controlled temporary
      // directory, so these are known false positives for Codacy's
      // `detect-non-literal-fs-filename` pattern (see issue #460).
      await mkdir(path.join(syncedPath, 'sub'), { recursive: true });
      await writeFile(path.join(syncedPath, '.bucket-x'), '');
      await writeFile(path.join(syncedPath, 'sub', 'file'), 'data\n');

      const result = await runBootstrap(install, 'v2');

      expect(result.code).toEqual(0);
      expect(result.stderr).toContain('arcanum updated to v2');
      expect(await currentTag(install.installPath)).toEqual('v2');
    });
  });

  describe('with a modified tracked file', () => {
    it('refuses to update and stays on the current tag', async () => {
      // Trusted temp-dir path — see the issue #460 note above.
      await writeFile(path.join(install.installPath, 'README.md'), '# modified\n');

      const result = await runBootstrap(install, 'v2');

      expect(result.code).toEqual(1);
      expect(result.stderr).toContain('has uncommitted changes');
      expect(await currentTag(install.installPath)).toEqual('v1');
    });
  });

  describe('with a staged change', () => {
    it('refuses to update and stays on the current tag', async () => {
      // Trusted temp-dir path — see the issue #460 note above.
      await writeFile(path.join(install.installPath, 'staged.txt'), 'staged\n');
      await git(['add', 'staged.txt'], install.installPath);

      const result = await runBootstrap(install, 'v2');

      expect(result.code).toEqual(1);
      expect(result.stderr).toContain('has uncommitted changes');
      expect(await currentTag(install.installPath)).toEqual('v1');
    });
  });

  describe('when already on the target tag', () => {
    it('exits cleanly without changing anything', async () => {
      const result = await runBootstrap(install, 'v1');

      expect(result.code).toEqual(0);
      expect(result.stderr).toContain('Already on v1.');
      expect(await currentTag(install.installPath)).toEqual('v1');
    });
  });
});

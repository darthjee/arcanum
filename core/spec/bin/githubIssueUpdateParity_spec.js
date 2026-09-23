import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { REPO_ROOT, NATIVE_BIN, expectParity, git, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "github-issue-update" migrated entrypoint (issue
// #588) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/588-migrate-github-issue-fetch-and-update-subcommands-to-native-node-js/node.md's
// "Shared contracts". Runs arcanum/_lib/github_issue_shell.sh (invoked
// directly, NOT through the arcanum/_lib/github_issue.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum
// github-issue-update` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// Coverage note: specs never make real network calls, and `update`
// PATCHes the GitHub REST API once the origin is resolved — so only the
// offline-reachable failure paths (missing file, origin failure) are
// covered here. The success path and the PATCH failure are covered by
// GithubIssueUpdate_spec.js's mocked-`fetchFn` unit tests.

const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');

/**
 * @param {string[]} args - `[repoPath, id, title, file]` to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, 'update', ...args], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'github-issue-update', ...args], cwd);

  return { shell, native };
}

/**
 * Asserts both sides failed identically with `message` on stderr.
 * @param {{shell: object, native: object}} results - both sides' results.
 * @param {string} message - the expected stderr error line.
 * @returns {void}
 */
function expectFailureParity({ shell, native }, message) {
  expectParity(shell, native);
  expect(shell.code).not.toEqual(0);
  expect(shell.stdout).toEqual('');
  expect(shell.stderr.trim()).toEqual(message);
  expect(native.stderr.trim()).toContain(message);
}

describe('github-issue-update parity (shell vs. native)', () => {
  let cwd;
  let repoPath;
  let missingRepoPath;

  beforeEach(async () => {
    cwd = await createTempDir('arcanum-core-giu-parity-');
    repoPath = path.join(cwd, 'repo');
    missingRepoPath = path.join(cwd, 'no-such-dir');
    await mkdir(repoPath);
    await git(['init', '--quiet', '-b', 'main', repoPath], cwd);
  });

  afterEach(async () => {
    await removeTempDir(cwd);
  });

  describe('a missing <file>', () => {
    it('matches shell for a relative path, resolved against the cwd', async () => {
      const results = await runBoth([repoPath, '12', 'title', 'missing.md'], cwd);

      expectFailureParity(results, 'Error: file not found: missing.md');
    });

    it('matches shell for an absolute path', async () => {
      const file = path.join(cwd, 'missing.md');
      const results = await runBoth([repoPath, '12', 'title', file], cwd);

      expectFailureParity(results, `Error: file not found: ${file}`);
    });

    it('reports file-not-found rather than a repo-path error for a nonexistent repo_path', async () => {
      const results = await runBoth([missingRepoPath, '12', 'title', 'missing.md'], cwd);

      expectFailureParity(results, 'Error: file not found: missing.md');
    });
  });

  describe('an existing <file>', () => {
    beforeEach(async () => {
      await writeFile(path.join(cwd, 'body.md'), 'the body\n');
    });

    it('matches shell for a relative file (cwd) with a git repo_path lacking an origin', async () => {
      const results = await runBoth([repoPath, '12', 'title', 'body.md'], cwd);

      expectFailureParity(results, `Error: '${repoPath}' is not a git repository or has no 'origin' remote`);
    });

    it('matches shell for a nonexistent repo_path, reaching the origin error', async () => {
      const results = await runBoth([missingRepoPath, '12', 'title', 'body.md'], cwd);

      expectFailureParity(
        results, `Error: '${missingRepoPath}' is not a git repository or has no 'origin' remote`
      );
    });
  });
});

import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "github-issue-info" migrated entrypoint (issue
// #237) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/node.md's
// "Shared contracts". Runs arcanum/_lib/github_issue_shell.sh (invoked
// directly, NOT through the arcanum/_lib/github_issue.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum
// github-issue-info` against identical fixture repos, asserting
// byte-identical stdout and exit code. `info` never touches the
// network — `git remote get-url origin` only reads local config, so
// every case here is fully offline and deterministic.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a github-issue-info invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd });

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

/**
 * @param {string} repoPath - the repo path argument to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(repoPath, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, 'info', repoPath], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'github-issue-info', repoPath], cwd);

  return { shell, native };
}

/**
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @param {string} url - the `origin` remote URL to set.
 * @returns {Promise<void>} resolves once the remote has been set.
 */
async function setOrigin(repoPath, url) {
  await execFileAsync('git', ['-C', repoPath, 'remote', 'set-url', 'origin', url]);
}

describe('github-issue-info parity (shell vs. native)', () => {
  describe('a GitHub-shaped origin remote', () => {
    it('matches shell output byte-for-byte', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await setOrigin(repo.repoPath, 'https://github.com/darthjee/arcanum.git');

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).withContext(`shell stderr: ${shell.stderr}`).toEqual(0);
        expect(shell.stdout).toEqual('DOMAIN=github.com\nREPO=darthjee/arcanum\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('an origin on a non-github.com domain', () => {
    it('matches shell output byte-for-byte', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await setOrigin(repo.repoPath, 'git@git.example.com:acme/widgets.git');

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).withContext(`shell stderr: ${shell.stderr}`).toEqual(0);
        expect(shell.stdout).toEqual('DOMAIN=git.example.com\nREPO=acme/widgets\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-gii-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth(missingPath, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(
          `Error: '${missingPath}' is not a git repository or has no 'origin' remote`
        );
        expect(native.stderr.trim()).toContain(
          `Error: '${missingPath}' is not a git repository or has no 'origin' remote`
        );
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a repo_path that is a directory but not a git repo', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-gii-parity-');

      try {
        const { shell, native } = await runBoth(cwd, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: '${cwd}' is not a git repository or has no 'origin' remote`);
        expect(native.stderr.trim()).toContain(`Error: '${cwd}' is not a git repository or has no 'origin' remote`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

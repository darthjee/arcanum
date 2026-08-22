import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "github-issue-create" migrated entrypoint (issue
// #237) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/237-migrate-github-issue-entrypoint-info-create-to-native-node-js/node.md's
// "Shared contracts". Runs arcanum/_lib/github_issue_shell.sh (invoked
// directly, NOT through the arcanum/_lib/github_issue.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum
// github-issue-create` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// Coverage note: per resolveAndFetchParity_spec.js's precedent, this
// repo's specs never make real network calls, and `create` hits the
// real GitHub REST API past the file-exists check — so only the
// offline-reachable failure paths (before any HTTP call) are covered
// here. The success path and post-network failures are already covered
// by GithubIssue_spec.js's mocked-`fetchFn` unit tests (node/04).

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'github_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a github-issue-create invocation (shell or native) and capture its
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
 * @param {string[]} args - `[repoPath, title, file]` to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, 'create', ...args], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'github-issue-create', ...args], cwd);

  return { shell, native };
}

describe('github-issue-create parity (shell vs. native)', () => {
  describe('a missing repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-gic-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth([missingPath, 'some title', 'body.md'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a present, valid repo_path but a missing <file> argument', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-gic-parity-');
      const repoPath = path.join(cwd, 'repo');

      try {
        await mkdir(repoPath, { recursive: true });
        await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);

        const missingFile = path.join(repoPath, 'does-not-exist.md');
        const { shell, native } = await runBoth([repoPath, 'some title', missingFile], repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingFile}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

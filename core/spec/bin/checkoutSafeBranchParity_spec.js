import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "checkout-safe-branch" migrated entrypoint (issue
// #233) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/233-migrate-checkout-safe-branch-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs arcanum/_lib/checkout_safe_branch_shell.sh
// (invoked directly, NOT through the arcanum/_lib/checkout_safe_branch.sh
// engine_dispatch shim — so this test isn't circular) and
// `core/bin/arcanum checkout-safe-branch` against identical repo states,
// asserting byte-identical stdout and exit code (plus stderr message for
// the hard-failure cases).

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'checkout_safe_branch_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a checkout-safe-branch invocation (shell or native) and capture
 * its stdout/stderr/exit code.
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
  const shell = await runCommand([SHELL_SCRIPT, repoPath], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'checkout-safe-branch', repoPath], cwd);

  return { shell, native };
}

describe('checkout-safe-branch parity (shell vs. native)', () => {
  describe('a clean working tree', () => {
    it('matches shell output byte-for-byte', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('BRANCH=origin/main\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a dirty tracked-file working tree', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (modified)\n');

        const { shell, native } = await runBoth(repo.repoPath, repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toContain('uncommitted changes');
        expect(native.stderr.trim()).toContain(shell.stderr.trim());
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-csb-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth(missingPath, cwd);

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

  describe('a non-git repo_path', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-csb-parity-');

      try {
        const { shell, native } = await runBoth(cwd, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

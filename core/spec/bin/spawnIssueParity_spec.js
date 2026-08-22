import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "spawn-issue" migrated entrypoint (issue #239) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/239-migrate-spawn-issue-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs arcanum/_lib/spawn_issue_shell.sh (invoked
// directly, NOT through the arcanum/_lib/spawn_issue.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum spawn-issue`
// against identical inputs/repo state, asserting byte-identical stdout
// and exit code.
//
// Scoped to offline-reachable, deterministic failure paths only — the
// success path (STATUS=ok), the retry loop, label handling, and linking
// all require real gh/GitHub-API calls, so they're covered by
// SpawnIssue_spec.js (fully fake-injected) and by spawn_issue.sh's own
// pre-existing shell behavior instead, per the repo-wide "no real
// network calls in specs" rule.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'spawn_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a spawn-issue invocation (shell or native) and capture its
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
 * @param {string[]} args - the `<repo_path> <parent_id> <title>
 *   <body_file> [--as-subissue]` arguments to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'spawn-issue', ...args], cwd);

  return { shell, native };
}

describe('spawn-issue parity (shell vs. native)', () => {
  describe('a missing repo_path (not a directory)', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-si-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const bodyFile = path.join(cwd, 'body.md');

        await writeFile(bodyFile, 'a scratch issue body\n');

        const { shell, native } = await runBoth([missingPath, '1', 'Title', bodyFile], cwd);

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
      const cwd = await createTempDir('arcanum-core-si-parity-');

      try {
        const bodyFile = path.join(cwd, 'body.md');

        await writeFile(bodyFile, 'a scratch issue body\n');

        const { shell, native } = await runBoth([cwd, '1', 'Title', bodyFile], cwd);

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

  describe('a missing body_file', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const missingFile = path.join(repo.repoPath, 'does-not-exist.md');

        const { shell, native } = await runBoth([repo.repoPath, '1', 'Title', missingFile], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingFile}`);
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('an unrecognized 5th argument (not --as-subissue)', () => {
    it('matches shell exit code and stdout, both failing before touching the network', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const bodyFile = path.join(repo.repoPath, 'body.md');

        await writeFile(bodyFile, 'a scratch issue body\n');

        const { shell, native } = await runBoth(
          [repo.repoPath, '1', 'Title', bodyFile, '--bogus-flag'],
          repo.repoPath
        );

        // The shell's own Usage guard and the native side's equivalent
        // argument-validation error wording aren't required to match
        // byte-for-byte here (see this spec's plan step for context) —
        // only the observable stdout/exit-code contract is asserted.
        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });
});

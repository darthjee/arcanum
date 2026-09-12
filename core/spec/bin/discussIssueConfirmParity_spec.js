import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

// Parity test for the "discuss-issue-confirm" migrated entrypoint
// (issue #447) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/447-migrate-discuss-issue-confirm-entrypoint-to-native-node-js/node.md.
// Runs discuss-issue/scripts/confirm_shell.sh directly (NOT through the
// discuss-issue/scripts/confirm.sh engine_dispatch shim — so this test
// isn't circular) and `core/bin/arcanum discuss-issue-confirm` against
// equivalent inputs, asserting byte-identical (always-empty) stdout and
// exit code on both sides. This is a context-less, no-git entrypoint,
// mirroring autoFixIssueListPlanAgentsParity_spec.js's structure.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'discuss-issue', 'scripts', 'confirm_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a confirm invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args]) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args);

    return { stdout, stderr, code: 0 };
  } catch (error) {
    return { stdout: error.stdout || '', stderr: error.stderr || '', code: error.code ?? 1 };
  }
}

describe('discuss-issue-confirm parity (shell vs. native)', () => {
  const AFFIRMATIVE_WORDS = ['yes', 'y', 'sim', 'correct', 'looks good', 'sure', 'ok', 'okay'];

  AFFIRMATIVE_WORDS.forEach((word) => {
    describe(`an affirmative reply ("${word}")`, () => {
      it('prints nothing and exits 0 on both sides', async () => {
        const shell = await runCommand([SHELL_SCRIPT, word]);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'discuss-issue-confirm', word]);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('');
      });
    });
  });

  describe('a negative reply ("no")', () => {
    it('prints nothing and exits 1 on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT, 'no']);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'discuss-issue-confirm', 'no']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('an unrecognized reply', () => {
    it('prints nothing and exits 1 on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT, 'maybe later']);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'discuss-issue-confirm', 'maybe later']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('a missing argument', () => {
    it('prints nothing and exits 1 on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT]);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'discuss-issue-confirm']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });
});

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "resolve-plan-paths" migrated entrypoint (issue
// #235) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/235-migrate-resolve-plan-paths-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs arcanum/_lib/resolve_plan_paths_shell.sh
// (invoked directly, NOT through the arcanum/_lib/resolve_plan_paths.sh
// engine_dispatch shim — so this test isn't circular) and
// `core/bin/arcanum resolve-plan-paths` against identical inputs/repo
// state, asserting byte-identical stdout and exit code. The two
// hard-failure cases additionally assert matching stderr content.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'resolve_plan_paths_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const ISSUES_FOLDER = 'issues';
const PLANS_FOLDER = 'plans';

/**
 * Run a resolve-plan-paths invocation (shell or native) and capture
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

describe('resolve-plan-paths parity (shell vs. native)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-rpp-parity-');
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);
    await mkdir(path.join(repoPath, ISSUES_FOLDER), { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} id - the issue id to resolve.
   * @returns {Promise<void>} resolves once both sides have been asserted equal.
   */
  async function assertParity(id) {
    const shell = await runCommand(
      [SHELL_SCRIPT, repoPath, ISSUES_FOLDER, PLANS_FOLDER, id],
      repoPath
    );
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'resolve-plan-paths', repoPath, ISSUES_FOLDER, PLANS_FOLDER, id],
      repoPath
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
  }

  describe('a matching issue file with no existing plan.md', () => {
    it('matches shell output byte-for-byte', async () => {
      await writeFile(path.join(repoPath, ISSUES_FOLDER, '42_my_cool_issue.md'), 'content\n');

      await assertParity('42');
    });
  });

  describe('a matching issue file with an existing plan.md', () => {
    it('matches shell output byte-for-byte', async () => {
      await writeFile(path.join(repoPath, ISSUES_FOLDER, '42_my_cool_issue.md'), 'content\n');
      await mkdir(path.join(repoPath, PLANS_FOLDER, '42_my_cool_issue'), { recursive: true });
      await writeFile(path.join(repoPath, PLANS_FOLDER, '42_my_cool_issue', 'plan.md'), 'plan\n');

      await assertParity('42');
    });
  });

  describe('a non-numeric id (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const shell = await runCommand(
        [SHELL_SCRIPT, repoPath, ISSUES_FOLDER, PLANS_FOLDER, 'abc'],
        repoPath
      );
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'resolve-plan-paths', repoPath, ISSUES_FOLDER, PLANS_FOLDER, 'abc'],
        repoPath
      );
      const expectedMessage =
        'Error: issue id must be numeric and linked to a GitHub issue (got \'abc\'). Local-only ids are no longer supported.';

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stderr.trim()).toEqual(expectedMessage);
      // core/bin/arcanum's generic dispatch catch prefixes uncaught
      // errors with "arcanum: " (see core/bin/arcanum) — that router
      // prefix isn't part of ResolvePlanPaths's own output contract, so
      // this asserts the underlying message content matches rather than
      // full-line byte equality.
      expect(native.stderr.trim()).toContain(expectedMessage);
    });
  });

  describe('no matching issue file', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const shell = await runCommand(
        [SHELL_SCRIPT, repoPath, ISSUES_FOLDER, PLANS_FOLDER, '999'],
        repoPath
      );
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'resolve-plan-paths', repoPath, ISSUES_FOLDER, PLANS_FOLDER, '999'],
        repoPath
      );
      const expectedMessage = 'Error: no issue file found for id 999';

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stderr.trim()).toEqual(expectedMessage);
      expect(native.stderr.trim()).toContain(expectedMessage);
    });
  });
});

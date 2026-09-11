import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-issue-list-plan-agents" migrated
// entrypoint (issue #431) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/431-migrate-auto-fix-issue-list-plan-agents-entrypoint-to-native-node-js/node.md's
// Notes. Runs
// auto-fix-issue/scripts/list_plan_agents_shell.sh (directly, NOT
// through the auto-fix-issue/scripts/list_plan_agents.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum
// auto-fix-issue-list-plan-agents` against equivalent fixture plan_dir
// inputs, asserting byte-identical stdout and exit code on both sides.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'list_plan_agents_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a list-plan-agents invocation (shell or native) and capture its
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

describe('auto-fix-issue-list-plan-agents parity (shell vs. native)', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  describe('a plan dir with several agent .md files plus plan.md', () => {
    it('prints the same agent names, in the same order, on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-plan-dir');
      const nativePlanDir = path.join(baseDir, 'native-plan-dir');

      await Promise.all([mkdir(shellPlanDir, { recursive: true }), mkdir(nativePlanDir, { recursive: true })]);

      for (const dir of [shellPlanDir, nativePlanDir]) {
        await writeFile(path.join(dir, 'plan.md'), '# Plan\n');
        await writeFile(path.join(dir, 'backend.md'), '# backend\n');
        await writeFile(path.join(dir, 'node.md'), '# node\n');
      }

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir]);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-list-plan-agents', nativePlanDir]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('backend\nnode\n');
    });
  });

  describe('a plan dir with only plan.md (no agent files)', () => {
    it('prints nothing on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-plan-dir');
      const nativePlanDir = path.join(baseDir, 'native-plan-dir');

      await Promise.all([mkdir(shellPlanDir, { recursive: true }), mkdir(nativePlanDir, { recursive: true })]);

      for (const dir of [shellPlanDir, nativePlanDir]) {
        await writeFile(path.join(dir, 'plan.md'), '# Plan\n');
      }

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir]);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-list-plan-agents', nativePlanDir]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('a plan dir that does not exist', () => {
    it('prints nothing and exits 0 on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-does-not-exist');
      const nativePlanDir = path.join(baseDir, 'native-does-not-exist');

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir]);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-list-plan-agents', nativePlanDir]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });
});

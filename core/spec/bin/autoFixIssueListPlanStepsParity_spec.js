import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-issue-list-plan-steps" migrated
// entrypoint (issue #432) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/432-migrate-auto-fix-issue-list-plan-steps-entrypoint-to-native-node-js/node.md's
// Notes. Runs
// auto-fix-issue/scripts/list_plan_steps_shell.sh (directly, NOT through
// the auto-fix-issue/scripts/list_plan_steps.sh engine_dispatch shim —
// so this test isn't circular) and `core/bin/arcanum
// auto-fix-issue-list-plan-steps` against equivalent fixture plan_dir
// inputs, asserting byte-identical stdout and exit code on both sides.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'list_plan_steps_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const AGENT_NAME = 'node';

/**
 * Run a list-plan-steps invocation (shell or native) and capture its
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

describe('auto-fix-issue-list-plan-steps parity (shell vs. native)', () => {
  let baseDir;

  beforeEach(async () => {
    baseDir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  describe('an agent dir with several step .md files', () => {
    it('prints the same full paths, in the same order, on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-plan-dir');
      const nativePlanDir = path.join(baseDir, 'native-plan-dir');
      const shellStepsDir = path.join(shellPlanDir, AGENT_NAME);
      const nativeStepsDir = path.join(nativePlanDir, AGENT_NAME);

      await Promise.all([mkdir(shellStepsDir, { recursive: true }), mkdir(nativeStepsDir, { recursive: true })]);

      for (const dir of [shellStepsDir, nativeStepsDir]) {
        await writeFile(path.join(dir, '02-second.md'), '# second\n');
        await writeFile(path.join(dir, '01-first.md'), '# first\n');
        await writeFile(path.join(dir, '03-third.md'), '# third\n');
      }

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir, AGENT_NAME]);
      const native = await runCommand([
        process.execPath,
        NATIVE_BIN,
        'auto-fix-issue-list-plan-steps',
        nativePlanDir,
        AGENT_NAME
      ]);

      const expectedShell = `${[
        path.join(shellStepsDir, '01-first.md'),
        path.join(shellStepsDir, '02-second.md'),
        path.join(shellStepsDir, '03-third.md')
      ].join('\n')}\n`;
      const expectedNative = `${[
        path.join(nativeStepsDir, '01-first.md'),
        path.join(nativeStepsDir, '02-second.md'),
        path.join(nativeStepsDir, '03-third.md')
      ].join('\n')}\n`;

      expect(shell.stdout).toEqual(expectedShell);
      expect(native.stdout).toEqual(expectedNative);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
    });
  });

  describe('an agent dir that exists but is empty', () => {
    it('prints nothing on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-plan-dir');
      const nativePlanDir = path.join(baseDir, 'native-plan-dir');

      await Promise.all([
        mkdir(path.join(shellPlanDir, AGENT_NAME), { recursive: true }),
        mkdir(path.join(nativePlanDir, AGENT_NAME), { recursive: true })
      ]);

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir, AGENT_NAME]);
      const native = await runCommand([
        process.execPath,
        NATIVE_BIN,
        'auto-fix-issue-list-plan-steps',
        nativePlanDir,
        AGENT_NAME
      ]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('an agent dir that does not exist under the plan dir', () => {
    it('prints nothing and exits 0 on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-plan-dir');
      const nativePlanDir = path.join(baseDir, 'native-plan-dir');

      await Promise.all([mkdir(shellPlanDir, { recursive: true }), mkdir(nativePlanDir, { recursive: true })]);

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir, AGENT_NAME]);
      const native = await runCommand([
        process.execPath,
        NATIVE_BIN,
        'auto-fix-issue-list-plan-steps',
        nativePlanDir,
        AGENT_NAME
      ]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('a plan dir that does not exist at all', () => {
    it('prints nothing and exits 0 on both sides', async () => {
      const shellPlanDir = path.join(baseDir, 'shell-does-not-exist');
      const nativePlanDir = path.join(baseDir, 'native-does-not-exist');

      const shell = await runCommand([SHELL_SCRIPT, shellPlanDir, AGENT_NAME]);
      const native = await runCommand([
        process.execPath,
        NATIVE_BIN,
        'auto-fix-issue-list-plan-steps',
        nativePlanDir,
        AGENT_NAME
      ]);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });
});

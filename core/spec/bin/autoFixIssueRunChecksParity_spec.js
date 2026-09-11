import { execFile } from 'node:child_process';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-issue-run-checks" migrated entrypoint
// (issue #434) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/434-migrate-auto-fix-issue-run-checks-entrypoint-to-native-node-js/node.md's
// Notes. Runs auto-fix-issue/scripts/run_checks_shell.sh (directly, NOT
// through the auto-fix-issue/scripts/run_checks.sh engine_dispatch shim
// — so this test isn't circular) and `core/bin/arcanum
// auto-fix-issue-run-checks` against equivalent fixture cwds, asserting
// byte-identical stdout and exit code on both sides.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'run_checks_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const AGENT = 'node';

/**
 * Run a run-checks invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the working directory to run the command in.
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
 * @param {string} dir - the directory to write the check script under
 *   (`<dir>/.claude/scripts/check_<AGENT>.sh`).
 * @param {string} content - the check script's contents.
 * @returns {Promise<void>} resolves once the script is written and made
 *   executable.
 */
async function writeCheckScript(dir, content) {
  const scriptsDir = path.join(dir, '.claude', 'scripts');

  await mkdir(scriptsDir, { recursive: true });

  const scriptPath = path.join(scriptsDir, `check_${AGENT}.sh`);

  await writeFile(scriptPath, content);
  await chmod(scriptPath, 0o755);
}

describe('auto-fix-issue-run-checks parity (shell vs. native)', () => {
  let baseDir;
  let shellDir;
  let nativeDir;

  beforeEach(async () => {
    baseDir = await createTempDir();
    shellDir = path.join(baseDir, 'shell-cwd');
    nativeDir = path.join(baseDir, 'native-cwd');

    await Promise.all([mkdir(shellDir, { recursive: true }), mkdir(nativeDir, { recursive: true })]);
  });

  afterEach(async () => {
    await removeTempDir(baseDir);
  });

  describe('no check script configured for the agent', () => {
    it('prints the same "no checks configured" message and exits 0 on both sides', async () => {
      const shell = await runCommand([SHELL_SCRIPT, AGENT], shellDir);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-run-checks', AGENT], nativeDir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(`No checks configured for agent '${AGENT}' — skipping.\n`);
    });
  });

  describe('a check script that exits 0 with stdout output', () => {
    it('streams the same stdout through and exits 0 on both sides', async () => {
      const script = '#!/usr/bin/env bash\necho "checks passed"\nexit 0\n';

      await Promise.all([writeCheckScript(shellDir, script), writeCheckScript(nativeDir, script)]);

      const shell = await runCommand([SHELL_SCRIPT, AGENT], shellDir);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-run-checks', AGENT], nativeDir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('checks passed\n');
    });
  });

  describe('a check script that exits nonzero', () => {
    it('propagates the same nonzero exit code on both sides', async () => {
      const script = '#!/usr/bin/env bash\necho "checks failed" >&2\nexit 1\n';

      await Promise.all([writeCheckScript(shellDir, script), writeCheckScript(nativeDir, script)]);

      const shell = await runCommand([SHELL_SCRIPT, AGENT], shellDir);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-issue-run-checks', AGENT], nativeDir);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    });
  });
});

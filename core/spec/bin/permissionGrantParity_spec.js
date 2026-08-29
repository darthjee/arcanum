import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "permission-grant" migrated entrypoint (issue
// #236) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/236-migrate-permission-grant-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs `bash arcanum/_lib/permission_grant_shell.sh`
// (the same invocation shape engine_dispatch.sh itself uses —
// `bash "$shell_script"` — invoked directly here, NOT through the
// arcanum/_lib/permission_grant.sh engine_dispatch shim, so this test
// isn't circular) and `core/bin/arcanum permission-grant` against
// identical fixture inputs, asserting byte-identical resulting JSON file
// content, stdout, and exit code.
//
// The usage message's leading `$0` portion isn't reproducible verbatim
// across the two invocations (the shell side reports its own script
// path, the native side reports a stable literal) — only the fixed
// `add <file> <pattern>` portion (and the exit code / empty stdout) is
// asserted there.
//
// `permission-grant` is a `context: 'claude'` command, so the native
// invocation takes a leading `<anchor>` argument that `Dispatcher`
// strips before calling `run(...)`. The parity fixtures pass absolute
// file paths, so the anchor value doesn't affect resolution — `cwd` is
// passed for it.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'permission_grant_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a permission-grant invocation (shell or native) and capture its
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
 * @param {string} shellFile - the settings file path passed to the shell side.
 * @param {string} nativeFile - the settings file path passed to the native side.
 * @param {string} pattern - the pattern argument to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(shellFile, nativeFile, pattern, cwd) {
  const shell = await runCommand(['bash', SHELL_SCRIPT, 'add', shellFile, pattern], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'permission-grant', cwd, 'add', nativeFile, pattern],
    cwd
  );

  return { shell, native };
}

describe('permission-grant parity (shell vs. native)', () => {
  let cwd;
  let shellFile;
  let nativeFile;

  beforeEach(async () => {
    cwd = await createTempDir('arcanum-core-pg-parity-');
    shellFile = path.join(cwd, 'shell', 'settings.json');
    nativeFile = path.join(cwd, 'native', 'settings.json');
  });

  afterEach(async () => {
    await removeTempDir(cwd);
  });

  describe('the file does not exist yet', () => {
    it('produces byte-identical resulting JSON, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(shellFile, nativeFile, 'Bash(git push:*)', cwd);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.stderr).toEqual(shell.stderr);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      const [shellContent, nativeContent] = await Promise.all([
        readFile(shellFile, 'utf8'),
        readFile(nativeFile, 'utf8')
      ]);

      expect(nativeContent).toEqual(shellContent);
      expect(JSON.parse(shellContent)).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
    });
  });

  describe('the file exists with unrelated top-level content', () => {
    it('produces byte-identical resulting JSON, stdout, and exit code', async () => {
      const initial = JSON.stringify({
        hooks: { PreToolUse: [] },
        permissions: { deny: ['Bash(rm -rf /:*)'], allow: ['Bash(git status:*)'] }
      });

      await mkdir(path.dirname(shellFile), { recursive: true });
      await mkdir(path.dirname(nativeFile), { recursive: true });
      await writeFile(shellFile, initial);
      await writeFile(nativeFile, initial);

      const { shell, native } = await runBoth(shellFile, nativeFile, 'Bash(git push:*)', cwd);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.stderr).toEqual(shell.stderr);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      const [shellContent, nativeContent] = await Promise.all([
        readFile(shellFile, 'utf8'),
        readFile(nativeFile, 'utf8')
      ]);

      expect(nativeContent).toEqual(shellContent);
      expect(JSON.parse(shellContent)).toEqual({
        hooks: { PreToolUse: [] },
        permissions: {
          deny: ['Bash(rm -rf /:*)'],
          allow: ['Bash(git push:*)', 'Bash(git status:*)']
        }
      });
    });
  });

  describe('the pattern is already present', () => {
    it('dedupes identically (no duplicate entry) on both sides', async () => {
      const initial = JSON.stringify({ permissions: { allow: ['Bash(git push:*)'] } });

      await mkdir(path.dirname(shellFile), { recursive: true });
      await mkdir(path.dirname(nativeFile), { recursive: true });
      await writeFile(shellFile, initial);
      await writeFile(nativeFile, initial);

      const { shell, native } = await runBoth(shellFile, nativeFile, 'Bash(git push:*)', cwd);

      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      const [shellContent, nativeContent] = await Promise.all([
        readFile(shellFile, 'utf8'),
        readFile(nativeFile, 'utf8')
      ]);

      expect(nativeContent).toEqual(shellContent);
      expect(JSON.parse(shellContent)).toEqual({ permissions: { allow: ['Bash(git push:*)'] } });
    });
  });

  describe('an unrecognized action', () => {
    it('matches exit code and empty stdout, with the fixed usage-message portion in stderr', async () => {
      const shell = await runCommand(['bash', SHELL_SCRIPT, 'remove', shellFile, 'Bash(git push:*)'], cwd);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'permission-grant', cwd, 'remove', nativeFile, 'Bash(git push:*)'],
        cwd
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain('Usage:');
      expect(shell.stderr.trim()).toContain('add <file> <pattern>');
      expect(native.stderr.trim()).toContain('Usage:');
      expect(native.stderr.trim()).toContain('add <file> <pattern>');
    });
  });
});

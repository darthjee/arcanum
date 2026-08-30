import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "issue-state" migrated entrypoint (issue #238) —
// see docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/238-migrate-issue-state-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs arcanum/_lib/issue_state_shell.sh (invoked
// directly, NOT through the arcanum/_lib/issue_state.sh engine_dispatch
// shim — so this test isn't circular) and `core/bin/arcanum issue-state`
// against identical inputs applied to separate (but identically seeded)
// temp repos, asserting byte-identical stdout, exit code, and resulting
// `.claude/state/issue-<id>.json` content.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'issue_state_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run an issue-state invocation (shell or native) and capture its
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

describe('issue-state parity (shell vs. native)', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createTempDir('arcanum-core-is-parity-shell-');
    nativeRepo = await createTempDir('arcanum-core-is-parity-native-');
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', shellRepo]);
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', nativeRepo]);
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  /**
   * @param {string[]} args - the `<subcommand> <id> <field> [value]` args.
   * @returns {Promise<{shell: object, native: object}>} both sides' results.
   */
  async function runBoth(args) {
    const shell = await runCommand([SHELL_SCRIPT, shellRepo, ...args], shellRepo);
    const native = await runCommand([process.execPath, NATIVE_BIN, 'issue-state', nativeRepo, ...args], nativeRepo);

    return { shell, native };
  }

  /**
   * @param {string} id - the issue id whose state file to compare.
   * @returns {Promise<void>} resolves once asserted equal (or both absent).
   */
  async function assertStateFilesMatch(id) {
    const shellFile = path.join(shellRepo, '.claude', 'state', `issue-${id}.json`);
    const nativeFile = path.join(nativeRepo, '.claude', 'state', `issue-${id}.json`);

    const [shellContent, nativeContent] = await Promise.all([
      readFile(shellFile, 'utf8').catch(() => null),
      readFile(nativeFile, 'utf8').catch(() => null)
    ]);

    expect(nativeContent).toEqual(shellContent);
  }

  describe('get on a missing state file', () => {
    it('matches shell stdout and exit code (empty output, exit 0)', async () => {
      const { shell, native } = await runBoth(['get', '42', 'title']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('get on a missing field', () => {
    it('matches shell stdout and exit code (empty output, exit 0)', async () => {
      await runBoth(['set', '42', 'state', 'open']);

      const { shell, native } = await runBoth(['get', '42', 'title']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    });
  });

  describe('get on an existing field', () => {
    it('matches shell stdout and exit code', async () => {
      await runBoth(['set', '42', 'title', 'A Title']);

      const { shell, native } = await runBoth(['get', '42', 'title']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('A Title\n');
    });
  });

  describe('set creating a new field', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set', '42', 'title', 'A Title']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');

      await assertStateFilesMatch('42');
    });
  });

  describe('set overwriting an existing field', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      await runBoth(['set', '42', 'title', 'First']);

      const { shell, native } = await runBoth(['set', '42', 'title', 'Second']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42');
    });
  });

  describe('set-json with an object value', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set-json', '42', 'meta', '{"priority":"high"}']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42');
    });
  });

  describe('set-json with an array value', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['set-json', '42', 'tags', '["a","b"]']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42');
    });
  });

  describe('append-json on a field that does not exist yet', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      const { shell, native } = await runBoth(['append-json', '42', 'tags', '"a"']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42');
    });
  });

  describe('append-json on a field that is already an array', () => {
    it('produces byte-identical resulting state-file content, stdout, and exit code', async () => {
      await runBoth(['set-json', '42', 'tags', '["a","b"]']);

      const { shell, native } = await runBoth(['append-json', '42', 'tags', '"c"']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(0);

      await assertStateFilesMatch('42');
    });
  });

  describe('missing required args', () => {
    it('matches exit code and empty stdout, with the substantive usage text in stderr', async () => {
      const shell = await runCommand([SHELL_SCRIPT, shellRepo], shellRepo);
      const native = await runCommand([process.execPath, NATIVE_BIN, 'issue-state', nativeRepo], nativeRepo);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain('Usage:');
      expect(shell.stderr.trim()).toContain('<repo_path> get <id> <field>');
      expect(native.stderr.trim()).toContain('Usage:');
      expect(native.stderr.trim()).toContain('<repo_path> get <id> <field>');
    });
  });

  describe('an unknown subcommand', () => {
    it('matches exit code and empty stdout, with the "Unknown command" text in stderr', async () => {
      const { shell, native } = await runBoth(['bogus', '42', 'title']);

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain('Unknown command: bogus');
      expect(native.stderr.trim()).toContain('Unknown command: bogus');
    });
  });

  describe('a present-but-non-directory repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const missingShell = path.join(shellRepo, 'no-such-dir');
      const missingNative = path.join(nativeRepo, 'no-such-dir');
      const shell = await runCommand([SHELL_SCRIPT, missingShell, 'get', '42', 'title'], shellRepo);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'issue-state', missingNative, 'get', '42', 'title'],
        nativeRepo
      );

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingShell}`);
      expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingNative}`);
    });
  });

  describe('a non-git repo_path', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const nonGit = await createTempDir('arcanum-core-is-parity-nongit-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, nonGit, 'get', '42', 'title'], shellRepo);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'issue-state', nonGit, 'get', '42', 'title'],
          nativeRepo
        );

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${nonGit}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${nonGit}`);
      } finally {
        await removeTempDir(nonGit);
      }
    });
  });
});

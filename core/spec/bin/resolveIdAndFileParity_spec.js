import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "resolve-id-and-file" migrated entrypoint (issue
// #227) — see docs/agents/architecture/script-engine.md's "output/
// exit-code contract" and
// docs/agents/plans/227-migrat-next-entry-point-to-use-native-nodejs/plan.md's
// "Shared contracts". Runs arcanum/_lib/resolve_id_and_file_shell.sh
// (invoked directly, NOT through the arcanum/_lib/resolve_id_and_file.sh
// engine_dispatch shim — so this test isn't circular) and
// `core/bin/arcanum resolve-id-and-file` against identical inputs/repo
// state, asserting byte-identical stdout and exit code. The hard-failure
// (non-numeric id) case additionally asserts an identical stderr
// message, per node/04-parity-test.md.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum', '_lib', 'resolve_id_and_file_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const ISSUES_FOLDER = 'issues';

/**
 * Run a resolve-id-and-file invocation (shell or native) and capture
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

describe('resolve-id-and-file parity (shell vs. native)', () => {
  let repoPath;

  beforeEach(async () => {
    repoPath = await createTempDir('arcanum-core-riaf-parity-');
    await execFileAsync('git', ['init', '--quiet', '-b', 'main', repoPath]);
    await mkdir(path.join(repoPath, ISSUES_FOLDER), { recursive: true });
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {string} argString - the raw resolve-id-and-file input.
   * @returns {Promise<void>} resolves once both sides have been asserted equal.
   */
  async function assertParity(argString) {
    const shell = await runCommand([SHELL_SCRIPT, repoPath, ISSUES_FOLDER, argString], repoPath);
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'resolve-id-and-file', repoPath, ISSUES_FOLDER, argString],
      repoPath
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
  }

  describe('Scenario A — id and title provided', () => {
    it('matches shell output byte-for-byte with an existing-file match', async () => {
      await writeFile(path.join(repoPath, ISSUES_FOLDER, '42_my_cool_issue.md'), 'content\n');

      await assertParity('#42 My Cool Issue');
    });

    it('matches shell output byte-for-byte with no existing-file match', async () => {
      await assertParity('#123 A Fresh New Issue');
    });
  });

  describe('Scenario B — bare title, no id', () => {
    it('matches shell output byte-for-byte', async () => {
      await assertParity('bare title, no leading hash');
    });
  });

  describe('Scenario C — id only, no title', () => {
    it('matches shell output byte-for-byte with an underscore-separated existing-file match', async () => {
      await writeFile(path.join(repoPath, ISSUES_FOLDER, '42_my_cool_issue.md'), 'content\n');

      await assertParity('#42');
    });

    it('matches shell output byte-for-byte with a dash-separated existing-file match', async () => {
      await writeFile(path.join(repoPath, ISSUES_FOLDER, '7-some-title-here.md'), 'content\n');

      await assertParity('#7');
    });

    it('matches shell output byte-for-byte with no existing-file match', async () => {
      await assertParity('#999');
    });
  });

  describe('a non-numeric id (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const shell = await runCommand([SHELL_SCRIPT, repoPath, ISSUES_FOLDER, '#abc title'], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'resolve-id-and-file', repoPath, ISSUES_FOLDER, '#abc title'],
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
      // prefix isn't part of ResolveIdAndFile's own output contract, so
      // this asserts the underlying message content matches rather than
      // full-line byte equality.
      expect(native.stderr.trim()).toContain(expectedMessage);
    });
  });

  describe('a present-but-non-directory repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const missingPath = path.join(repoPath, 'no-such-dir');
      const shell = await runCommand([SHELL_SCRIPT, missingPath, ISSUES_FOLDER, '#42 Title'], repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'resolve-id-and-file', missingPath, ISSUES_FOLDER, '#42 Title'],
        repoPath
      );
      const expectedMessage = `Error: not a directory: ${missingPath}`;

      expect(shell.stdout).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.code).toEqual(shell.code);
      expect(shell.code).not.toEqual(0);
      expect(shell.stderr.trim()).toEqual(expectedMessage);
      expect(native.stderr.trim()).toContain(expectedMessage);
    });
  });

  describe('a non-git repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const nonGit = await createTempDir('arcanum-core-riaf-parity-nongit-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, nonGit, ISSUES_FOLDER, '#42 Title'], repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'resolve-id-and-file', nonGit, ISSUES_FOLDER, '#42 Title'],
          repoPath
        );
        const expectedMessage = `Error: not a git repository: ${nonGit}`;

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(expectedMessage);
        expect(native.stderr.trim()).toContain(expectedMessage);
      } finally {
        await removeTempDir(nonGit);
      }
    });
  });
});

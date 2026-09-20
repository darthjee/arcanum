import path from 'node:path';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

/**
 * Shared example: a required CLI argument is missing. Registers a
 * `describe(description, ...)` block asserting shell/native parity —
 * both sides exit non-zero with empty stdout, and native's stdout/exit
 * code match shell's exactly.
 * @param {string} description - the `describe` block's label (e.g.
 *   `'a missing <repo_path> argument'`).
 * @param {(cwd: string) => Promise<{shell: object, native: object}>} invoke
 *   - runs the shell and native commands for this scenario against
 *   `cwd`, already bound to whatever args/fixture this scenario needs.
 * @param {() => Promise<{cwd: string, cleanup: () => Promise<void>}>} cwdFactory
 *   - creates the working directory to pass to `invoke`, and returns
 *   how to clean it up afterwards.
 * @returns {void}
 */
export function itRejectsMissingArgument(description, invoke, cwdFactory) {
  describe(description, () => {
    it('matches shell exit code and stdout', async () => {
      const { cwd, cleanup } = await cwdFactory();

      try {
        const { shell, native } = await invoke(cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await cleanup();
      }
    });
  });
}

/**
 * Shared example: an invalid `repo_path` (present but not a directory,
 * or a directory that isn't a git repository) is rejected identically
 * by shell and native. Registers the two `describe` blocks used across
 * every CLI-parity spec for this pair of scenarios.
 * @param {(repoPath: string, cwd: string) => Promise<{shell: object, native: object}>} invoke
 *   - runs the shell and native commands for this scenario, substituting
 *   `repoPath` into whatever `<repo_path>` argument slot this command
 *   uses, and running both processes in `cwd`.
 * @param {object} [options] - per-file wording/behavior overrides.
 * @param {string} [options.notDirectoryDescribe] - the "not a directory"
 *   scenario's `describe` label.
 * @param {string} [options.notGitRepoDescribe] - the "not a git
 *   repository" scenario's `describe` label.
 * @param {string} [options.itDescription] - both scenarios' `it` label.
 * @param {boolean} [options.assertShellStderr] - whether to assert an
 *   exact match on `shell.stderr` (some commands compose other shims
 *   rather than validating `repo_path` directly, so their own stderr
 *   wording isn't byte-identical to the native dispatcher's — only the
 *   stdout/exit-code contract is, for those).
 * @param {string} [options.cwdPrefix] - the temp dir prefix to use.
 * @returns {void}
 */
export function itRejectsInvalidRepoPath(invoke, options = {}) {
  const {
    notDirectoryDescribe = 'a repo_path that is not a directory',
    notGitRepoDescribe = 'a repo_path that is not a git repository',
    itDescription = 'matches shell exit code, stdout, and stderr message',
    assertShellStderr = true,
    cwdPrefix = 'arcanum-core-parity-'
  } = options;

  describe(notDirectoryDescribe, () => {
    it(itDescription, async () => {
      const cwd = await createTempDir(cwdPrefix);

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await invoke(missingPath, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');

        if (assertShellStderr) {
          expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        }
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe(notGitRepoDescribe, () => {
    it(itDescription, async () => {
      const cwd = await createTempDir(cwdPrefix);

      try {
        const { shell, native } = await invoke(cwd, cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');

        if (assertShellStderr) {
          expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        }
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
}

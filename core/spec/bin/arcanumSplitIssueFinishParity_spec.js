import { execFile } from 'node:child_process';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "arcanum-split-issue-finish" migrated entrypoint
// (issue #255) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/255-migrate-arcanum-split-issue-finish-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs arcanum-split-issue/scripts/finish_shell.sh
// (directly, NOT through the arcanum-split-issue/scripts/finish.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-finish` against identical inputs/repo state,
// asserting byte-identical stdout and exit code for both.
//
// Scoped to offline-reachable, deterministic failure paths only — the
// success path needs a real `gh`/GitHub-API call (`mark-split`), which
// isn't reachable from specs per the repo-wide "no real network calls in
// specs" rule. That includes the "mark-split itself would need real
// network access" case below. Both sides resolve `github.sh` from their
// own install directory — `finish_shell.sh` via `"${SCRIPT_DIR}/github.sh"`
// and the native module via its own module directory (three levels up
// from `core/lib/commands/`), never relative to the target `repoPath` —
// so the fixture repo carries no copy of the skill tree. What drives
// `github.sh mark-split` to fail, deterministically and offline, is the
// fixture's `origin` remote being a local filesystem path: enough to
// make `arcanum/_lib/origin.sh`'s `_load_origin` (which
// `github_issue_shell.sh`'s `mark-split` command calls before ever
// touching `gh`) fail with "unrecognized origin format", exactly
// mirroring what happens for any origin `mark-split` can't resolve —
// including a real GitHub remote unreachable over the network. Both
// `finish_shell.sh` and the native module shell out to `github.sh
// mark-split` before doing any file cleanup or safe-branch release, so
// this exercises the "same point of failure" contract from node.md's
// step 04 without flaking on network availability.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'arcanum-split-issue', 'scripts', 'finish_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a arcanum-split-issue-finish invocation (shell or native) and
 * capture its stdout/stderr/exit code.
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
 * @param {string[]} args - the `<repo_path> <issue_id>` arguments to
 *   pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand([process.execPath, NATIVE_BIN, 'arcanum-split-issue-finish', ...args], cwd);

  return { shell, native };
}

describe('arcanum-split-issue-finish parity (shell vs. native)', () => {
  describe('a missing <repo_path> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-asif-parity-');

      try {
        const { shell, native } = await runBoth(['', '999'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a missing <issue_id> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, ''], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a repo_path that is not a directory', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-asif-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');

        const { shell, native } = await runBoth([missingPath, '999'], cwd);

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

  describe('a repo_path that is not a git repository', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-asif-parity-');

      try {
        const { shell, native } = await runBoth([cwd, '999'], cwd);

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

  describe('mark-split failing before the cleanup step (deterministic, offline)', () => {
    it('matches shell exit code and stdout — both fail with no Deleted:/BRANCH= output and leave the working files untouched', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const issuesDir = path.join(repo.repoPath, 'docs', 'agents', 'issues');
        const workingFile = path.join(issuesDir, '999-split.md');

        await mkdir(issuesDir, { recursive: true });
        await writeFile(workingFile, 'a split working file\n');

        const { shell, native } = await runBoth([repo.repoPath, '999'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stdout).not.toContain('Deleted:');
        expect(shell.stdout).not.toContain('BRANCH=');
        expect(shell.stderr).toContain('Error: unrecognized origin format:');

        // mark-split runs before the cleanup step in both
        // implementations, so a failure there must leave the working
        // file exactly as seeded.
        const remaining = await readdir(issuesDir);

        expect(remaining).toContain('999-split.md');
      } finally {
        await repo.cleanup();
      }
    });
  });
});

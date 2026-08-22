import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "arcanum-split-issue-create-sub-issue-file" migrated
// entrypoint (issue #257) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/create_sub_issue_file_shell.sh (directly,
// NOT through the arcanum-split-issue/scripts/create_sub_issue_file.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-create-sub-issue-file` against identical
// inputs/repo state, asserting byte-identical stdout and exit code for
// both. Purely filesystem-based — no `gh`/network dependency — so both
// failure and success paths are exercised here.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(
  REPO_ROOT,
  'arcanum-split-issue',
  'scripts',
  'create_sub_issue_file_shell.sh'
);
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * Run a arcanum-split-issue-create-sub-issue-file invocation (shell or
 * native) and capture its stdout/stderr/exit code.
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
 * @param {string[]} args - the `<repo_path> <issue_id> <title>
 *   <body_file>` arguments to pass to both sides.
 * @param {string} cwd - the directory to run both commands in.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runBoth(args, cwd) {
  const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue-file', ...args],
    cwd
  );

  return { shell, native };
}

describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native)', () => {
  describe('a missing <repo_path> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const { shell, native } = await runBoth(['', '999', 'Title', '/dev/null'], cwd);

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
        const { shell, native } = await runBoth([repo.repoPath, '', 'Title', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <title> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '999', '', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <body_file> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '999', 'Title', ''], repo.repoPath);

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
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');

        const { shell, native } = await runBoth([missingPath, '999', 'Title', '/dev/null'], cwd);

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
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const { shell, native } = await runBoth([cwd, '999', 'Title', '/dev/null'], cwd);

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

  describe('a body_file that does not exist', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const missingBodyFile = path.join(repo.repoPath, 'missing-body.md');

        const { shell, native } = await runBoth(
          [repo.repoPath, '999', 'Title', missingBodyFile],
          repo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingBodyFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingBodyFile}`);
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('the success path', () => {
    it('matches shell exit code and FILE=... stdout, and counting is gap-tolerant across separate shell/native runs', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const bodyFile = path.join(repo.repoPath, 'body.md');

        await writeFile(bodyFile, 'body content\n');

        const { shell, native } = await runBoth(
          [repo.repoPath, '999', 'Hello, World! Foo-Bar', bodyFile],
          repo.repoPath
        );

        expect(shell.code).toEqual(0);
        expect(native.code).toEqual(shell.code);
        expect(shell.stdout).toEqual('FILE=docs/agents/issues/999_01_hello_world_foo_bar.md\n');
        expect(native.stdout).toEqual('FILE=docs/agents/issues/999_02_hello_world_foo_bar.md\n');

        const shellWritten = await readFile(
          path.join(repo.repoPath, 'docs', 'agents', 'issues', '999_01_hello_world_foo_bar.md'),
          'utf8'
        );
        const nativeWritten = await readFile(
          path.join(repo.repoPath, 'docs', 'agents', 'issues', '999_02_hello_world_foo_bar.md'),
          'utf8'
        );

        expect(shellWritten).toEqual('# Hello, World! Foo-Bar\n\nbody content\n');
        expect(nativeWritten).toEqual(shellWritten);
      } finally {
        await repo.cleanup();
      }
    });

    it('increments the same count sequence for shell and native when run against the same directory state', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const issuesDir = path.join(repo.repoPath, 'docs', 'agents', 'issues');
        const bodyFile = path.join(repo.repoPath, 'body.md');

        await mkdir(issuesDir, { recursive: true });
        await writeFile(bodyFile, '');

        const shellResult = await runCommand(
          [SHELL_SCRIPT, repo.repoPath, '999', 'Shell Entry', bodyFile],
          repo.repoPath
        );

        expect(shellResult.code).toEqual(0);
        expect(shellResult.stdout).toEqual('FILE=docs/agents/issues/999_01_shell_entry.md\n');

        const nativeResult = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue-file', repo.repoPath, '999', 'Native Entry', bodyFile],
          repo.repoPath
        );

        expect(nativeResult.code).toEqual(0);
        expect(nativeResult.stdout).toEqual('FILE=docs/agents/issues/999_02_native_entry.md\n');
      } finally {
        await repo.cleanup();
      }
    });
  });
});

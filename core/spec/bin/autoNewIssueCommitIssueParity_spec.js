import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-new-issue-commit-issue" migrated entrypoint
// (issue #450) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/450-migrate-auto-new-issue-commit-issue-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// auto-new-issue/scripts/commit_issue_shell.sh (directly, NOT through
// the auto-new-issue/scripts/commit_issue.sh engine_dispatch shim — so
// this test isn't circular) and `core/bin/arcanum
// auto-new-issue-commit-issue` against equivalent inputs/repo state,
// asserting byte-identical stdout and exit code.
//
// Each fixture repo gets its identity set via `git config user.*`, same
// as `commit.gpgsign` already is in `createGitFixtureRepo` — matching
// this migration's Notes ("HOME is present in process.env when invoked
// natively"), both scripts resolve the committer's identity the same
// way regardless.
//
// Neither commit_issue_shell.sh nor the native side redirects `git
// commit`'s own stdout, so every non-error case's stdout is genuinely
// non-empty on both sides — `git commit`'s own `[branch hash] subject`
// summary block, relayed verbatim for parity. The one inherently
// non-deterministic part of that block — the abbreviated commit hash,
// necessarily distinct per fixture repo — is normalized out via
// `normalizeCommitHash` before comparison.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-new-issue', 'scripts', 'commit_issue_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';

/**
 * Run a commit-issue invocation (shell or native) and capture its
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
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<{stdout: string}>} the command's stdout.
 */
async function git(args, cwd) {
  return execFileAsync('git', args, { cwd });
}

/**
 * Configure a fixture repo's committer identity via repo-local git
 * config (not `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env overrides), so `git
 * commit` succeeds deterministically regardless of the host's global
 * `~/.gitconfig`.
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @returns {Promise<void>} resolves once configured.
 */
async function configureIdentity(repoPath) {
  await git(['config', 'user.name', 'Test'], repoPath);
  await git(['config', 'user.email', 't@example.com'], repoPath);
}

/**
 * Create the issue file a `commit-issue` invocation is expected to
 * stage/commit.
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @returns {Promise<string>} the created issue file's absolute path.
 */
async function createIssueFile(repoPath) {
  const issueDir = path.join(repoPath, 'docs', 'agents', 'issues');
  const filePath = path.join(issueDir, '999-some-issue.md');

  await mkdir(issueDir, { recursive: true });
  await writeFile(filePath, '# Issue\n');

  return filePath;
}

/**
 * Neutralize the one genuinely non-deterministic substring in `git
 * commit`'s own stdout summary — its abbreviated commit hash, which
 * necessarily differs between the shell run's commit and the native
 * run's commit even given otherwise-identical repo state, since each
 * side commits into its own isolated fixture repo.
 * @param {string} text - raw stdout to normalize.
 * @returns {string} `text` with any `[<branch> <hash>]`-shaped commit
 *   hash replaced by a fixed placeholder.
 */
function normalizeCommitHash(text) {
  return text.replace(/\[([^\]\s]+(?: \([^)]+\))?) [0-9a-f]{7,40}\]/, '[$1 <hash>]');
}

describe('auto-new-issue-commit-issue parity (shell vs. native)', () => {
  describe('happy path', () => {
    it('matches shell exit code and stdout, and produces the same commit message', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([configureIdentity(shellRepo.repoPath), configureIdentity(nativeRepo.repoPath)]);
        const [shellFilePath, nativeFilePath] = await Promise.all([
          createIssueFile(shellRepo.repoPath),
          createIssueFile(nativeRepo.repoPath)
        ]);

        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, shellFilePath, ID, MODEL_NAME, MODEL_EMAIL], shellRepo.repoPath
        );
        const native = await runCommand(
          [
            process.execPath, NATIVE_BIN, 'auto-new-issue-commit-issue',
            nativeRepo.repoPath, nativeFilePath, ID, MODEL_NAME, MODEL_EMAIL
          ],
          nativeRepo.repoPath
        );

        expect(normalizeCommitHash(native.stdout)).toEqual(normalizeCommitHash(shell.stdout));
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain('docs(issue): add issue file (issue #999)');

        const [shellLog, nativeLog] = await Promise.all([
          git(['log', '-1', '--format=%s%n%n%b'], shellRepo.repoPath),
          git(['log', '-1', '--format=%s%n%n%b'], nativeRepo.repoPath)
        ]);

        expect(nativeLog.stdout).toEqual(shellLog.stdout);
        expect(shellLog.stdout).toContain('Co-Authored-By: Node Agent <node@example.com>');
        expect(shellLog.stdout).toContain('Co-Authored-By: architect agent <node@example.com>');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('model_coauthor_omitted=true (via repo-local config)', () => {
    it('omits the model Co-Authored-By trailer identically on both sides', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([configureIdentity(shellRepo.repoPath), configureIdentity(nativeRepo.repoPath)]);
        const [shellFilePath, nativeFilePath] = await Promise.all([
          createIssueFile(shellRepo.repoPath),
          createIssueFile(nativeRepo.repoPath)
        ]);
        await Promise.all([
          mkdir(path.join(shellRepo.repoPath, '.claude', 'configuration'), { recursive: true }),
          mkdir(path.join(nativeRepo.repoPath, '.claude', 'configuration'), { recursive: true })
        ]);
        const repoConfig = JSON.stringify({ git: { omit_model_coauthor: true } });

        await Promise.all([
          writeFile(
            path.join(shellRepo.repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), repoConfig
          ),
          writeFile(
            path.join(nativeRepo.repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), repoConfig
          )
        ]);

        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, shellFilePath, ID, MODEL_NAME, MODEL_EMAIL], shellRepo.repoPath
        );
        const native = await runCommand(
          [
            process.execPath, NATIVE_BIN, 'auto-new-issue-commit-issue',
            nativeRepo.repoPath, nativeFilePath, ID, MODEL_NAME, MODEL_EMAIL
          ],
          nativeRepo.repoPath
        );

        expect(normalizeCommitHash(native.stdout)).toEqual(normalizeCommitHash(shell.stdout));
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);

        const [shellLog, nativeLog] = await Promise.all([
          git(['log', '-1', '--format=%s%n%n%b'], shellRepo.repoPath),
          git(['log', '-1', '--format=%s%n%n%b'], nativeRepo.repoPath)
        ]);

        expect(nativeLog.stdout).toEqual(shellLog.stdout);
        expect(shellLog.stdout).not.toContain(`Co-Authored-By: ${MODEL_NAME}`);
        expect(shellLog.stdout).toContain('Co-Authored-By: architect agent');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('file_path does not exist on disk (hard failure)', () => {
    it('matches shell exit code and stderr-driven stdout emptiness', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([configureIdentity(shellRepo.repoPath), configureIdentity(nativeRepo.repoPath)]);

        const missingFilePath = path.join(shellRepo.repoPath, 'docs', 'agents', 'issues', 'does-not-exist.md');
        const missingNativeFilePath = path.join(
          nativeRepo.repoPath, 'docs', 'agents', 'issues', 'does-not-exist.md'
        );

        const shell = await runCommand(
          [SHELL_SCRIPT, shellRepo.repoPath, missingFilePath, ID, MODEL_NAME, MODEL_EMAIL], shellRepo.repoPath
        );
        const native = await runCommand(
          [
            process.execPath, NATIVE_BIN, 'auto-new-issue-commit-issue',
            nativeRepo.repoPath, missingNativeFilePath, ID, MODEL_NAME, MODEL_EMAIL
          ],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });

  describe('a missing required argument (hard failure)', () => {
    it('matches shell exit code, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-ancci-parity-');

      try {
        const args = ['some-file-path', ID, MODEL_NAME, ''];

        const shell = await runCommand([SHELL_SCRIPT, cwd, ...args], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-new-issue-commit-issue', cwd, ...args],
          cwd
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';

// Parity test for the "auto-fix-all-cleanup-artifacts" migrated
// entrypoint (issue #254) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/254-migrate-auto-fix-all-cleanup-artifacts-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs
// auto-fix-all/scripts/cleanup_artifacts_shell.sh (directly, NOT through
// the auto-fix-all/scripts/cleanup_artifacts.sh engine_dispatch shim —
// so this test isn't circular) and `core/bin/arcanum
// auto-fix-all-cleanup-artifacts` against equivalent inputs/repo state,
// asserting byte-identical stdout and exit code for both the "nothing
// staged" and "something staged" cases. No `HOME`/env overrides are
// applied here — both scripts resolve the committer's identity from git
// config the same way (matching the Notes in node.md), so each fixture
// repo gets its identity set via `git config user.*`, same as
// `commit.gpgsign` already is in `createGitFixtureRepo`.
//
// Neither cleanup_artifacts_shell.sh nor the native side redirects `git
// commit`'s own stdout (only the `git rm` calls are silenced with
// `>/dev/null`/discarded), so the "something staged" case's stdout is
// genuinely non-empty on both sides — `git commit`'s own `[branch hash]
// subject` summary block, which the native implementation deliberately
// relays verbatim for parity rather than swallowing it (see
// AutoFixAllCleanupArtifacts.js's `run` doc). The one inherently
// non-deterministic part of that block — the abbreviated commit hash,
// which necessarily differs between the shell run's commit and the
// native run's commit since each writes into its own isolated fixture
// repo — is normalized out via `normalizeCommitHash` before comparison.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'cleanup_artifacts_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const ISSUE_FILE = 'docs/agents/issues/999-test.md';
const PLAN_DIR = 'docs/agents/plans/999-test';
const ID = '999';
const MODEL_NAME = 'Node Agent';
const MODEL_EMAIL = 'node@example.com';

/**
 * Run a cleanup-artifacts invocation (shell or native) and capture its
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
 * config (not `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env overrides — see this
 * file's header comment), so `git commit` succeeds deterministically
 * regardless of the host's global `~/.gitconfig`.
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @returns {Promise<void>} resolves once configured.
 */
async function configureIdentity(repoPath) {
  await git(['config', 'user.name', 'Test'], repoPath);
  await git(['config', 'user.email', 't@example.com'], repoPath);
}

/**
 * Neutralize the one genuinely non-deterministic substring in `git
 * commit`'s own stdout summary — its abbreviated commit hash, which
 * necessarily differs between the shell run's commit and the native
 * run's commit even given otherwise-identical repo state, since each
 * side commits into its own isolated fixture repo. Everything else in
 * that summary (subject line, changed-file stats) is expected to match
 * exactly.
 * @param {string} text - raw stdout to normalize.
 * @returns {string} `text` with any `[<branch> <hash>]`-shaped commit
 *   hash replaced by a fixed placeholder.
 */
function normalizeCommitHash(text) {
  return text.replace(/\[([^\]\s]+(?: \([^)]+\))?) [0-9a-f]{7,40}\]/, '[$1 <hash>]');
}

/**
 * Seed `repoPath` with a tracked, committed, pushed issue file + plan
 * dir at `ISSUE_FILE`/`PLAN_DIR`, so a cleanup-artifacts run against it
 * has something to stage.
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @returns {Promise<void>} resolves once seeded and pushed.
 */
async function seedArtifacts(repoPath) {
  await mkdir(path.dirname(path.join(repoPath, ISSUE_FILE)), { recursive: true });
  await mkdir(path.join(repoPath, PLAN_DIR), { recursive: true });
  await writeFile(path.join(repoPath, ISSUE_FILE), 'issue\n');
  await writeFile(path.join(repoPath, PLAN_DIR, 'plan.md'), 'plan\n');
  await git(['add', '-A'], repoPath);
  await git(['commit', '-m', 'seed planning artifacts'], repoPath);
  await git(['push', 'origin', 'main'], repoPath);
}

describe('auto-fix-all-cleanup-artifacts parity (shell vs. native)', () => {
  describe('nothing staged (issue file and plan dir untracked)', () => {
    it('matches shell exit code and stdout — both no-op silently', async () => {
      const repo = await createGitFixtureRepo();

      try {
        await configureIdentity(repo.repoPath);

        const args = [repo.repoPath, ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL];

        const shell = await runCommand([SHELL_SCRIPT, ...args], repo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-cleanup-artifacts', ...args],
          repo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('something staged (issue file and plan dir tracked)', () => {
    it('matches shell exit code and stdout, and produces the same commit message', async () => {
      // Each side needs its own isolated repo — running both against a
      // shared repo would mean the second invocation sees the first
      // one's already-committed, already-pushed state instead of an
      // equivalent starting point.
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([configureIdentity(shellRepo.repoPath), configureIdentity(nativeRepo.repoPath)]);
        await Promise.all([seedArtifacts(shellRepo.repoPath), seedArtifacts(nativeRepo.repoPath)]);

        const args = [ISSUE_FILE, PLAN_DIR, ID, MODEL_NAME, MODEL_EMAIL];

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...args], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-cleanup-artifacts', nativeRepo.repoPath, ...args],
          nativeRepo.repoPath
        );

        // Neither side redirects `git commit`'s own stdout (only the
        // `git rm` calls are silenced), so both leak that summary block
        // to stdout, byte-identical modulo the necessarily-distinct
        // commit hash each side's separate fixture repo produces.
        expect(normalizeCommitHash(native.stdout)).toEqual(normalizeCommitHash(shell.stdout));
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain(`chore(docs): remove planning artifacts (issue #${ID})`);

        const [shellLog, nativeLog] = await Promise.all([
          git(['log', '-1', '--format=%s%n%n%b'], shellRepo.repoPath),
          git(['log', '-1', '--format=%s%n%n%b'], nativeRepo.repoPath)
        ]);

        expect(nativeLog.stdout).toEqual(shellLog.stdout);
        expect(shellLog.stdout).toContain(`chore(docs): remove planning artifacts (issue #${ID})`);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });
});

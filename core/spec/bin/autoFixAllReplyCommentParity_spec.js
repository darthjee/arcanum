import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-reply-comment" migrated entrypoint
// (issue #256) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/256-migrate-auto-fix-all-reply-comment-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/reply_comment_shell.sh
// (invoked directly, NOT through the
// auto-fix-all/scripts/reply_comment.sh engine_dispatch shim — so this
// test isn't circular) and `core/bin/arcanum auto-fix-all-reply-comment`
// against equivalent inputs, asserting byte-identical stdout and exit
// code.
//
// Unlike the offline-only precedent set by githubIssueCreateParity_spec.js
// / spawnIssueParity_spec.js, this migrated entrypoint's happy path and
// REST-failure path ARE exercised here too, isolating every real
// gh/network touchpoint instead of skipping them:
//   - `gh` itself is replaced (via a `PATH`-prepended fake binary, see
//     fakeGhBin.js) for both sides — the shell script's `gh pr comment`/
//     `gh auth switch` calls and the native side's `resolve_pr_number.sh`
//     (real, unmodified — shelled out to by both implementations) and
//     `GithubToken#get`'s `gh auth token` call.
//   - the native side's raw `fetch` call to `api.github.com` is replaced
//     by preloading fakeGithubApiFetchPreload.js via `node --import`
//     (monkey-patches the global `fetch` before `core/bin/arcanum` is
//     ever imported).
//   - each fixture repo's `origin` remote is set to a github.com-shaped
//     URL whose actual transport is rewritten (via `git config
//     url.<local-bare-repo>.pushInsteadOf <github-url>`) to the repo's own
//     local bare remote — `git remote get-url origin` still reports the
//     github.com URL (satisfying Origin.js/origin.sh's domain/repo
//     parsing), while `git push`/`git fetch` never leave the filesystem.
//
// None of this touches the real network at any point, per the repo-wide
// "no real network calls in specs" rule.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'reply_comment_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');
const FAKE_FETCH_PRELOAD = pathToFileURL(
  path.join(REPO_ROOT, 'core', 'spec', 'support', 'utils', 'fakeGithubApiFetchPreload.js')
).href;

const ID = '999';
const ARGS_TAIL = [ID, 'node', 'Node Agent', 'node@example.com', 'a reply'];

/**
 * Run a reply-comment invocation (shell or native) and capture its
 * stdout/stderr/exit code.
 * @param {string[]} commandAndArgs - `[file, ...args]` to `execFile`.
 * @param {string} cwd - the directory to run the command in.
 * @param {object} [env] - the environment to run the command with
 *   (defaults to the current process's own environment).
 * @returns {Promise<{stdout: string, stderr: string, code: number}>} the process result.
 */
async function runCommand([file, ...args], cwd, env = process.env) {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, { cwd, env });

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
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * whose actual PUSH transport is redirected (via
 * `url.<path>.pushInsteadOf` — deliberately not the blanket
 * `insteadOf`, which also rewrites plain `git remote get-url origin`
 * itself) to `repo.remotePath`: `git remote get-url origin` still
 * reports the github.com URL (satisfying `Origin.js`/`origin.sh`'s
 * domain/repo parsing), while `git push` never leaves the filesystem.
 * Both implementations read the same real installed
 * `auto-fix-all/templates/reply.tmpl.md` from the arcanum install (not
 * `repoPath`), so no template copy is seeded here.
 * @param {{repoPath: string, remotePath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
async function seedGithubLikeRepo(repo) {
  const fakeUrl = 'https://github.com/darthjee/arcanum-reply-comment-fixture.git';

  await seedOriginUrl(repo.repoPath, fakeUrl);
  await git(['config', `url.${repo.remotePath}.pushInsteadOf`, fakeUrl], repo.repoPath);
}

describe('auto-fix-all-reply-comment parity (shell vs. native)', () => {
  describe('a missing required argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        // Missing reply_body (only 5 of the 6 required arguments).
        const args = [cwd, ID, 'node', 'Node Agent', 'node@example.com'];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a present-but-non-directory repo_path (hard failure)', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const args = [missingPath, ...ARGS_TAIL];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

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

  describe('a non-git repo_path (hard failure)', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-afarc-parity-');

      try {
        const args = [cwd, ...ARGS_TAIL];

        const shell = await runCommand([SHELL_SCRIPT, ...args], cwd);
        const native = await runCommand([process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', ...args], cwd);

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

  describe('no pull request found for the current branch', () => {
    it('matches shell exit code and stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-reply-comment', nativeRepo.repoPath, ...ARGS_TAIL],
          nativeRepo.repoPath,
          env
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('the REST call to post the comment fails', () => {
    it('matches shell exit code and stdout', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          FAKE_GH_COMMENT_FAIL: '1',
          ARCANUM_TEST_FAKE_FETCH: 'failure'
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-reply-comment', nativeRepo.repoPath, ...ARGS_TAIL
          ],
          nativeRepo.repoPath,
          env
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });

  describe('the happy path', () => {
    it('matches shell exit code and stdout — both relay only git push\'s own confirmation line', async () => {
      const fakeGh = await createFakeGhBin();
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

        const env = {
          ...process.env,
          PATH: `${fakeGh.binDir}:${process.env.PATH}`,
          FAKE_GH_PR_NUMBER: '42',
          ARCANUM_TEST_FAKE_FETCH: 'success'
        };

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...ARGS_TAIL], shellRepo.repoPath, env);
        const native = await runCommand(
          [
            process.execPath, '--import', FAKE_FETCH_PRELOAD,
            NATIVE_BIN, 'auto-fix-all-reply-comment', nativeRepo.repoPath, ...ARGS_TAIL
          ],
          nativeRepo.repoPath,
          env
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        // `git push -u`'s own stdout — neither push.sh nor
        // reply_comment_shell.sh redirects it (see
        // AutoFixAllReplyComment.js#_pushCurrentBranch's doc comment).
        expect(shell.stdout).toContain('set up to track');
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});

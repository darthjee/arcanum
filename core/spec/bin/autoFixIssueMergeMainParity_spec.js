import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { git, runCommand } from '../support/utils/runCommand.js';

// Parity test for the "auto-fix-issue-merge-main" migrated entrypoint
// (issue #433) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/433-migrate-auto-fix-issue-merge-main-entrypoint-to-native-node-js/node.md's
// Notes. Runs auto-fix-issue/scripts/merge_main_shell.sh (directly, NOT
// through the auto-fix-issue/scripts/merge_main.sh engine_dispatch shim
// — so this test isn't circular) and `core/bin/arcanum
// auto-fix-issue-merge-main` against equivalent fixture-repo inputs,
// asserting byte-identical stdout and exit code on both sides, including
// the conflict case.
//
// Note: neither the shell script nor the native module redirects/quiets
// `git merge`'s own porcelain output — a failed `git merge --no-edit
// origin/main` prints its own "Auto-merging .../CONFLICT
// .../Automatic merge failed..." lines to stdout, ahead of the
// conflicted-path list. Both sides forward this porcelain text
// verbatim, so `native.stdout === shell.stdout` below is the real
// parity assertion; the conflict scenario additionally asserts only on
// the substantive `STATUS=`/conflicted-file-list contract, not git's
// exact (version-dependent) wording.

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-issue', 'scripts', 'merge_main_shell.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

const BRANCH = 'issue-1';

/**
 * Checks `issue-1` out (off `main`) on `repo`, without seeding any
 * divergence — `origin/main` stays unchanged since the fixture repo was
 * cloned, so the merge is a genuine no-op.
 * @param {object} repo - the fixture repo to seed.
 * @returns {Promise<void>} resolves once `issue-1` is checked out.
 */
async function seedNoOp(repo) {
  await git(['checkout', '-b', BRANCH, 'main'], repo.repoPath);
}

/**
 * Checks `issue-1` out (off `main`) on `repo`, gives it its own
 * non-conflicting commit, then pushes a second, unrelated commit to
 * `origin/main` — so merging `origin/main` into `issue-1` lands cleanly.
 * @param {object} repo - the fixture repo to seed.
 * @returns {Promise<void>} resolves once seeding completes, with
 *   `issue-1` checked out.
 */
async function seedCleanMerge(repo) {
  // `origin/main` and `issue-1` diverge below, so the eventual `git
  // merge --no-edit origin/main` is a genuine non-fast-forward merge
  // that creates a merge commit — same committer-identity precondition
  // as `seedConflict` below (this repo has no ambient identity
  // otherwise, unlike a real invocation environment).
  await git(['config', 'user.name', 'Test'], repo.repoPath);
  await git(['config', 'user.email', 't@example.com'], repo.repoPath);

  await git(['checkout', '-b', BRANCH, 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'branch-file.txt'), 'branch change\n');
  await git(['add', 'branch-file.txt'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'branch change'], repo.repoPath);

  await git(['checkout', 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'main-file.txt'), 'main change\n');
  await git(['add', 'main-file.txt'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'main change'], repo.repoPath);
  await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);

  await git(['checkout', BRANCH], repo.repoPath);
}

/**
 * Checks `issue-1` out (off `main`) on `repo`, edits `README.md` on both
 * `issue-1` (committed locally) and `main` (pushed to `origin`) — so
 * merging `origin/main` into `issue-1` genuinely conflicts.
 * @param {object} repo - the fixture repo to seed.
 * @returns {Promise<void>} resolves once seeding completes, with
 *   `issue-1` checked out.
 */
async function seedConflict(repo) {
  // A non-fast-forward `git merge` (conflicting or not) needs a
  // committer identity available up front, before git even determines
  // whether it'll conflict — same precondition a real caller of
  // merge_main.sh must already satisfy (this repo has no ambient
  // identity otherwise, unlike a real invocation environment).
  await git(['config', 'user.name', 'Test'], repo.repoPath);
  await git(['config', 'user.email', 't@example.com'], repo.repoPath);

  await git(['checkout', '-b', BRANCH, 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (branch change)\n');
  await git(['add', 'README.md'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'branch change'], repo.repoPath);

  await git(['checkout', 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (main change)\n');
  await git(['add', 'README.md'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'main change'], repo.repoPath);
  await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);

  await git(['checkout', BRANCH], repo.repoPath);
}

/**
 * @param {Function} seedFn - `async (repo) => void`, applied identically
 *   to both a shell-side and a native-side fixture repo.
 * @returns {Promise<{shellRepo: object, nativeRepo: object}>} both repos.
 */
async function buildRepoPair(seedFn) {
  const shellRepo = await createGitFixtureRepo();
  const nativeRepo = await createGitFixtureRepo();

  await seedFn(shellRepo);
  await seedFn(nativeRepo);

  return { shellRepo, nativeRepo };
}

/**
 * @param {object} shellRepo - the repo to run the shell side against.
 * @param {object} nativeRepo - the repo to run the native side against.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runPair(shellRepo, nativeRepo) {
  const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath], shellRepo.repoPath);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'auto-fix-issue-merge-main', nativeRepo.repoPath], nativeRepo.repoPath
  );

  return { shell, native };
}

describe('auto-fix-issue-merge-main parity (shell vs. native)', () => {
  describe('no-op (origin/main unchanged since clone)', () => {
    it('prints STATUS=ok and exits 0 on both sides', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedNoOp);

      try {
        const { shell, native } = await runPair(shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('clean merge', () => {
    it('prints STATUS=ok, exits 0, and lands the merge on both sides', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedCleanMerge);

      try {
        const { shell, native } = await runPair(shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\n');

        const [shellMainFile, nativeMainFile] = await Promise.all([
          readFile(path.join(shellRepo.repoPath, 'main-file.txt'), 'utf8'),
          readFile(path.join(nativeRepo.repoPath, 'main-file.txt'), 'utf8')
        ]);

        expect(shellMainFile).toEqual('main change\n');
        expect(nativeMainFile).toEqual('main change\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('a real merge conflict', () => {
    it('matches shell exit code 2 and STATUS=conflict/<file>, leaving conflict markers on both sides', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedConflict);

      try {
        const { shell, native } = await runPair(shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(2);
        expect(shell.stdout.startsWith('STATUS=conflict\n')).toBeTrue();
        expect(shell.stdout.trim().split('\n').at(-1)).toEqual('README.md');

        const [shellReadme, nativeReadme] = await Promise.all([
          readFile(path.join(shellRepo.repoPath, 'README.md'), 'utf8'),
          readFile(path.join(nativeRepo.repoPath, 'README.md'), 'utf8')
        ]);

        expect(shellReadme).toContain('<<<<<<<');
        expect(nativeReadme).toContain('<<<<<<<');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });
});

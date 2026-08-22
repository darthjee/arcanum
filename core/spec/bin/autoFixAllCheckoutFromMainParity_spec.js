import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Parity test for the "auto-fix-all-checkout-from-main" migrated
// entrypoint (issue #258) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/258-migrate-auto-fix-all-checkout-from-main-entrypoint-to-native-node-js/plan.md's
// "Shared contracts". Runs auto-fix-all/scripts/checkout_from_main.sh
// (directly — the scripter half of this plan, which renames this file to
// checkout_from_main_shell.sh and replaces it with a thin engine_dispatch
// shim, hasn't landed on this branch yet; today's checkout_from_main.sh
// content IS the "straight rename, no behavior change" shell fallback
// plan.md describes, so it's the correct comparison target either way)
// and `core/bin/arcanum auto-fix-all-checkout-from-main` against
// identically-seeded fixture repos, asserting byte-identical stdout and
// exit code for both. This is what proves node/01's `DispatchFailure`
// exit-code generalization actually reaches the real process exit code
// (exit 2 on a merge conflict), not just the thrown object in isolation.
//
// Note: neither the shell script nor the native module redirects/quiets
// `git checkout`/`git merge`'s own porcelain output — e.g. `git checkout
// -b <branch> <remote-ref>` prints a "branch '<branch>' set up to track
// '<remote-ref>'." line to stdout (not stderr), and a failed `git merge
// --no-edit origin/main` prints its own "Auto-merging .../CONFLICT
// .../Automatic merge failed..." lines to stdout too, ahead of the
// conflicted-path list. Both sides forward this porcelain text
// verbatim, so `native.stdout === shell.stdout` below is the real
// parity assertion; the additional `shell.stdout` checks only assert on
// the substantive `BRANCH=`/`STATUS=` contract, not git's exact
// (version-dependent) wording.

const execFileAsync = promisify(execFile);

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'checkout_from_main.sh');
const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
async function git(args, cwd) {
  await execFileAsync('git', args, {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 't@example.com'
    }
  });
}

/**
 * Run a auto-fix-all-checkout-from-main invocation (shell or native) and
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
 * Build two freshly-built, identically-seeded fixture repos — one for
 * the shell side, one for the native side — so each command runs
 * against its own isolated working tree while starting from the same
 * shape.
 * @param {Function} [seedFn] - optional `async (repo, id) => void`
 *   applied identically to both repos before the comparison runs.
 * @param {string} [id] - the issue id passed through to `seedFn`.
 * @returns {Promise<{shellRepo: object, nativeRepo: object}>} both repos.
 */
async function buildRepoPair(seedFn, id) {
  const shellRepo = await createGitFixtureRepo();
  const nativeRepo = await createGitFixtureRepo();

  if (seedFn) {
    await seedFn(shellRepo, id);
    await seedFn(nativeRepo, id);
  }

  return { shellRepo, nativeRepo };
}

/**
 * @param {string} id - the issue id argument to pass to both sides.
 * @param {object} shellRepo - the repo to run the shell side against.
 * @param {object} nativeRepo - the repo to run the native side against.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
async function runPair(id, shellRepo, nativeRepo) {
  const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, id], shellRepo.repoPath);
  const native = await runCommand(
    [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', nativeRepo.repoPath, id],
    nativeRepo.repoPath
  );

  return { shell, native };
}

/**
 * @param {object} repo - the fixture repo to seed.
 * @param {string} id - the issue id — `issue-<id>` is pre-created
 *   locally, one commit behind a freshly-pushed `origin/main`.
 * @returns {Promise<void>} resolves once seeding completes.
 */
async function seedExistingLocalBranch(repo, id) {
  await git(['branch', `issue-${id}`, 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'main-file.txt'), 'main update\n');
  await git(['add', 'main-file.txt'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'main update'], repo.repoPath);
  await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);
  await git(['checkout', 'main'], repo.repoPath);
}

/**
 * @param {object} repo - the fixture repo to seed.
 * @param {string} id - the issue id — `issue-<id>` exists only on
 *   `origin`, not as a local branch.
 * @returns {Promise<void>} resolves once seeding completes.
 */
async function seedRemoteOnlyBranch(repo, id) {
  await git(['checkout', '-b', `issue-${id}`, 'main'], repo.repoPath);
  await git(['push', '--quiet', 'origin', `issue-${id}`], repo.repoPath);
  await git(['checkout', 'main'], repo.repoPath);
  await git(['branch', '-D', `issue-${id}`], repo.repoPath);
}

/**
 * @param {object} repo - the fixture repo to seed.
 * @param {string} id - the issue id — `issue-<id>` and a freshly-pushed
 *   `origin/main` both modify the same line of `README.md`.
 * @returns {Promise<void>} resolves once seeding completes.
 */
async function seedConflictingBranch(repo, id) {
  await git(['checkout', '-b', `issue-${id}`, 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (branch change)\n');
  await git(['add', 'README.md'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'branch change'], repo.repoPath);

  await git(['checkout', 'main'], repo.repoPath);
  await writeFile(path.join(repo.repoPath, 'README.md'), '# fixture (main change)\n');
  await git(['add', 'README.md'], repo.repoPath);
  await git(['commit', '--quiet', '-m', 'main change'], repo.repoPath);
  await git(['push', '--quiet', 'origin', 'main'], repo.repoPath);
}

describe('auto-fix-all-checkout-from-main parity (shell vs. native)', () => {
  describe('a fresh branch, with origin/main present (default fixture shape)', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair();

      try {
        const { shell, native } = await runPair('42', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain('BRANCH=issue-42\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('an existing local branch, merged cleanly with origin/main', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedExistingLocalBranch, '42');

      try {
        const { shell, native } = await runPair('42', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('BRANCH=issue-42\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('a remote-only branch (no local ref)', () => {
    it('matches shell output byte-for-byte', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedRemoteOnlyBranch, '77');

      try {
        const { shell, native } = await runPair('77', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toContain('BRANCH=issue-77\nSTATUS=ok\n');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('a real merge conflict', () => {
    it('matches shell exit code 2 and the BRANCH=/STATUS=conflict/<file> stdout, including the conflicted path', async () => {
      const { shellRepo, nativeRepo } = await buildRepoPair(seedConflictingBranch, '99');

      try {
        const { shell, native } = await runPair('99', shellRepo, nativeRepo);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(2);
        expect(shell.stdout).toContain('BRANCH=issue-99\nSTATUS=conflict\n');
        expect(shell.stdout.trim().split('\n').at(-1)).toEqual('README.md');
      } finally {
        await shellRepo.cleanup();
        await nativeRepo.cleanup();
      }
    });
  });

  describe('missing required args', () => {
    it('matches exit code and empty stdout, with the substantive usage text in stderr', async () => {
      const cwd = await createTempDir('arcanum-core-afacfm-parity-');

      try {
        const shell = await runCommand([SHELL_SCRIPT, '', ''], cwd);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'auto-fix-all-checkout-from-main', '', ''],
          cwd
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toContain('Usage:');
        expect(shell.stderr.trim()).toContain('<repo_path> <id>');
        expect(native.stderr.trim()).toContain('Usage:');
        expect(native.stderr.trim()).toContain('<repo_path> <id>');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

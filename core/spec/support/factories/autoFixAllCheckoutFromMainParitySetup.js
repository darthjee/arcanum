import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { REPO_ROOT } from '../utils/runCommand.js';

const execFileAsync = promisify(execFile);

/** The `auto-fix-all-checkout-from-main` shell entrypoint's script path. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'checkout_from_main_shell.sh');

/** `core/bin/arcanum`'s own path — the native entrypoint dispatcher. */
export const NATIVE_BIN = path.join(REPO_ROOT, 'core', 'bin', 'arcanum');

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<void>} resolves once the command succeeds.
 */
export async function git(args, cwd) {
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
export async function runCommand([file, ...args], cwd) {
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
export async function buildRepoPair(seedFn, id) {
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
export async function runPair(id, shellRepo, nativeRepo) {
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
export async function seedExistingLocalBranch(repo, id) {
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
export async function seedRemoteOnlyBranch(repo, id) {
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
export async function seedConflictingBranch(repo, id) {
  // A non-fast-forward `git merge` (conflicting or not) needs a
  // committer identity available up front, before git even determines
  // whether it'll conflict — same precondition a real caller of
  // checkout_from_main.sh must already satisfy (this repo has no
  // ambient identity otherwise, unlike a real invocation environment).
  // Repo-level config, so it covers both the shell and native sides.
  await git(['config', 'user.name', 'Test'], repo.repoPath);
  await git(['config', 'user.email', 't@example.com'], repo.repoPath);
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

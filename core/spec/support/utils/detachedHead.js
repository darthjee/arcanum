import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * The refusal every strict push helper prints (shell) / throws (native)
 * on a detached HEAD — see `arcanum/_lib/push.sh`'s
 * `require_current_branch` and `GitClient#requireCurrentBranch`.
 */
export const DETACHED_HEAD_REFUSAL = 'refusing to push: no current branch (detached HEAD?)';

/**
 * @param {string[]} args - the `git` arguments to run.
 * @param {string} cwd - the directory to run them in.
 * @returns {Promise<string>} the command's stdout.
 */
async function git(args, cwd) {
  const { stdout } = await execFileAsync('git', args, { cwd });

  return stdout;
}

/**
 * Detach `repoPath`'s HEAD (at `ref`, the current commit by default).
 * @param {string} repoPath - the fixture repo's local checkout path.
 * @param {string} [ref] - the commit-ish to detach at.
 * @returns {Promise<void>} resolves once detached.
 */
export async function detachHead(repoPath, ref = 'HEAD') {
  await git(['checkout', '--quiet', '--detach', ref], repoPath);
}

/**
 * Snapshot everything a refused push must leave untouched: HEAD, the
 * index/working tree, the local refs and the bare remote's refs.
 * @param {{repoPath: string, remotePath: string}} repo - the fixture repo
 *   (as built by `createGitFixtureRepo`).
 * @returns {Promise<{head: string, status: string, localRefs: string, remoteRefs: string}>}
 *   the snapshot, comparable with `toEqual`.
 */
export async function snapshotRepoState({ repoPath, remotePath }) {
  const [head, status, localRefs, remoteRefs] = await Promise.all([
    git(['rev-parse', 'HEAD'], repoPath),
    git(['status', '--porcelain'], repoPath),
    git(['for-each-ref'], repoPath),
    git(['for-each-ref'], remotePath)
  ]);

  return { head, status, localRefs, remoteRefs };
}

/**
 * Assert the shared refusal contract on both engines: identical non-zero
 * exit code, empty stdout, and the refusal on stderr (exactly, on the
 * shell side; prefixed by the native CLI's own `arcanum: ` on the native
 * side, hence `toContain`).
 * @param {{shell: {stdout: string, stderr: string, code: number},
 *   native: {stdout: string, stderr: string, code: number}}} results -
 *   both sides' process results.
 * @returns {void}
 */
export function expectDetachedHeadRefusal({ shell, native }) {
  expect(native.code).toEqual(shell.code);
  expect(shell.code).not.toEqual(0);
  expect(shell.stdout).toEqual('');
  expect(native.stdout).toEqual('');
  expect(shell.stderr.trim()).toEqual(DETACHED_HEAD_REFUSAL);
  expect(native.stderr.trim()).toContain(DETACHED_HEAD_REFUSAL);
}

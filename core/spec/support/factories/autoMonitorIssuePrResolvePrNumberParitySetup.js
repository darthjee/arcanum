import path from 'node:path';
import { NATIVE_BIN, REPO_ROOT, FAKE_FETCH_PRELOAD, git, runCommand, seedOriginUrl } from '../utils/runCommand.js';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { seedEnv } from '../utils/parityEnv.js';

// Shared setup for the "auto-monitor-issue-pr-resolve-pr-number" parity
// specs (issue #435) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Mirrors autoFixIssueGithubParitySetup.js's shape:
// a fake `gh` binary, two independent fixture repos (one per side,
// never shared) checked out to `issue-<ID>` and rewritten to a
// github.com-shaped `origin`, plus a matched pair of shell/native env
// objects (reusing `fakeGithubApiFetchPreload.js`'s existing
// `auto-fix-issue-github` mode, which already handles the
// `GET /repos/{repo}/pulls?head=...` shape `GitHubClient#getPr` issues
// — the same call `resolve_pr_number_shell.sh`'s `gh pr view --json
// number` counterpart drives).

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-github-fixture.git';

/** The numeric issue id used by every scenario below. */
export const ID = '5';

/** The `issue-<ID>` branch name, matching `ID`. */
export const BRANCH = `issue-${ID}`;

/** `auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh`'s path — run directly, never through the `resolve_pr_number.sh` engine_dispatch shim. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-monitor-issue-pr', 'scripts', 'resolve_pr_number_shell.sh');

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * and checks out `issue-<ID>` (the branch the caller is expected to
 * have already checked out before invoking `resolve_pr_number.sh`).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
  await git(['checkout', '-b', BRANCH, 'main'], repo.repoPath);
}

/**
 * Orchestrates the setup shared by every API-lookup-path parity case
 * (cache-miss success, not-found error): a fake `gh` binary, two
 * independent fixture repos both checked out to `issue-<ID>` and
 * rewritten to a github.com-shaped `origin`, plus a matched pair of
 * shell/native env objects.
 * @param {object} [scenario] - the scenario's shell/native env var overrides.
 * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides, for the shell side.
 * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides, for the native side.
 * @returns {Promise<{shellRepo: object, nativeRepo: object, shellEnv: object, nativeEnv: object, cleanup: Function}>}
 *   the built fixtures, ready for `runPair`, plus a `cleanup()` that
 *   tears all of them down together.
 */
export async function setupParityTest({ ghVars, fetchVars } = {}) {
  const fakeGh = await createFakeGhBin();
  const shellRepo = await createGitFixtureRepo();
  const nativeRepo = await createGitFixtureRepo();

  await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

  const fakeGhEnv = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
  const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, { ghVars, fetchVars, fakeFetchMode: 'auto-fix-issue-github' });

  return {
    shellRepo,
    nativeRepo,
    shellEnv,
    nativeEnv,
    cleanup: () => Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])
  };
}

/**
 * Run `resolve_pr_number_shell.sh`/`core/bin/arcanum
 * auto-monitor-issue-pr-resolve-pr-number` on both sides against the
 * same `id`.
 * @param {string} id - the `<id>` argument to pass on both sides.
 * @param {{repoPath: string}} shellRepo - the shell side's fixture repo.
 * @param {{repoPath: string}} nativeRepo - the native side's fixture repo.
 * @param {object} [shellEnv] - the shell invocation's environment.
 * @param {object} [nativeEnv] - the native invocation's environment.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runPair(id, shellRepo, nativeRepo, shellEnv = process.env, nativeEnv = process.env) {
  const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, id], shellRepo.repoPath, shellEnv);
  const native = await runCommand(
    [
      process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN,
      'auto-monitor-issue-pr-resolve-pr-number', nativeRepo.repoPath, id
    ],
    nativeRepo.repoPath,
    nativeEnv
  );

  return { shell, native };
}

import path from 'node:path';
import { NATIVE_BIN, REPO_ROOT, FAKE_FETCH_PRELOAD, git, runCommand, seedOriginUrl } from '../utils/runCommand.js';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { seedEnv } from '../utils/parityEnv.js';

// Shared setup for the "auto-monitor-pr-monitor-pr" parity specs (issue
// #436) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/436-migrate-auto-monitor-pr-monitor-pr-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Mirrors autoFixAllWaitCiParitySetup.js's
// argument-based-`gh`-stub shape (extended in `fakeGhBin.js` itself, per
// node/06's own note, rather than duplicating a whole new stubbing
// mechanism) plus autoMonitorIssuePrResolvePrNumberParitySetup.js's
// two-independent-fixture-repos convention.
//
// `PR_OWNER` resolution goes through the checked-out repo's own
// `user.ghuser` git config value (native's `GithubToken#ghUser`, the
// shell's `get_gh_user`) — `seedGithubLikeRepo` sets it to `OWNER` on
// both sides so every scenario below can freely author comments/reviews
// "from" that login.

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-monitor-pr-fixture.git';

/** The GitHub login every scenario treats as the PR's owner. */
export const OWNER = 'darthjee';

/** The pull request number used by every scenario below. */
export const PR_NUMBER = '7';

/** `auto-monitor-pr/scripts/monitor_pr_shell.sh`'s path — run directly, never through the `monitor_pr.sh` engine_dispatch shim. */
export const SHELL_SCRIPT = path.join(REPO_ROOT, 'auto-monitor-pr', 'scripts', 'monitor_pr_shell.sh');

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL
 * and sets `user.ghuser` to `OWNER`, so both `get_gh_user`/`GithubToken#ghUser`
 * resolve `PR_OWNER` identically on both sides.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
  await git(['config', 'user.ghuser', OWNER], repo.repoPath);
}

/**
 * Orchestrates the setup shared by every scenario below: a fake `gh`
 * binary, two independent fixture repos both rewritten to a
 * github.com-shaped `origin` with `user.ghuser` set to `OWNER`, plus a
 * matched pair of shell/native env objects.
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
  const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, {
    ghVars: { FAKE_GH_PR_NUMBER: PR_NUMBER, ...ghVars },
    fetchVars,
    fakeFetchMode: 'monitor-pr'
  });

  return {
    shellRepo,
    nativeRepo,
    shellEnv,
    nativeEnv,
    cleanup: () => Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])
  };
}

/**
 * Run `monitor_pr_shell.sh`/`core/bin/arcanum auto-monitor-pr-monitor-pr`
 * on both sides, against `PR_NUMBER` and an optional `--issue-id`.
 * @param {{repoPath: string}} shellRepo - the shell side's fixture repo.
 * @param {{repoPath: string}} nativeRepo - the native side's fixture repo.
 * @param {object} [shellEnv] - the shell invocation's environment.
 * @param {object} [nativeEnv] - the native invocation's environment.
 * @param {string} [issueId] - the `--issue-id` value, omitted entirely
 *   (legacy per-PR-file state shape) when not given.
 * @returns {Promise<{shell: object, native: object}>} both sides' results.
 */
export async function runPair(shellRepo, nativeRepo, shellEnv = process.env, nativeEnv = process.env, issueId) {
  const flags = ['--pr-number', PR_NUMBER, ...(issueId ? ['--issue-id', issueId] : [])];
  const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ...flags], shellRepo.repoPath, shellEnv);
  const native = await runCommand(
    [
      process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN,
      'auto-monitor-pr-monitor-pr', nativeRepo.repoPath, ...flags
    ],
    nativeRepo.repoPath,
    nativeEnv
  );

  return { shell, native };
}

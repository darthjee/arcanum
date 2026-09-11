import { seedOriginUrl } from '../utils/runCommand.js';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { seedEnv } from '../utils/parityEnv.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-github-fixture.git';

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL —
 * every `auto-fix-issue-github` subcommand needs a recognizable origin
 * URL to derive `{ domain, repo }` from, and none of them actually
 * pushes/fetches against `origin` — mirrors `githubParitySetup.js`'s own
 * `seedGithubLikeRepo`.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Orchestrates the setup repeated by nearly every `auto-fix-issue-github`
 * parity test case: a fake `gh` binary, two independent fixture repos
 * (one per side, never shared), both left on their default `main`
 * branch (so the shell/native `_current_issue_id`/`issueFromCurrentBranch`
 * best-effort state-sync path is a no-op on both sides — see
 * `docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node/04-parity-tests.md`)
 * and rewritten to a github.com-shaped `origin`, plus a matched pair of
 * shell/native env objects (`ARCANUM_TEST_FAKE_FETCH=auto-fix-issue-github`
 * on the native side).
 * @param {object} [scenario] - the scenario's shell/native env var overrides.
 * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides, for the shell side.
 * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides, for the native side.
 * @returns {Promise<{shellRepo: object, nativeRepo: object, shellEnv: object, nativeEnv: object, fakeGh: object, cleanup: Function}>}
 *   the built fixtures, ready for `runBoth`, plus a `cleanup()` that
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
    fakeGh,
    cleanup: () => Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])
  };
}

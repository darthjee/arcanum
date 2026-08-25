import { seedOriginUrl } from '../utils/runCommand.js';
import { createFakeGhBin } from '../utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { seedEnv } from '../utils/parityEnv.js';

const FAKE_GITHUB_URL = 'https://github.com/darthjee/arcanum-github-fixture.git';

/**
 * Rewrites `repo.repoPath`'s `origin` remote to a github.com-shaped URL —
 * every subcommand except `cleanup-branch` needs a recognizable origin
 * URL to derive `{ domain, repo }` from, and none of them actually
 * pushes/fetches against `origin`, so no local-bare-repo transport
 * rewrite is needed (mirrors autoFixAllWaitCiParity_spec.js's own
 * `seedGithubLikeRepo`).
 * @param {{repoPath: string}} repo - the fixture repo.
 * @returns {Promise<void>} resolves once seeded.
 */
export async function seedGithubLikeRepo(repo) {
  await seedOriginUrl(repo.repoPath, FAKE_GITHUB_URL);
}

/**
 * Orchestrates the setup repeated by nearly every `auto-fix-all-github`
 * parity test case: a fake `gh` binary, two independent fixture repos
 * (one per side, never shared), both rewritten to a github.com-shaped
 * `origin`, and a matched pair of shell/native env objects.
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
  const { shellEnv, nativeEnv } = seedEnv(fakeGhEnv, { ghVars, fetchVars });

  return {
    shellRepo,
    nativeRepo,
    shellEnv,
    nativeEnv,
    fakeGh,
    cleanup: () => Promise.all([shellRepo.cleanup(), nativeRepo.cleanup(), fakeGh.cleanup()])
  };
}

/**
 * Asserts the shell and native sides of a comparison produced
 * byte-identical stdout and matching exit codes.
 * @param {{stdout: string, code: number}} shell - the shell side's result.
 * @param {{stdout: string, code: number}} native - the native side's result.
 * @returns {void}
 */
export function expectParity(shell, native) {
  expect(native.stdout).toEqual(shell.stdout);
  expect(native.code).toEqual(shell.code);
}

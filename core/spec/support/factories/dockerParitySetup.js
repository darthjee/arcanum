import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expectDockerParity, expectHostOwned, runDockerParity, withoutPlatformNotice
} from '../utils/dockerParity.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { git } from '../utils/runCommand.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';

// Shared setup for the docker batch-1 parity specs under
// core/spec/docker/ (issue #745), following the arcanum-check-config
// pilot (core/spec/docker/arcanumCheckConfig_spec.js). Local only: run
// with `make docker-parity`, never part of `yarn test`.

/** Docker runs pay a per-call `docker run`; give each case room. */
export const TIMEOUT = 120000;

/**
 * Temp dirs come from `tempDir.js` (`os.tmpdir()`, under `/var/folders`
 * on macOS — a Docker Desktop shared path by default). They are
 * realpath'd so the paths git records for a worktree match the paths
 * passed to dispatch.
 * @param {string} prefix - the temp dir prefix.
 * @returns {Promise<string>} the created directory's real path.
 */
async function sharedTempDir(prefix) {
  return realpath(await createTempDir(prefix));
}

/**
 * Builds a parity world: a git fixture repo (a clone, or a worktree of
 * it), plus a clean env whose `HOME` and `CLAUDE_CONFIG_DIR` are empty
 * temp dirs, so this machine's global config never leaks in, and an
 * empty `outsideDir` outside the repo for argument paths
 * (`--path-arg`) that must sit outside it.
 * @param {object} [opts] - options.
 * @param {boolean} [opts.worktree] - run from a git worktree of the
 *   fixture repo (exercising the git common dir mount).
 * @returns {Promise<{repoPath: string, outsideDir: string, configDir: string, env: object, cleanup: () => Promise<void>}>}
 *   the world.
 */
export async function createParityWorld({ worktree = false } = {}) {
  const fixture = await createGitFixtureRepo();
  const homeDir = await sharedTempDir('arcanum-docker-parity-home-');
  const configDir = await sharedTempDir('arcanum-docker-parity-global-');
  const outsideDir = await sharedTempDir('arcanum-docker-parity-outside-');
  const fixturePath = await realpath(fixture.repoPath);
  let worktreeRoot = null;
  let repoPath = fixturePath;

  if (worktree) {
    worktreeRoot = await sharedTempDir('arcanum-docker-parity-worktree-');
    repoPath = path.join(worktreeRoot, 'wt');
    await git(['worktree', 'add', '--quiet', '-b', 'parity-wt', repoPath], fixturePath);
  }

  return {
    repoPath,
    outsideDir,
    configDir,
    env: { PATH: process.env.PATH, HOME: homeDir, CLAUDE_CONFIG_DIR: configDir },
    cleanup: async () => {
      if (worktreeRoot) await removeTempDir(worktreeRoot);
      await removeTempDir(outsideDir);
      await removeTempDir(homeDir);
      await removeTempDir(configDir);
      await fixture.cleanup();
    }
  };
}

/**
 * Registers `describe(description)` holding a `describe` per repo
 * flavor running `defineCases`: a plain git clone and, when `worktree`
 * is set, a git worktree of it. Each case gets a fresh world (see
 * `createParityWorld`).
 * @param {string} description - the outer `describe` label.
 * @param {(getWorld: () => object) => void} defineCases - registers the cases.
 * @param {object} [opts] - options.
 * @param {boolean} [opts.worktree] - also run every case from a worktree.
 * @returns {void}
 */
export function describeParityRepos(description, defineCases, { worktree = false } = {}) {
  const flavors = [['from a git repo', false]];

  if (worktree) flavors.push(['from a git worktree', true]);

  describe(description, () => {
    flavors.forEach(([label, isWorktree]) => {
      describe(label, () => {
        let world;

        beforeEach(async () => {
          world = await createParityWorld({ worktree: isWorktree });
        });

        afterEach(async () => {
          await world.cleanup();
        });

        defineCases(() => world);
      });
    });
  });
}

/**
 * Registers one parity case: seeds the repo, runs the real shim's
 * `engine_dispatch` arguments natively and in `PARITY_IMAGE`, and
 * asserts identical stdout, exit code, stderr (minus Docker's platform
 * notice) and file diff — of the repo and, with `watchOutside`, of the
 * world's `outsideDir` too — with, on Linux, every created/changed file
 * owned by the host uid.
 * @param {string} label - the `it` label.
 * @param {() => {repoPath: string, outsideDir: string, env: object}} getWorld - the world.
 * @param {object} spec - the case.
 * @param {string} spec.command - the dispatched command.
 * @param {(repoPath: string, world: object) => string[]} spec.dispatchArgs - the shim's
 *   real `engine_dispatch` arguments.
 * @param {(repoPath: string, world: object) => Promise<void>} [spec.seed] - fixture setup;
 *   it may replace `world.env`, which both runs use (read after it).
 * @param {(parity: object, repoPath: string, world: object) => Promise<void>|void} [spec.check] -
 *   further expectations (e.g. on the native result itself).
 * @param {boolean} [spec.watchOutside] - also diff the world's
 *   `outsideDir` (for argument paths outside the repo).
 * @param {(mode: string, repoPath: string, world: object) => Promise<void>} [spec.reset] -
 *   run before each run (see `runDockerParity`'s `reset`).
 * @param {boolean} [spec.detachNative] - run the native side with no
 *   controlling terminal (see `runDockerParity`'s `detachNative`).
 * @returns {void}
 */
export function itMatchesNativeInDocker(label, getWorld, {
  command, dispatchArgs, seed, check, watchOutside = false, reset, detachNative = false
}) {
  it(label, async () => {
    const world = getWorld();
    const { repoPath } = world;

    if (seed) await seed(repoPath, world);

    const parity = await runDockerParity({
      command,
      repoPath,
      dispatchArgs: dispatchArgs(repoPath, world),
      argDirs: watchOutside ? [world.outsideDir] : [],
      env: world.env,
      reset: reset ? (mode) => reset(mode, repoPath, world) : undefined,
      detachNative
    });

    expect(withoutPlatformNotice(parity.docker.stderr)).toEqual(parity.native.stderr);
    expectDockerParity(parity);
    expectHostOwned(parity);
    if (check) await check(parity, repoPath, world);
  }, TIMEOUT);
}

/**
 * Writes `content` to `file` under `repoPath`, creating its parents.
 * @param {string} repoPath - the repo.
 * @param {string} file - the repo-relative path.
 * @param {string} content - the content.
 * @returns {Promise<void>} resolves once written.
 */
export async function seedRepoFile(repoPath, file, content) {
  await mkdir(path.dirname(path.join(repoPath, file)), { recursive: true });
  await writeFile(path.join(repoPath, file), content);
}

/**
 * @param {{changed: object, removed: string[]}} diff - one dir's file diff.
 * @returns {string[]} the created/changed files' relative paths.
 */
function changedFiles(diff) {
  return Object.keys(diff.changed);
}

/**
 * @param {object} parity - a `runDockerParity` result.
 * @param {string} repoPath - the repo.
 * @returns {string[]} the files the native run created/changed under
 *   the repo, minus the harness's own engine-mode config.
 */
export function nativeWrites(parity, repoPath) {
  return changedFiles(parity.nativeFiles[repoPath])
    .filter((file) => file !== path.join('.claude', 'state', 'arcanum-config.json'));
}

/**
 * @param {object} parity - a `runDockerParity` result (run with the
 *   world's `outsideDir` watched).
 * @param {string} outsideDir - the watched directory outside the repo.
 * @returns {string[]} the files the native run created/changed there.
 */
export function nativeOutsideWrites(parity, outsideDir) {
  return changedFiles(parity.nativeFiles[outsideDir]);
}

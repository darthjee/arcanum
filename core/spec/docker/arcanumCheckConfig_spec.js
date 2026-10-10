import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expectDockerParity, requireParityImage, runDockerParity, withoutPlatformNotice
} from '../support/utils/dockerParity.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { git } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const COMMAND = 'arcanum-check-config';

/** Docker runs pay a per-call `docker run`; give each case room. */
const TIMEOUT = 120000;

/**
 * The real `check_config.sh` shim's `engine_dispatch` call.
 * @param {string} repoPath - the repo argument.
 * @param {string} key - the dotted key.
 * @returns {string[]} `engine_dispatch`'s arguments.
 */
function dispatchArgs(repoPath, key) {
  return [
    repoPath, COMMAND, '', '--native-only', '--needs=global-config', 'HOME', 'CLAUDE_CONFIG_DIR',
    '--', repoPath, key
  ];
}

/**
 * @param {string} file - the JSON file to write (parents created).
 * @param {object} content - its content.
 * @returns {Promise<void>} resolves once written.
 */
async function writeJson(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(content));
}

/**
 * Temp dirs come from `tempDir.js` (`os.tmpdir()`, under `/var/folders`
 * on macOS — a Docker Desktop shared path by default). They are
 * realpath'd (`/private/var/folders/...`, also shared) so the paths git
 * records for a worktree match the paths passed to dispatch.
 * @param {string} prefix - the temp dir prefix.
 * @returns {Promise<string>} the created directory's real path.
 */
async function sharedTempDir(prefix) {
  return realpath(await createTempDir(prefix));
}

// Local-only parity case for the arcanum-check-config pilot (#741): the
// real shim's dispatch call runs natively on the host and inside
// PARITY_IMAGE, and both must print the same stdout, exit with the same
// code and leave the repo and the global config dir untouched. Run with
// `make docker-parity`; never part of `yarn test`.
describe('arcanum-check-config docker parity', () => {
  requireParityImage();

  let homeDir;
  let configDir;
  let env;

  beforeEach(async () => {
    homeDir = await sharedTempDir('arcanum-docker-parity-home-');
    configDir = await sharedTempDir('arcanum-docker-parity-global-');

    await writeJson(path.join(configDir, 'arcanum-config.json'), {
      git: { authors: ['global@example.com'] },
      tiers: { local: 'global', repo: 'global' }
    });

    env = { PATH: process.env.PATH, HOME: homeDir, CLAUDE_CONFIG_DIR: configDir };
  });

  afterEach(async () => {
    await removeTempDir(homeDir);
    await removeTempDir(configDir);
  });

  /**
   * Seeds the local and repo tiers under `repoPath`.
   * @param {string} repoPath - the repo (or worktree) to seed.
   * @returns {Promise<void>} resolves once seeded.
   */
  async function seedTiers(repoPath) {
    await writeJson(path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), {
      tiers: { local: 'local' }
    });
    await writeJson(path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), {
      tiers: { local: 'repo', repo: 'repo' }
    });
  }

  /**
   * @param {string} repoPath - the repo (or worktree) under test.
   * @param {string} key - the dotted key.
   * @returns {Promise<object>} the `runDockerParity` result.
   */
  function runParity(repoPath, key) {
    return runDockerParity({
      command: COMMAND,
      repoPath,
      dispatchArgs: dispatchArgs(repoPath, key),
      argDirs: [configDir],
      env
    });
  }

  /**
   * @param {object} parity - a `runDockerParity` result.
   * @param {object} parity.nativeFiles - the native run's file diff.
   * @param {object} parity.dockerFiles - the docker run's file diff.
   * @returns {void}
   */
  function expectReadOnly({ nativeFiles, dockerFiles }) {
    [nativeFiles, dockerFiles].forEach((files) => {
      Object.values(files).forEach((diff) => {
        expect(diff).toEqual({ changed: {}, removed: [] });
      });
    });
  }

  /**
   * The shared cases, run against `getRepoPath()`.
   * @param {() => string} getRepoPath - returns the repo path under test.
   * @returns {void}
   */
  function itBehavesLikeCheckConfig(getRepoPath) {
    [
      ['a global-only key', 'git.authors'],
      ['a key set in the local tier', 'tiers.local'],
      ['a key set in the repo tier', 'tiers.repo'],
      ['an unset key', 'nothing.here']
    ].forEach(([label, key]) => {
      it(`matches native for ${label} (${key}) without touching any file`, async () => {
        const parity = await runParity(getRepoPath(), key);

        expect(parity.native.code).toEqual(0);
        expect(withoutPlatformNotice(parity.docker.stderr)).toEqual('');
        expectDockerParity(parity);
        expectReadOnly(parity);
      }, TIMEOUT);
    });

    it('matches native for a malformed key (exit 1, same arcanum: error)', async () => {
      const parity = await runParity(getRepoPath(), 'git');

      expect(parity.native.code).toEqual(1);
      expect(parity.native.stderr).toContain('arcanum: invalid key \'git\'');
      expect(withoutPlatformNotice(parity.docker.stderr)).toEqual(parity.native.stderr);
      expectDockerParity(parity);
      expectReadOnly(parity);
    }, TIMEOUT);
  }

  describe('from a plain repo', () => {
    let repoPath;

    beforeEach(async () => {
      repoPath = await sharedTempDir('arcanum-docker-parity-repo-');
      await seedTiers(repoPath);
    });

    afterEach(async () => {
      await removeTempDir(repoPath);
    });

    itBehavesLikeCheckConfig(() => repoPath);
  });

  describe('from a git worktree of the fixture repo', () => {
    let fixture;
    let worktreeRoot;
    let worktreePath;

    beforeEach(async () => {
      fixture = await createGitFixtureRepo();
      worktreeRoot = await sharedTempDir('arcanum-docker-parity-worktree-');
      worktreePath = path.join(worktreeRoot, 'wt');

      await git(['worktree', 'add', '--quiet', '-b', 'parity-wt', worktreePath], await realpath(fixture.repoPath));
      await seedTiers(worktreePath);
    });

    afterEach(async () => {
      await removeTempDir(worktreeRoot);
      await fixture.cleanup();
    });

    itBehavesLikeCheckConfig(() => worktreePath);
  });
});

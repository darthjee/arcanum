import { utimes } from 'node:fs/promises';
import path from 'node:path';
import {
  TIMEOUT, describeParityRepos, itMatchesNativeInDocker, nativeWrites, seedRepoFile
} from '../support/factories/dockerParitySetup.js';
import {
  expectHostOwned, requireParityImage, runDockerParity, withoutPlatformNotice
} from '../support/utils/dockerParity.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { seedOriginUrl } from '../support/utils/runCommand.js';

const START = 'arcanum-create-issue-start';
const PUBLISH = 'arcanum-create-issue-publish';
const NEEDS = '--needs=global-config,gitconfig,gh';
const DRAFTS_DIR = path.join('.claude', 'state', 'create-issue');
const DRAFT = path.join(DRAFTS_DIR, '20261001-120000.md');
const GITHUB_ORIGIN = 'https://github.com/darthjee/arcanum-create-issue-fixture.git';

/** A fixed draft mtime, re-applied before each run (the tree restore resets it). */
const DRAFT_MTIME = new Date('2026-10-01T12:00:00Z');

/** A timestamped draft name (`DraftStore#create`), masked before comparing. */
const DRAFT_NAME = /\d{8}-\d{6}\.md/g;

/**
 * A create-issue shim's real `engine_dispatch` call (`--native-only`,
 * the gh needs, `HOME` allowlisted, no `--path-arg`), with `"$@"`
 * (starting with `<repo_path>`) passed on.
 * @param {string} command - the dispatched command.
 * @param {(repoPath: string) => string[]} [args] - the args after `<repo_path>`.
 * @returns {(repoPath: string) => string[]} `engine_dispatch`'s arguments.
 */
function createIssueDispatch(command, args = () => []) {
  return (repoPath) => [repoPath, command, '', '--native-only', NEEDS, 'HOME', '--', repoPath, ...args(repoPath)];
}

/**
 * Seeds a draft at `DRAFT` with `content`.
 * @param {string} repoPath - the repo.
 * @param {string} content - the draft's content.
 * @returns {Promise<void>} resolves once written.
 */
function seedDraft(repoPath, content) {
  return seedRepoFile(repoPath, DRAFT, content);
}

/**
 * Puts the seeded draft's mtime back to `DRAFT_MTIME`, so `DRAFT=`'s
 * timestamp is the same in both runs.
 * @param {string} mode - the run's mode (unused).
 * @param {string} repoPath - the repo.
 * @returns {Promise<void>} resolves once touched.
 */
function resetDraftMtime(mode, repoPath) {
  return utimes(path.join(repoPath, DRAFT), DRAFT_MTIME, DRAFT_MTIME);
}

/**
 * @param {string} text - a run's stdout/stderr or a relative path.
 * @returns {string} `text` with timestamped draft names masked.
 */
function maskDraftName(text) {
  return text.replace(DRAFT_NAME, '<draft>.md');
}

/**
 * @param {object} files - a `runDockerParity` file diff (dir -> diff).
 * @returns {object} the same diff with timestamped draft names masked.
 */
function maskFiles(files) {
  return Object.fromEntries(Object.entries(files).map(([dir, { changed, removed }]) => [
    dir,
    {
      changed: Object.fromEntries(Object.entries(changed).map(([rel, print]) => [maskDraftName(rel), print])),
      removed: removed.map(maskDraftName)
    }
  ]));
}

// Local-only parity cases for the native-only arcanum-create-issue-start
// and arcanum-create-issue-publish commands (docker batch 5, #749), with
// the real shims' `engine_dispatch` calls. The fixture's `origin` is a
// github.com URL and a fake `gh` (first on PATH, which survives native's
// `env -i`) answers `gh auth token` natively; the docker side resolves
// the token on the host from the seeded `GH_TOKEN` and the image's own
// `gh` prints it, so start's GithubPreflight passes on both sides
// without any network call. Calls that would prompt run the native side
// detached from the controlling terminal (`detachNative`), so both
// sides take the exit-4 `FALLBACK=chat` path. publish's success path
// has no case: it would create a real GitHub issue.
describe('arcanum-create-issue docker parity', () => {
  let fakeGh;

  requireParityImage();

  beforeAll(async () => {
    fakeGh = await createFakeGhBin();
  });

  afterAll(async () => {
    await fakeGh.cleanup();
  });

  /**
   * @param {{env: object}} world - the parity world.
   * @returns {object} the world's env with the fake `gh` first on `PATH`
   *   and a fake `GH_TOKEN` (never a real one).
   */
  function ghEnv(world) {
    return {
      ...world.env,
      PATH: `${fakeGh.binDir}${path.delimiter}${world.env.PATH}`,
      GH_TOKEN: 'fake-parity-gh-token'
    };
  }

  /**
   * `itMatchesNativeInDocker` with the github.com origin and the gh env.
   * @param {string} label - the `it` label.
   * @param {() => object} getWorld - the world.
   * @param {object} spec - see `itMatchesNativeInDocker`.
   * @param {(repoPath: string, world: object) => Promise<void>} [spec.seed] - further
   *   fixture setup, after the origin and env are wired.
   * @returns {void}
   */
  function itMatches(label, getWorld, { seed, ...spec }) {
    itMatchesNativeInDocker(label, getWorld, {
      ...spec,
      seed: async (repoPath, world) => {
        await seedOriginUrl(repoPath, GITHUB_ORIGIN);
        world.env = ghEnv(world);
        if (seed) await seed(repoPath, world);
      }
    });
  }

  describeParityRepos('start', (getWorld) => {
    itMatches('exits 2 on invalid input', getWorld, {
      command: START,
      dispatchArgs: createIssueDispatch(START, () => ['--bogus']),
      check: ({ native }) => {
        expect(native.code).toEqual(2);
        expect(native.stdout).toMatch(/^ERROR=.+\n$/);
      }
    });

    itMatches('exits 2 on an unknown --resume draft', getWorld, {
      command: START,
      dispatchArgs: createIssueDispatch(START, () => ['--resume', 'nope.md']),
      check: ({ native }) => expect(native).toEqual({ stdout: 'ERROR=unknown draft: nope.md\n', stderr: '', code: 2 })
    });

    itMatches('resumes an existing draft by its absolute path', getWorld, {
      command: START,
      seed: (repoPath) => seedDraft(repoPath, '# A title\n'),
      dispatchArgs: createIssueDispatch(START, (repoPath) => ['--resume', path.join(repoPath, DRAFT)]),
      check: (parity, repoPath) => {
        expect(parity.native).toEqual({
          stdout: `STATUS=resumed\nFILE=${path.join(repoPath, DRAFT)}\n`, stderr: '', code: 0
        });
        expect(nativeWrites(parity, repoPath)).toEqual([]);
      }
    });

    itMatches('takes the exit-4 FALLBACK=chat path with DRAFT= lines when drafts exist and no flag is given', getWorld, {
      command: START,
      detachNative: true,
      seed: (repoPath) => seedDraft(repoPath, '# A title\n\nBody.\n'),
      reset: resetDraftMtime,
      dispatchArgs: createIssueDispatch(START),
      check: ({ native }, repoPath) => {
        expect(native).toEqual({
          stdout: `FALLBACK=chat\nDRAFT=${path.join(repoPath, DRAFT)}\t2026-10-01T12:00:00Z\tA title\n`,
          stderr: '',
          code: 4
        });
      }
    });

    it('creates a new draft under the repo with --new (draft name masked)', async () => {
      const world = getWorld();
      const { repoPath } = world;

      await seedOriginUrl(repoPath, GITHUB_ORIGIN);

      const parity = await runDockerParity({
        command: START,
        repoPath,
        dispatchArgs: createIssueDispatch(START, () => ['--new'])(repoPath),
        env: ghEnv(world)
      });
      const draft = path.join(repoPath, DRAFTS_DIR, '<draft>.md');

      expect(maskDraftName(parity.native.stdout)).toEqual(`STATUS=new\nFILE=${draft}\n`);
      expect(parity.native.code).toEqual(0);
      expect(maskDraftName(parity.docker.stdout)).toEqual(maskDraftName(parity.native.stdout));
      expect(parity.docker.code).toEqual(parity.native.code);
      expect(withoutPlatformNotice(parity.docker.stderr)).toEqual(parity.native.stderr);
      expect(maskFiles(parity.dockerFiles)).toEqual(maskFiles(parity.nativeFiles));
      expect(nativeWrites({ nativeFiles: maskFiles(parity.nativeFiles) }, repoPath))
        .toEqual([path.join(DRAFTS_DIR, '<draft>.md')]);
      expectHostOwned(parity);
    }, TIMEOUT);
  }, { worktree: true });

  describeParityRepos('publish', (getWorld) => {
    itMatches('exits 2 when the title is missing', getWorld, {
      command: PUBLISH,
      seed: (repoPath) => seedDraft(repoPath, '# T\n\nBody.\n'),
      dispatchArgs: createIssueDispatch(PUBLISH, (repoPath) => [path.join(repoPath, DRAFT)]),
      check: ({ native }) => {
        expect(native.code).toEqual(2);
        expect(native.stdout).toMatch(/^ERROR=.+\n$/);
      }
    });

    itMatches('exits 2 on an unknown draft', getWorld, {
      command: PUBLISH,
      dispatchArgs: createIssueDispatch(PUBLISH, () => ['nope.md', 'Title', '--confirmed', 'bug']),
      check: ({ native }) => expect(native).toEqual({ stdout: 'ERROR=unknown draft: nope.md\n', stderr: '', code: 2 })
    });

    itMatches('takes the exit-4 FALLBACK=chat path without --confirmed, creating nothing', getWorld, {
      command: PUBLISH,
      detachNative: true,
      seed: (repoPath) => seedDraft(repoPath, '# T\n\nBody.\n'),
      dispatchArgs: createIssueDispatch(PUBLISH, (repoPath) => [path.join(repoPath, DRAFT), 'Title', 'bug']),
      check: (parity, repoPath) => {
        expect(parity.native).toEqual({ stdout: 'FALLBACK=chat\n', stderr: '', code: 4 });
        expect(nativeWrites(parity, repoPath)).toEqual([]);
      }
    });
  });
});

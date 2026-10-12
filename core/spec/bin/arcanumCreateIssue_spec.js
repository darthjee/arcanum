import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createGhNeedsWorld, dockerUnavailableWarning, expectGhNeedsRun, runCalls, splitRunArgv
} from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { DOCKER_PRESETS, createFakeDockerBin } from '../support/utils/fakeDockerBin.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SCRIPTS_DIR = path.join(REPO_ROOT, 'arcanum-create-issue', 'scripts');
const START_SCRIPT = path.join(SCRIPTS_DIR, 'start.sh');
const PUBLISH_SCRIPT = path.join(SCRIPTS_DIR, 'publish.sh');
const DRAFTS_DIR = path.join('.claude', 'state', 'create-issue');

// Routing spec for the native-only arcanum-create-issue-start /
// arcanum-create-issue-publish commands (issue #690), run end to end
// through the real arcanum-create-issue/scripts/{start,publish}.sh shims
// and engine_dispatch's --native-only mode. There is no shell twin, so
// there is no parity spec: this spec proves both shims reach
// core/bin/arcanum in every non-docker engine.mode (with only PATH and
// HOME surviving the native path's `env -i`), and that under
// engine.mode=docker both follow the native-only rule of
// docs/agents/architecture/docker-engine.md#native-only-commands: with their real
// migration-status.json status (`docker`, issue #749) they reach
// `docker run` (a passthrough fake `docker`) through their
// `--needs=global-config,gitconfig,gh`: the global config and global
// gitconfig mounted read-only, `GH_TOKEN` forwarded by name only, the
// repo mounted at its own path (so absolute draft paths mean the same
// thing on both sides) and no TTY flag; with Docker unavailable they fall
// back to native on the host with the "Docker is unavailable" warning.
// The real container is compared with native in core/spec/docker/
// (local only).
//
// GitHub access is stubbed by a fake `gh` on PATH; no case reaches a
// REST call (start's preflight only needs `gh auth token`, and publish's
// cases stop at validation or at a failing token). No case needs a
// confirmation prompt either, so `/dev/tty` is never opened.
describe('arcanum-create-issue native-only routing (via the real start.sh / publish.sh shims)', () => {
  let repo;
  let homeDir;
  let fakeGh;

  beforeEach(async () => {
    repo = await createGitFixtureRepo();
    await seedGithubLikeRepo(repo);
    homeDir = await createTempDir('arcanum-core-create-issue-home-');
  });

  afterEach(async () => {
    await repo.cleanup();
    await removeTempDir(homeDir);

    if (fakeGh) {
      await fakeGh.cleanup();
      fakeGh = undefined;
    }
  });

  /**
   * @param {object} [opts] - fake `gh` options.
   * @param {boolean} [opts.authTokenAlwaysFails] - make `gh auth token` fail.
   * @returns {Promise<object>} the env to run a shim with.
   */
  async function buildEnv(opts) {
    fakeGh = await createFakeGhBin(opts);

    return { PATH: `${fakeGh.binDir}:${process.env.PATH}`, HOME: homeDir };
  }

  /**
   * @param {string} script - the shim's path.
   * @param {object} env - the environment.
   * @param {...string} args - the shim's arguments.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runShim(script, env, ...args) {
    return runCommand([script, ...args], repo.repoPath, env);
  }

  /**
   * @param {string} content - the draft's content.
   * @returns {Promise<string>} the seeded draft's absolute path.
   */
  async function seedDraft(content) {
    const dir = path.join(repo.repoPath, DRAFTS_DIR);
    const file = path.join(dir, '20261001-120000.md');

    await mkdir(dir, { recursive: true });
    await writeFile(file, content);

    return file;
  }

  [undefined, 'shell', 'native'].forEach((mode) => {
    describe(`with engine.mode ${mode === undefined ? 'unset' : mode}`, () => {
      beforeEach(async () => {
        if (mode !== undefined) {
          await seedEngineMode(repo, mode);
        }
      });

      it('start.sh --new creates a draft and prints STATUS=new / FILE=', async () => {
        const result = await runShim(START_SCRIPT, await buildEnv(), repo.repoPath, '--new');
        const match = result.stdout.match(/^STATUS=new\nFILE=(.+\/\.claude\/state\/create-issue\/\d{8}-\d{6}\.md)\n$/);

        expect(result.code).toEqual(0);
        expect(result.stderr).toEqual('');
        expect(match).not.toBeNull();
        expect(await readFile(match[1], 'utf8')).toEqual('');
      });

      it('start.sh --resume resumes an existing draft', async () => {
        const draft = await seedDraft('# A title\n');
        const result = await runShim(START_SCRIPT, await buildEnv(), repo.repoPath, '--resume', draft);

        expect(result.code).toEqual(0);
        expect(result.stdout).toMatch(/^STATUS=resumed\nFILE=.+\/20261001-120000\.md\n$/);
      });

      it('start.sh fails the preflight with STATUS=error when gh is not authenticated', async () => {
        const result = await runShim(START_SCRIPT, await buildEnv({ authTokenAlwaysFails: true }), repo.repoPath, '--new');

        expect(result.code).toEqual(1);
        expect(result.stdout).toMatch(/^STATUS=error\nERROR=.+\n$/);
      });

      it('start.sh exits 2 on an unknown --resume draft', async () => {
        const result = await runShim(START_SCRIPT, await buildEnv(), repo.repoPath, '--resume', 'nope.md');

        expect(result.code).toEqual(2);
        expect(result.stdout).toEqual('ERROR=unknown draft: nope.md\n');
      });

      it('publish.sh exits 2 on an empty draft body, creating nothing', async () => {
        const draft = await seedDraft('# Only a title\n');
        const result = await runShim(PUBLISH_SCRIPT, await buildEnv(), repo.repoPath, draft, 'Title', '--confirmed', 'bug');

        expect(result.code).toEqual(2);
        expect(result.stdout).toEqual('ERROR=the draft body is empty\n');
      });

      it('publish.sh exits 2 on a malformed label', async () => {
        const draft = await seedDraft('# T\n\nBody.\n');
        const result = await runShim(PUBLISH_SCRIPT, await buildEnv(), repo.repoPath, draft, 'Title', '--confirmed', 'a,b');

        expect(result.code).toEqual(2);
        expect(result.stdout).toEqual('ERROR=malformed label: "a,b"\n');
      });

      it('publish.sh exits 1 with STATUS=failed and keeps the draft when GitHub is unreachable', async () => {
        const draft = await seedDraft('# T\n\nBody.\n');
        const env = await buildEnv({ authTokenAlwaysFails: true });
        const result = await runShim(PUBLISH_SCRIPT, env, repo.repoPath, draft, 'Title', '--confirmed', 'bug');

        expect(result.code).toEqual(1);
        expect(result.stdout).toMatch(/^STATUS=failed\nERROR=.+\n$/);
        expect(await readFile(draft, 'utf8')).toEqual('# T\n\nBody.\n');
      });
    });
  });

  describe('with engine.mode docker', () => {
    let fakeDocker;
    let world;

    /**
     * Seeds `engine.mode=docker`, builds the gh-needs world and a
     * passthrough fake `docker`, and returns the env to run a shim with:
     * the fake `docker` and fake `gh` first on `PATH`, `HOME`, plus the
     * world's `CLAUDE_CONFIG_DIR`, `GIT_CONFIG_GLOBAL` and `GH_TOKEN`.
     * @param {object} [options] - `createFakeDockerBin` options (default
     *   passthrough).
     * @returns {Promise<object>} the env.
     */
    async function buildDockerEnv(options = { mode: 'passthrough' }) {
      await seedEngineMode(repo, 'docker');
      world = await createGhNeedsWorld();
      fakeDocker = await createFakeDockerBin(options);
      const ghEnv = await buildEnv();

      return { ...ghEnv, ...world.env, PATH: `${fakeDocker.binDir}${path.delimiter}${ghEnv.PATH}` };
    }

    /**
     * Asserts the single `docker run` carries the gh-needs mounts and
     * env (`GH_TOKEN` by name only), the repo mounted at its own path,
     * no TTY flag, and `after` following the image.
     * @param {object[]} calls - the fake docker's logged calls.
     * @param {string[]} after - the expected argv after the image.
     * @returns {void}
     */
    function expectCreateIssueRun(calls, after) {
      expectGhNeedsRun(calls, repo.repoPath, after, world);

      runCalls(calls).forEach(({ argv }) => {
        const { flags } = splitRunArgv(argv);

        expect(flags).not.toContain('-t');
        expect(flags).not.toContain('-it');
        expect(flags).not.toContain('--tty');
      });
    }

    afterEach(async () => {
      await fakeDocker.cleanup();
      await world.cleanup();
    });

    it('start.sh --new runs in docker and creates a draft under the repo mount', async () => {
      const result = await runShim(START_SCRIPT, await buildDockerEnv(), repo.repoPath, '--new');
      const match = result.stdout.match(/^STATUS=new\nFILE=(.+\/\.claude\/state\/create-issue\/\d{8}-\d{6}\.md)\n$/);

      expect(result.code).toEqual(0);
      expect(result.stderr).toEqual('');
      expect(match).not.toBeNull();
      expect(match[1].startsWith(path.join(repo.repoPath, DRAFTS_DIR))).toBeTrue();
      expect(await readFile(match[1], 'utf8')).toEqual('');
      expectCreateIssueRun(await fakeDocker.readCalls(), ['arcanum-create-issue-start', repo.repoPath, '--new']);
    });

    it('start.sh --resume runs in docker with the absolute draft path forwarded as-is', async () => {
      const draft = await seedDraft('# A title\n');
      const result = await runShim(START_SCRIPT, await buildDockerEnv(), repo.repoPath, '--resume', draft);

      expect(result).toEqual({ stdout: `STATUS=resumed\nFILE=${draft}\n`, stderr: '', code: 0 });
      expectCreateIssueRun(
        await fakeDocker.readCalls(), ['arcanum-create-issue-start', repo.repoPath, '--resume', draft]
      );
    });

    it('start.sh exits 2 in docker on an unknown --resume draft', async () => {
      const result = await runShim(START_SCRIPT, await buildDockerEnv(), repo.repoPath, '--resume', 'nope.md');

      expect(result).toEqual({ stdout: 'ERROR=unknown draft: nope.md\n', stderr: '', code: 2 });
      expectCreateIssueRun(
        await fakeDocker.readCalls(), ['arcanum-create-issue-start', repo.repoPath, '--resume', 'nope.md']
      );
    });

    it('publish.sh runs in docker and exits 2 on an empty draft body, creating nothing', async () => {
      const draft = await seedDraft('# Only a title\n');
      const result = await runShim(
        PUBLISH_SCRIPT, await buildDockerEnv(), repo.repoPath, draft, 'Title', '--confirmed', 'bug'
      );

      expect(result).toEqual({ stdout: 'ERROR=the draft body is empty\n', stderr: '', code: 2 });
      expectCreateIssueRun(
        await fakeDocker.readCalls(),
        ['arcanum-create-issue-publish', repo.repoPath, draft, 'Title', '--confirmed', 'bug']
      );
    });

    it('publish.sh runs in docker and exits 2 on a malformed label', async () => {
      const draft = await seedDraft('# T\n\nBody.\n');
      const result = await runShim(
        PUBLISH_SCRIPT, await buildDockerEnv(), repo.repoPath, draft, 'Title', '--confirmed', 'a,b'
      );

      expect(result).toEqual({ stdout: 'ERROR=malformed label: "a,b"\n', stderr: '', code: 2 });
      expectCreateIssueRun(
        await fakeDocker.readCalls(),
        ['arcanum-create-issue-publish', repo.repoPath, draft, 'Title', '--confirmed', 'a,b']
      );
    });

    it('falls back to native on the host with the Docker-unavailable warning when the daemon is down', async () => {
      const draft = await seedDraft('# Only a title\n');
      const env = await buildDockerEnv({ inspect: DOCKER_PRESETS.daemonDown });
      const start = await runShim(START_SCRIPT, env, repo.repoPath, '--resume', 'nope.md');
      const publish = await runShim(PUBLISH_SCRIPT, env, repo.repoPath, draft, 'Title', '--confirmed', 'bug');

      expect(start).toEqual({
        stdout: 'ERROR=unknown draft: nope.md\n',
        stderr: dockerUnavailableWarning('daemon not reachable', 'arcanum-create-issue-start'),
        code: 2
      });
      expect(publish).toEqual({
        stdout: 'ERROR=the draft body is empty\n',
        stderr: dockerUnavailableWarning('daemon not reachable', 'arcanum-create-issue-publish'),
        code: 2
      });
      expect(runCalls(await fakeDocker.readCalls())).toEqual([]);
    });
  });

  it('rejects missing shim arguments with exit 2 and usage on stderr', async () => {
    const env = await buildEnv();
    const start = await runShim(START_SCRIPT, env);
    const publish = await runShim(PUBLISH_SCRIPT, env, repo.repoPath, 'x.md');

    expect(start.code).toEqual(2);
    expect(start.stderr).toContain('Usage:');
    expect(publish.code).toEqual(2);
    expect(publish.stderr).toContain('Usage:');
  });
});

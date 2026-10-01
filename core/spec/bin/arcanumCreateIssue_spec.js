import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
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
// HOME surviving the native path's `env -i`), and that
// engine.mode=docker fails without a fallback.
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

  it('fails without a fallback when engine.mode is docker', async () => {
    await seedEngineMode(repo, 'docker');

    const env = await buildEnv();
    const start = await runShim(START_SCRIPT, env, repo.repoPath, '--new');
    const publish = await runShim(PUBLISH_SCRIPT, env, repo.repoPath, 'x.md', 'Title', '--confirmed');

    expect(start.code).toEqual(1);
    expect(start.stdout).toEqual('');
    expect(start.stderr).toContain(
      'engine.mode=docker is not implemented yet for native-only command \'arcanum-create-issue-start\''
    );
    expect(publish.code).toEqual(1);
    expect(publish.stdout).toEqual('');
    expect(publish.stderr).toContain(
      'engine.mode=docker is not implemented yet for native-only command \'arcanum-create-issue-publish\''
    );
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

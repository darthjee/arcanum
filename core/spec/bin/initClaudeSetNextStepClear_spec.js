import { readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  dockerUnavailableWarning, expectRepoMountOnlyRun, runCalls
} from '../support/factories/engineDispatchDockerSetup.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { DOCKER_PRESETS, createFakeDockerBin } from '../support/utils/fakeDockerBin.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'init-claude', 'scripts', 'set_next_step_clear.sh');

// Routing spec for the native-only init-claude-set-next-step-clear
// command (issue #796), run end to end through the real
// init-claude/scripts/set_next_step_clear.sh shim and engine_dispatch's
// --native-only mode. There is no shell twin, so there is no
// shell-vs-native parity spec: this spec instead proves the shim reaches
// core/bin/arcanum in every non-docker engine.mode, and that under
// engine.mode=docker it follows the native-only rule of
// docs/agents/architecture/docker-engine.md#native-only-commands: with its real
// migration-status.json status (`docker`, like
// init-claude-set-next-step-auto) it reaches `docker run` (a passthrough
// fake `docker`) with only the repo mount and no extra env; with Docker unavailable it falls back to native on
// the host with the "Docker is unavailable" warning. The real container
// is compared with native in core/spec/docker/ (local only).
describe('init-claude-set-next-step-clear native-only routing (via the real set_next_step_clear.sh shim)', () => {
  let repoPath;
  let configFile;
  let env;

  beforeEach(async () => {
    // realpath'd: docker mounts are compared against this exact path.
    repoPath = await realpath(await createTempDir('arcanum-core-next-step-clear-repo-'));
    configFile = path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json');
    env = { PATH: process.env.PATH, HOME: repoPath };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
  });

  /**
   * @param {...string} args - the shim's arguments.
   * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
   */
  function runShim(...args) {
    return runCommand([SHIM_SCRIPT, ...args], repoPath, env);
  }

  /**
   * @returns {Promise<object>} the parsed repo config.
   */
  async function writtenConfig() {
    return JSON.parse(await readFile(configFile, 'utf8'));
  }

  [undefined, 'shell', 'native'].forEach((mode) => {
    describe(`with engine.mode ${mode === undefined ? 'unset' : mode}`, () => {
      beforeEach(async () => {
        if (mode !== undefined) {
          await seedEngineMode({ repoPath }, mode);
        }
      });

      it('writes next_step.clear.<skill> and prints NEXT_STEP_CLEAR=', async () => {
        const first = await runShim(repoPath, 'enhance-issue', 'true');
        const second = await runShim(repoPath, 'discuss-issue', 'false');

        expect(first).toEqual({ stdout: 'NEXT_STEP_CLEAR=enhance-issue=true\n', stderr: '', code: 0 });
        expect(second).toEqual({ stdout: 'NEXT_STEP_CLEAR=discuss-issue=false\n', stderr: '', code: 0 });
        expect(await writtenConfig()).toEqual({
          next_step: { clear: { 'enhance-issue': true, 'discuss-issue': false } }
        });
      });

      it('rejects an unknown skill through core/bin/arcanum', async () => {
        const result = await runShim(repoPath, 'nope', 'true');

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('arcanum: unknown skill \'nope\'');
      });

      it('rejects a bad value through core/bin/arcanum', async () => {
        const result = await runShim(repoPath, 'auto-plan-issue', 'yes');

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('arcanum: invalid value \'yes\': expected true or false');
      });
    });
  });

  describe('with engine.mode docker', () => {
    let fakeDocker;
    let native;

    /**
     * Records the native run to compare against, then builds the fake
     * `docker`, puts it first on `PATH` and seeds `engine.mode=docker`
     * on a fresh repo config.
     * @param {object} [options] - `createFakeDockerBin` options.
     * @returns {Promise<void>} resolves once ready.
     */
    async function useFakeDocker(options) {
      await seedEngineMode({ repoPath }, 'native');
      native = await runShim(repoPath, 'enhance-issue', 'true');
      await rm(configFile);

      fakeDocker = await createFakeDockerBin(options);
      env = { ...env, PATH: `${fakeDocker.binDir}${path.delimiter}${env.PATH}` };
      await seedEngineMode({ repoPath }, 'docker');
    }

    afterEach(async () => {
      await fakeDocker.cleanup();
    });

    it('runs in docker with only the repo mount and no extra env', async () => {
      await useFakeDocker({ mode: 'passthrough' });
      const docker = await runShim(repoPath, 'enhance-issue', 'true');

      expect(native).toEqual({ stdout: 'NEXT_STEP_CLEAR=enhance-issue=true\n', stderr: '', code: 0 });
      expect(docker).toEqual(native);
      expect(await writtenConfig()).toEqual({ next_step: { clear: { 'enhance-issue': true } } });
      expectRepoMountOnlyRun(
        await fakeDocker.readCalls(),
        repoPath,
        ['init-claude-set-next-step-clear', repoPath, 'enhance-issue', 'true']
      );
    });

    it('falls back to native on the host with the Docker-unavailable warning when the daemon is down', async () => {
      await useFakeDocker({ inspect: DOCKER_PRESETS.daemonDown });
      const docker = await runShim(repoPath, 'enhance-issue', 'true');

      expect(docker).toEqual({
        stdout: native.stdout,
        stderr: dockerUnavailableWarning('daemon not reachable', 'init-claude-set-next-step-clear'),
        code: native.code
      });
      expect(await writtenConfig()).toEqual({ next_step: { clear: { 'enhance-issue': true } } });
      expect(runCalls(await fakeDocker.readCalls())).toEqual([]);
    });
  });

  [[], ['REPO'], ['REPO', 'enhance-issue']].forEach((args) => {
    it(`prints usage on stderr before dispatch for ${args.length} argument(s)`, async () => {
      const result = await runShim(...args.map((arg) => (arg === 'REPO' ? repoPath : arg)));

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain('Usage:');
      expect(result.stderr).toContain('set_next_step_clear.sh <repo_path> <skill> <true|false>');
    });
  });
});

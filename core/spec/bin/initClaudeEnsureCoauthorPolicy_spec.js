import { readFile, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  dockerUnavailableWarning, expectRepoMountOnlyRun, runCalls
} from '../support/factories/engineDispatchDockerSetup.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { DOCKER_PRESETS, createFakeDockerBin } from '../support/utils/fakeDockerBin.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';
import { POLICY_LINE } from '../../lib/commands/init-claude/InitClaudeEnsureCoauthorPolicy.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'init-claude', 'scripts', 'ensure_coauthor_policy.sh');
const ADDED = `# Title\n\n## Commit Attribution\n\n${POLICY_LINE}\n`;

// Routing spec for the native-only init-claude-ensure-coauthor-policy
// command (issue #911), run through the real
// init-claude/scripts/ensure_coauthor_policy.sh shim in every engine.mode.
// No shell twin, so no parity spec.
describe('init-claude-ensure-coauthor-policy native-only routing (via the real ensure_coauthor_policy.sh shim)', () => {
  let repoPath;
  let agentsFile;
  let env;

  beforeEach(async () => {
    repoPath = await realpath(await createTempDir('arcanum-core-coauthor-policy-repo-'));
    agentsFile = path.join(repoPath, 'AGENTS.md');
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

  [undefined, 'shell', 'native'].forEach((mode) => {
    describe(`with engine.mode ${mode === undefined ? 'unset' : mode}`, () => {
      beforeEach(async () => {
        if (mode !== undefined) {
          await seedEngineMode({ repoPath }, mode);
        }
      });

      it('adds the policy and prints COAUTHOR_POLICY=added, then present', async () => {
        await writeFile(agentsFile, '# Title\n');

        const first = await runShim(repoPath);
        const second = await runShim(repoPath);

        expect(first).toEqual({ stdout: 'COAUTHOR_POLICY=added\n', stderr: '', code: 0 });
        expect(second).toEqual({ stdout: 'COAUTHOR_POLICY=present\n', stderr: '', code: 0 });
        expect(await readFile(agentsFile, 'utf8')).toEqual(ADDED);
      });

      it('prints COAUTHOR_POLICY=no-agents-md without an AGENTS.md', async () => {
        expect(await runShim(repoPath)).toEqual({ stdout: 'COAUTHOR_POLICY=no-agents-md\n', stderr: '', code: 0 });
      });
    });
  });

  describe('with engine.mode docker', () => {
    let fakeDocker;
    let native;

    /**
     * @param {object} [options] - `createFakeDockerBin` options.
     * @returns {Promise<void>} resolves once ready.
     */
    async function useFakeDocker(options) {
      await seedEngineMode({ repoPath }, 'native');
      await writeFile(agentsFile, '# Title\n');
      native = await runShim(repoPath);
      await rm(agentsFile);
      await writeFile(agentsFile, '# Title\n');

      fakeDocker = await createFakeDockerBin(options);
      env = { ...env, PATH: `${fakeDocker.binDir}${path.delimiter}${env.PATH}` };
      await seedEngineMode({ repoPath }, 'docker');
    }

    afterEach(async () => {
      await fakeDocker.cleanup();
    });

    it('runs in docker with only the repo mount and no extra env', async () => {
      await useFakeDocker({ mode: 'passthrough' });
      const docker = await runShim(repoPath);

      expect(native).toEqual({ stdout: 'COAUTHOR_POLICY=added\n', stderr: '', code: 0 });
      expect(docker).toEqual(native);
      expect(await readFile(agentsFile, 'utf8')).toEqual(ADDED);
      expectRepoMountOnlyRun(
        await fakeDocker.readCalls(),
        repoPath,
        ['init-claude-ensure-coauthor-policy', repoPath]
      );
    });

    it('falls back to native on the host with the Docker-unavailable warning when the daemon is down', async () => {
      await useFakeDocker({ inspect: DOCKER_PRESETS.daemonDown });
      const docker = await runShim(repoPath);

      expect(docker).toEqual({
        stdout: native.stdout,
        stderr: dockerUnavailableWarning('daemon not reachable', 'init-claude-ensure-coauthor-policy'),
        code: native.code
      });
      expect(await readFile(agentsFile, 'utf8')).toEqual(ADDED);
      expect(runCalls(await fakeDocker.readCalls())).toEqual([]);
    });
  });

  it('prints usage on stderr when the repo path is missing', async () => {
    const result = await runShim();

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('Usage:');
  });
});

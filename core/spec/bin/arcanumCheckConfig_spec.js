import { realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  dockerUnavailableWarning, fixedRunFlags, runCalls, splitRunArgv
} from '../support/factories/engineDispatchDockerSetup.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { DOCKER_PRESETS, createFakeDockerBin } from '../support/utils/fakeDockerBin.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'arcanum-check-config', 'scripts', 'check_config.sh');

// Routing spec for the native-only arcanum-check-config command (issue
// #680), run end to end through the real arcanum-check-config/scripts/
// check_config.sh shim and engine_dispatch's --native-only mode. There
// is no shell twin, so there is no shell-vs-native parity spec: this
// spec instead proves the shim reaches core/bin/arcanum in every
// non-docker engine.mode (and that CLAUDE_CONFIG_DIR survives the
// native path's `env -i`), and that under engine.mode=docker it follows
// the native-only rule of docs/agents/specs/docker/dispatch.md: with its
// real migration-status.json status (`docker`, the pilot of #741) it
// reaches `docker run` (a passthrough fake `docker`) with the global
// config mounted read-only and CLAUDE_CONFIG_DIR forwarded, through its
// own `--needs=global-config`; with Docker unavailable it falls back to
// native on the host with the "Docker is unavailable" warning. The real
// container is compared with native in core/spec/docker/ (local only).
describe('arcanum-check-config native-only routing (via the real check_config.sh shim)', () => {
  let repoPath;
  let homeDir;
  let configDir;
  let env;

  beforeEach(async () => {
    // realpath'd: docker mounts are compared against these exact paths.
    repoPath = await realpath(await createTempDir('arcanum-core-check-config-repo-'));
    homeDir = await realpath(await createTempDir('arcanum-core-check-config-home-'));
    configDir = await realpath(await createTempDir('arcanum-core-check-config-global-'));

    await writeFile(
      path.join(configDir, 'arcanum-config.json'),
      JSON.stringify({ git: { authors: ['global@example.com'] } })
    );

    env = { PATH: process.env.PATH, HOME: homeDir, CLAUDE_CONFIG_DIR: configDir };
  });

  afterEach(async () => {
    await removeTempDir(repoPath);
    await removeTempDir(homeDir);
    await removeTempDir(configDir);
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

      it('resolves a global-only key from the forwarded CLAUDE_CONFIG_DIR', async () => {
        const result = await runShim(repoPath, 'git.authors');

        expect(result.code).toEqual(0);
        expect(result.stderr).toEqual('');
        expect(result.stdout).toEqual(`${JSON.stringify({
          key: 'git.authors',
          local: { file: path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), set: false },
          repo: { file: path.join(repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'), set: false },
          global: { file: path.join(configDir, 'arcanum-config.json'), set: true, value: ['global@example.com'] },
          final: { value: ['global@example.com'], source: 'global' }
        }, null, 2)}\n`);
      });

      it('reports engine.mode from the local tier when seeded there', async () => {
        const result = await runShim(repoPath, 'engine.mode');
        const output = JSON.parse(result.stdout);

        expect(result.code).toEqual(0);

        if (mode === undefined) {
          expect(output.final).toEqual({ value: null, source: null });
        } else {
          expect(output.local).toEqual({
            file: path.join(repoPath, '.claude', 'state', 'arcanum-config.json'), set: true, value: mode
          });
          expect(output.final).toEqual({ value: mode, source: 'local' });
        }
      });
    });
  });

  describe('with engine.mode docker', () => {
    let fakeDocker;
    let native;

    /**
     * Builds the fake `docker`, puts it first on `PATH`, and records the
     * native run to compare against.
     * @param {object} [options] - `createFakeDockerBin` options.
     * @returns {Promise<void>} resolves once ready.
     */
    async function useFakeDocker(options) {
      await seedEngineMode({ repoPath }, 'native');
      native = await runShim(repoPath, 'git.authors');

      fakeDocker = await createFakeDockerBin(options);
      env = { ...env, PATH: `${fakeDocker.binDir}${path.delimiter}${env.PATH}` };
      await seedEngineMode({ repoPath }, 'docker');
    }

    afterEach(async () => {
      await fakeDocker.cleanup();
    });

    it('runs in docker with the global config mounted read-only and CLAUDE_CONFIG_DIR forwarded', async () => {
      await useFakeDocker({ mode: 'passthrough' });
      const docker = await runShim(repoPath, 'git.authors');
      const runs = runCalls(await fakeDocker.readCalls());

      expect(native.code).toEqual(0);
      expect(docker).toEqual({ stdout: native.stdout, stderr: '', code: native.code });
      expect(runs.length).toEqual(1);

      const run = splitRunArgv(runs[0].argv);
      const configFile = path.join(configDir, 'arcanum-config.json');

      expect(run.flags.slice(0, fixedRunFlags(repoPath).length)).toEqual(fixedRunFlags(repoPath));
      expect(run.mounts).toEqual([`${repoPath}:${repoPath}`, `${configFile}:${configFile}:ro`]);
      expect(run.envNames).toContain('CLAUDE_CONFIG_DIR');
      expect(runs[0].env.CLAUDE_CONFIG_DIR).toEqual(configDir);
      expect(run.after).toEqual(['arcanum-check-config', repoPath, 'git.authors']);
    });

    it('falls back to native on the host with the Docker-unavailable warning when the daemon is down', async () => {
      await useFakeDocker({ inspect: DOCKER_PRESETS.daemonDown });
      const docker = await runShim(repoPath, 'git.authors');

      expect(docker).toEqual({
        stdout: native.stdout,
        stderr: dockerUnavailableWarning('daemon not reachable', 'arcanum-check-config'),
        code: native.code
      });
      expect(runCalls(await fakeDocker.readCalls())).toEqual([]);
    });
  });

  it('prints usage on stderr when the key argument is missing', async () => {
    const result = await runShim(repoPath);

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('Usage:');
  });

  it('rejects a malformed key through core/bin/arcanum', async () => {
    const result = await runShim(repoPath, 'git');

    expect(result.code).toEqual(1);
    expect(result.stdout).toEqual('');
    expect(result.stderr).toContain('arcanum: invalid key \'git\': expected <namespace.key[.sub...]>');
  });
});

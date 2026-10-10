import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CONFIG_GET,
  CRASH,
  IMAGE,
  SHELL_TWIN,
  createDockerDispatchWorld,
  dockerUnavailableWarning,
  fixedRunFlags,
  gitConfigPairs,
  noNativeWarning,
  notDockerReadyWarning,
  pathWithoutDocker,
  runCalls,
  seedEngineConfig,
  seedRepo,
  splitRunArgv,
  subcommands,
  writeEnvDumpBin
} from '../support/factories/engineDispatchDockerSetup.js';
import { runEngineDispatchFn, writeStatusMap } from '../support/utils/engineDispatchLib.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { DOCKER_PRESETS, createFakeDockerBin } from '../support/utils/fakeDockerBin.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { git, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const STATUSES = ['shell', 'native', 'docker', 'host-only'];

// Dispatch-level specs for arcanum/_lib/engine_dispatch.sh (see
// docs/agents/specs/docker/testing.md). Each case sources the lib in a
// `bash -c` wrapper and points the sourced
// _ENGINE_DISPATCH_MIGRATION_STATUS_FILE at a per-test fixture map.
// The engine.mode=docker cases (resolution table, native-only, argv,
// path arguments, exit codes and streams, image acquisition, nested
// guard) live in their own top-level describe below, with every
// `docker` call going to the fake from fakeDockerBin.js — no daemon,
// no network.
describe('engine_dispatch.sh (status map reading and dispatch)', () => {
  let tmpDir;
  let env;

  beforeEach(async () => {
    tmpDir = await createTempDir('arcanum-core-engine-dispatch-');

    const configDir = path.join(tmpDir, 'global-config');

    await mkdir(configDir);
    env = { PATH: process.env.PATH, HOME: tmpDir, CLAUDE_CONFIG_DIR: configDir };
  });

  afterEach(async () => {
    await removeTempDir(tmpDir);
  });

  describe('_engine_dispatch_status (reading rule)', () => {
    /**
     * @param {object|string|null} map - the fixture map, or `null` for no file.
     * @param {string} command - the command key to read.
     * @param {string} nativeOnly - `"true"` or `"false"`.
     * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
     */
    async function readStatus(map, command, nativeOnly) {
      const file = map === null
        ? path.join(tmpDir, 'missing-status.json')
        : await writeStatusMap(tmpDir, map);

      return runEngineDispatchFn(file, ['_engine_dispatch_status', command, nativeOnly], tmpDir, env);
    }

    const cases = [
      ...STATUSES.map((status) => ({
        label: `"${status}"`, map: { cmd: status }, dual: status, nativeOnly: status === 'shell' ? 'native' : status
      })),
      { label: 'legacy true', map: { cmd: true }, dual: 'native', nativeOnly: 'native' },
      { label: 'legacy false', map: { cmd: false }, dual: 'shell', nativeOnly: 'native' },
      { label: 'a missing key', map: { other: 'native' }, dual: 'shell', nativeOnly: 'native' },
      { label: 'an unknown string value', map: { cmd: 'bogus' }, dual: 'shell', nativeOnly: 'native' },
      { label: 'a number value', map: { cmd: 1 }, dual: 'shell', nativeOnly: 'native' },
      { label: 'a null value', map: { cmd: null }, dual: 'shell', nativeOnly: 'native' },
      { label: 'an object value', map: { cmd: { status: 'native' } }, dual: 'shell', nativeOnly: 'native' },
      { label: 'a missing map file', map: null, dual: 'shell', nativeOnly: 'native' },
      { label: 'a malformed map file', map: '{"cmd": "native",', dual: 'shell', nativeOnly: 'native' }
    ];

    cases.forEach(({ label, map, dual, nativeOnly }) => {
      describe(`with ${label}`, () => {
        it(`prints ${dual} for a dual entrypoint`, async () => {
          const result = await readStatus(map, 'cmd', 'false');

          expect(result.code).toEqual(0);
          expect(result.stdout).toEqual(`${dual}\n`);
        });

        it(`prints ${nativeOnly} for a native-only entrypoint`, async () => {
          const result = await readStatus(map, 'cmd', 'true');

          expect(result.code).toEqual(0);
          expect(result.stdout).toEqual(`${nativeOnly}\n`);
        });
      });
    });
  });

  describe('engine_dispatch (shell and native modes)', () => {
    let repo;

    beforeEach(async () => {
      repo = { repoPath: path.join(tmpDir, 'repo') };

      await mkdir(path.join(repo.repoPath, '.claude', 'configuration'), { recursive: true });
      await git(['init', '-q'], repo.repoPath);
      await writeFile(
        path.join(repo.repoPath, '.claude', 'configuration', 'arcanum-repo-config.json'),
        JSON.stringify({ 'auto-fix-all': { auto_merge: true } })
      );
    });

    /**
     * Dispatches `command` with `config_get_shell.sh` as its shell twin,
     * under a fixture map giving `command` the status `status`.
     * @param {string} command - the dispatched command.
     * @param {string} status - its status in the fixture map.
     * @returns {Promise<{stdout: string, stderr: string, code: number}>} the result.
     */
    async function dispatch(command, status) {
      const file = await writeStatusMap(tmpDir, { [command]: status });

      return runEngineDispatchFn(
        file,
        ['engine_dispatch', repo.repoPath, command, SHELL_TWIN, '--', repo.repoPath, 'auto_merge'],
        repo.repoPath,
        env
      );
    }

    // dispatch-fixture-crash's native side always crashes while its
    // shell twin prints `true`, so the outcome tells which side ran.
    describe('with engine.mode shell', () => {
      beforeEach(async () => {
        await seedEngineMode(repo, 'shell');
      });

      STATUSES.forEach((status) => {
        it(`runs the shell implementation for status "${status}"`, async () => {
          const result = await dispatch(CRASH, status);

          expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
        });
      });
    });

    describe('with engine.mode native', () => {
      beforeEach(async () => {
        await seedEngineMode(repo, 'native');
      });

      it('falls back to the shell implementation with the warning for status "shell"', async () => {
        const result = await dispatch(CRASH, 'shell');

        expect(result).toEqual({ stdout: 'true\n', stderr: noNativeWarning(CRASH), code: 0 });
      });

      STATUSES.filter((status) => status !== 'shell').forEach((status) => {
        it(`runs the native implementation, with no fallback, for status "${status}"`, async () => {
          const result = await dispatch(CRASH, status);

          expect(result.code).not.toEqual(0);
          expect(result.stdout).toEqual('');
          expect(result.stderr).not.toContain('Warning:');
        });

        it(`matches the shell output natively, with no warning, for status "${status}"`, async () => {
          const result = await dispatch(CONFIG_GET, status);

          expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
        });
      });
    });
  });
});

describe('engine_dispatch.sh (engine.mode docker)', () => {
  let world;
  let fake;

  /**
   * Builds the fake docker (put first on the world's PATH).
   * @param {object} [opts] - createFakeDockerBin options.
   * @returns {Promise<object>} the env to dispatch with.
   */
  async function useFakeDocker(opts = {}) {
    fake = await createFakeDockerBin(opts);

    return { ...world.env, PATH: `${fake.binDir}${path.delimiter}${world.env.PATH}` };
  }

  /**
   * @returns {Promise<object>} the single logged `docker run` call.
   */
  async function onlyRunCall() {
    const runs = runCalls(await fake.readCalls());

    expect(runs.length).toEqual(1);

    return runs[0];
  }

  beforeEach(async () => {
    world = await createDockerDispatchWorld();
    fake = null;
    await seedEngineConfig(world.repoPath);
  });

  afterEach(async () => {
    if (fake) await fake.cleanup();
    await world.cleanup();
  });

  describe('resolution table', () => {
    it('row 1: with ARCANUM_IN_DOCKER=1 runs native directly, with no docker call at all', async () => {
      const env = await useFakeDocker();
      const result = await world.dispatch({ env: { ...env, ARCANUM_IN_DOCKER: '1' } });

      expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
      expect(await fake.readCalls()).toEqual([]);
    });

    it('row 2: runs a host-only command natively on the host, with no warning and no docker call', async () => {
      const env = await useFakeDocker();
      const result = await world.dispatch({ status: 'host-only', env });

      expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
      expect(await fake.readCalls()).toEqual([]);
    });

    it('row 3: runs a "native" command natively on the host with the not-docker-ready warning', async () => {
      const env = await useFakeDocker();
      const result = await world.dispatch({ status: 'native', env });

      expect(result).toEqual({ stdout: 'true\n', stderr: notDockerReadyWarning(CONFIG_GET), code: 0 });
      expect(await fake.readCalls()).toEqual([]);
    });

    it('row 3b: runs a "shell" command\'s shell script with the no-native warning', async () => {
      const env = await useFakeDocker();
      const result = await world.dispatch({ command: CRASH, status: 'shell', env });

      expect(result).toEqual({ stdout: 'true\n', stderr: noNativeWarning(CRASH), code: 0 });
      expect(await fake.readCalls()).toEqual([]);
    });

    it('row 4: falls back to native when no docker binary is on PATH', async () => {
      const env = { ...world.env, PATH: await pathWithoutDocker(world.tmpDir) };
      const result = await world.dispatch({ env });

      expect(result).toEqual({
        stdout: 'true\n', stderr: dockerUnavailableWarning('docker not found', CONFIG_GET), code: 0
      });
    });

    it('row 4: falls back to native when image inspect reports the daemon unreachable', async () => {
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.daemonDown });
      const result = await world.dispatch({ env });

      expect(result).toEqual({
        stdout: 'true\n', stderr: dockerUnavailableWarning('daemon not reachable', CONFIG_GET), code: 0
      });
      expect(subcommands(await fake.readCalls())).toEqual(['inspect']);
    });

    it('row 4: falls back to native when the image is missing and pull and build both fail', async () => {
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.imageMissing, pull: { code: 1 }, build: { code: 1 } });
      const result = await world.dispatch({ env });

      expect(result).toEqual({
        stdout: 'true\n',
        stderr: `Info: pulling ${IMAGE} (first docker call for this version)…\n` +
          `Info: building ${IMAGE}…\n` +
          dockerUnavailableWarning(`image ${IMAGE} unavailable`, CONFIG_GET),
        code: 0
      });
      expect(runCalls(await fake.readCalls())).toEqual([]);
    }, 20000);

    it('row 5: runs a "docker" command through docker run, with no warning', async () => {
      const env = await useFakeDocker({ run: { stdout: 'from-container\n' } });
      const result = await world.dispatch({ env });

      expect(result).toEqual({ stdout: 'from-container\n', stderr: '', code: 0 });
      expect(subcommands(await fake.readCalls())).toEqual(['inspect', 'run']);
      expect((await fake.readCalls())[0].argv).toEqual(['image', 'inspect', '--format', '{{.Id}}', IMAGE]);
    });

    it('row 5: treats a missing status key as "shell" for a dual entrypoint (no container)', async () => {
      const env = await useFakeDocker();
      const result = await world.dispatch({ command: CRASH, status: null, env });

      expect(result).toEqual({ stdout: 'true\n', stderr: noNativeWarning(CRASH), code: 0 });
      expect(await fake.readCalls()).toEqual([]);
    });
  });

  describe('native-only commands', () => {
    /**
     * @param {string} status - the status to give the command.
     * @param {object} env - the env to dispatch with.
     * @returns {Promise<object>} the result.
     */
    function dispatchNativeOnly(status, env) {
      return world.dispatch({ status, env, shellScript: '', flags: ['--native-only'] });
    }

    it('runs a "docker" native-only command through docker run, with no hard error', async () => {
      const env = await useFakeDocker({ run: { stdout: 'from-container\n' } });
      const result = await dispatchNativeOnly('docker', env);

      expect(result).toEqual({ stdout: 'from-container\n', stderr: '', code: 0 });
      await onlyRunCall();
    });

    ['native', 'shell', null].forEach((status) => {
      it(`runs natively on the host with the not-docker-ready warning for status ${status}`, async () => {
        const env = await useFakeDocker();
        const result = await dispatchNativeOnly(status, env);

        expect(result).toEqual({ stdout: 'true\n', stderr: notDockerReadyWarning(CONFIG_GET), code: 0 });
        expect(await fake.readCalls()).toEqual([]);
      });
    });

    it('runs natively on the host, with no warning, for status "host-only"', async () => {
      const env = await useFakeDocker();
      const result = await dispatchNativeOnly('host-only', env);

      expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
    });

    it('falls back to native with the Docker-unavailable warning when Docker is unavailable', async () => {
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.daemonDown });
      const result = await dispatchNativeOnly('docker', env);

      expect(result).toEqual({
        stdout: 'true\n', stderr: dockerUnavailableWarning('daemon not reachable', CONFIG_GET), code: 0
      });
    });
  });

  describe('flag validation', () => {
    [
      ['--needs=bogus', '--needs', 'bogus'],
      ['--needs=gh,', '--needs', 'gh,'],
      ['--path-arg=0:ro', '--path-arg', '0:ro'],
      ['--path-arg=1:rx', '--path-arg', '1:rx'],
      ['--path-arg=x', '--path-arg', 'x']
    ].forEach(([flag, name, value]) => {
      it(`rejects ${flag}`, async () => {
        const env = await useFakeDocker();
        const result = await world.dispatch({ flags: [flag], env });

        expect(result).toEqual({ stdout: '', stderr: `Error: engine_dispatch: invalid ${name} '${value}'.\n`, code: 1 });
      });
    });

    it('ignores --needs and --path-arg outside the container path', async () => {
      await seedEngineConfig(world.repoPath, {}, 'native');
      const result = await world.dispatch({ flags: ['--needs=gh,remote', '--path-arg=2:ro'] });

      expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
    });
  });

  describe('docker run argv', () => {
    const repoGitConfig = () => [['safe.directory', world.repoPath]];

    it('uses the fixed flags in order, then the image and the native argv', async () => {
      const env = await useFakeDocker();

      await world.dispatch({ env });
      const { argv, env: runEnv } = await onlyRunCall();
      const run = splitRunArgv(argv);

      expect(run.flags.slice(0, fixedRunFlags(world.repoPath).length)).toEqual(fixedRunFlags(world.repoPath));
      expect(run.image).toEqual(IMAGE);
      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge']);
      expect(run.mounts).toEqual([`${world.repoPath}:${world.repoPath}`]);
      expect(run.flags).not.toContain('-t');
      expect(run.flags).not.toContain('--name');
      expect([...run.envNames].sort()).toEqual(
        ['ARCANUM_IN_DOCKER', 'ARCANUM_REPO_PATH', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_KEY_0', 'GIT_CONFIG_VALUE_0']
      );
      expect(runEnv.ARCANUM_IN_DOCKER).toEqual('1');
      expect(runEnv.ARCANUM_REPO_PATH).toEqual(world.repoPath);
      expect(gitConfigPairs(runEnv)).toEqual(repoGitConfig());
    });

    it('prepends the repo path to the native argv with --prepend-repo-path', async () => {
      const env = await useFakeDocker();

      await world.dispatch({ env, flags: ['--prepend-repo-path'], args: ['auto_merge'] });
      const run = splitRunArgv((await onlyRunCall()).argv);

      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge']);
    });

    it('passes every -e as a name only, skips unset names, and never forwards HOME or PATH', async () => {
      const env = await useFakeDocker();

      await world.dispatch({ env: { ...env, FOO: 'foo-value' }, flags: ['HOME', 'PATH', 'FOO', 'UNSET_VAR'] });
      const { argv, env: runEnv } = await onlyRunCall();
      const run = splitRunArgv(argv);

      expect(run.envNames).toContain('FOO');
      expect(run.envNames).not.toContain('HOME');
      expect(run.envNames).not.toContain('PATH');
      expect(run.envNames).not.toContain('UNSET_VAR');
      expect(run.envNames.filter((name) => name.includes('='))).toEqual([]);
      expect(runEnv.FOO).toEqual('foo-value');
      expect(argv.join(' ')).not.toContain('foo-value');
    });

    it('mounts the git common dir and adds its safe.directory for a worktree', async () => {
      const worktree = path.join(world.tmpDir, 'worktree');

      await git(['-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'seed'],
        world.repoPath);
      await git(['worktree', 'add', '-q', '-b', 'wt', worktree], world.repoPath);
      await seedRepo(worktree);
      await seedEngineConfig(worktree);
      const commonDir = (await runCommand(
        ['git', '-C', worktree, 'rev-parse', '--path-format=absolute', '--git-common-dir'], worktree
      )).stdout.trim();
      const env = await useFakeDocker();

      await world.dispatch({ env, repo: worktree, args: [worktree, 'auto_merge'] });
      const { argv, env: runEnv } = await onlyRunCall();

      expect(splitRunArgv(argv).mounts).toEqual([`${worktree}:${worktree}`, `${commonDir}:${commonDir}`]);
      expect(gitConfigPairs(runEnv)).toEqual([['safe.directory', worktree], ['safe.directory', commonDir]]);
    });

    it('mounts the engine.log.location directory when it is set outside the repo', async () => {
      const logDir = path.join(world.tmpDir, 'logs');

      await mkdir(logDir);
      await seedEngineConfig(world.repoPath, { log: { location: logDir } });
      const env = await useFakeDocker();

      await world.dispatch({ env });

      expect(splitRunArgv((await onlyRunCall()).argv).mounts)
        .toEqual([`${world.repoPath}:${world.repoPath}`, `${logDir}:${logDir}`]);
    });

    it('does not mount an engine.log.location inside the repo', async () => {
      await seedEngineConfig(world.repoPath, { log: { location: path.join(world.repoPath, 'logs') } });
      const env = await useFakeDocker();

      await world.dispatch({ env });

      expect(splitRunArgv((await onlyRunCall()).argv).mounts).toEqual([`${world.repoPath}:${world.repoPath}`]);
    });

    describe('--needs=global-config', () => {
      it('mounts arcanum-config.json read-only and passes CLAUDE_CONFIG_DIR', async () => {
        const file = path.join(world.configDir, 'arcanum-config.json');

        await writeFile(file, '{}');
        const env = await useFakeDocker();

        await world.dispatch({ env, flags: ['--needs=global-config'] });
        const { argv, env: runEnv } = await onlyRunCall();
        const run = splitRunArgv(argv);

        expect(run.mounts).toEqual([`${world.repoPath}:${world.repoPath}`, `${file}:${file}:ro`]);
        expect(run.envNames).toContain('CLAUDE_CONFIG_DIR');
        expect(runEnv.CLAUDE_CONFIG_DIR).toEqual(world.configDir);
      });

      it('mounts nothing when arcanum-config.json does not exist, still passing CLAUDE_CONFIG_DIR', async () => {
        const env = await useFakeDocker();

        await world.dispatch({ env, flags: ['--needs=global-config'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(splitRunArgv(argv).mounts).toEqual([`${world.repoPath}:${world.repoPath}`]);
        expect(runEnv.CLAUDE_CONFIG_DIR).toEqual(world.configDir);
      });
    });

    describe('--needs=gitconfig', () => {
      it('mounts $GIT_CONFIG_GLOBAL read-only and passes it', async () => {
        const file = path.join(world.tmpDir, 'custom-gitconfig');

        await writeFile(file, '[user]\n\tname = T\n');
        const env = await useFakeDocker();

        await world.dispatch({ env: { ...env, GIT_CONFIG_GLOBAL: file }, flags: ['--needs=gitconfig'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(splitRunArgv(argv).mounts).toEqual([`${world.repoPath}:${world.repoPath}`, `${file}:${file}:ro`]);
        expect(runEnv.GIT_CONFIG_GLOBAL).toEqual(file);
      });

      it('falls back to ~/.gitconfig', async () => {
        const file = path.join(world.tmpDir, '.gitconfig');

        await writeFile(file, '[user]\n\tname = T\n');
        const env = await useFakeDocker();

        await world.dispatch({ env, flags: ['--needs=gitconfig'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(splitRunArgv(argv).mounts).toContain(`${file}:${file}:ro`);
        expect(runEnv.GIT_CONFIG_GLOBAL).toEqual(file);
      });
    });

    describe('--needs=gh', () => {
      let gh;

      beforeEach(async () => {
        gh = await createFakeGhBin();
      });

      afterEach(async () => {
        await gh.cleanup();
      });

      /**
       * @param {string} origin - the origin URL to set.
       * @returns {Promise<object>} the env, with fake gh and docker on PATH.
       */
      async function ghEnv(origin) {
        await git(['remote', 'add', 'origin', origin], world.repoPath);
        const env = await useFakeDocker();

        return { ...env, PATH: `${gh.binDir}${path.delimiter}${env.PATH}` };
      }

      it('passes an already-set GH_TOKEN by name only', async () => {
        const env = await ghEnv('https://github.com/darthjee/arcanum.git');

        await world.dispatch({ env: { ...env, GH_TOKEN: 'tok-from-env' }, flags: ['--needs=gh'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(splitRunArgv(argv).envNames).toContain('GH_TOKEN');
        expect(runEnv.GH_TOKEN).toEqual('tok-from-env');
        expect(argv.join(' ')).not.toContain('tok-from-env');
      });

      it('resolves the token on the host with gh auth token when none is set', async () => {
        const env = await ghEnv('https://github.com/darthjee/arcanum.git');

        await world.dispatch({ env, flags: ['--needs=gh'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(runEnv.GH_TOKEN).toEqual('fake-gh-token');
        expect(argv.join(' ')).not.toContain('fake-gh-token');
      });

      it('passes GH_HOST and GH_ENTERPRISE_TOKEN instead of GH_TOKEN on GitHub Enterprise', async () => {
        const env = await ghEnv('https://ghe.example.com/darthjee/arcanum.git');

        await world.dispatch({ env: { ...env, GH_TOKEN: 'ghe-token' }, flags: ['--needs=gh'] });
        const { argv, env: runEnv } = await onlyRunCall();
        const run = splitRunArgv(argv);

        expect(run.envNames).not.toContain('GH_TOKEN');
        expect(runEnv.GH_HOST).toEqual('ghe.example.com');
        expect(runEnv.GH_ENTERPRISE_TOKEN).toEqual('ghe-token');
        expect(argv.join(' ')).not.toContain('ghe-token');
      });
    });

    describe('--needs=remote', () => {
      it('forwards the ssh agent and known_hosts for an ssh remote', async () => {
        const knownHosts = path.join(world.tmpDir, '.ssh', 'known_hosts');
        const sock = path.join(world.tmpDir, 'agent.sock');

        await mkdir(path.dirname(knownHosts));
        await writeFile(knownHosts, '');
        await writeFile(sock, '');
        await git(['remote', 'add', 'origin', 'git@github.com:darthjee/arcanum.git'], world.repoPath);
        const env = await useFakeDocker();

        await world.dispatch({ env: { ...env, SSH_AUTH_SOCK: sock }, flags: ['--needs=remote'] });
        const { argv, env: runEnv } = await onlyRunCall();
        const run = splitRunArgv(argv);
        const containerSock = process.platform === 'darwin'
          ? '/run/host-services/ssh-auth.sock'
          : '/run/arcanum/ssh-agent.sock';
        const hostSock = process.platform === 'darwin' ? containerSock : sock;

        expect(run.mounts).toContain(`${knownHosts}:${knownHosts}:ro`);
        expect(run.mounts).toContain(`${hostSock}:${containerSock}`);
        expect(runEnv.SSH_AUTH_SOCK).toEqual(containerSock);
        expect(runEnv.GIT_SSH_COMMAND)
          .toEqual(`ssh -o UserKnownHostsFile=${knownHosts} -o StrictHostKeyChecking=yes`);
      });

      it('passes GH_TOKEN and the gh credential helper for an https remote', async () => {
        await git(['remote', 'add', 'origin', 'https://github.com/darthjee/arcanum.git'], world.repoPath);
        const env = await useFakeDocker();

        await world.dispatch({ env: { ...env, GH_TOKEN: 'https-token' }, flags: ['--needs=remote'] });
        const { argv, env: runEnv } = await onlyRunCall();

        expect(runEnv.GH_TOKEN).toEqual('https-token');
        expect(gitConfigPairs(runEnv)).toEqual([
          ...repoGitConfig(),
          ['credential.helper', ''],
          ['credential.helper', '!gh auth git-credential']
        ]);
        expect(argv.join(' ')).not.toContain('https-token');
      });
    });
  });

  describe('path arguments', () => {
    let outside;

    beforeEach(async () => {
      outside = path.join(world.tmpDir, 'scratch');
      await mkdir(outside);
    });

    /**
     * Dispatches with one extra path argument at index 3.
     * @param {string} value - the path argument.
     * @param {string} mode - `ro` or `rw`.
     * @param {object} [opts] - extra dispatch options (e.g. `cwd`).
     * @returns {Promise<{mounts: string[], after: string[]}>} the run's mounts and native argv.
     */
    async function dispatchPathArg(value, mode, opts = {}) {
      const env = await useFakeDocker();

      await world.dispatch({
        env, flags: [`--path-arg=3:${mode}`], args: [world.repoPath, 'auto_merge', value], ...opts
      });

      return splitRunArgv((await onlyRunCall()).argv);
    }

    const repoMount = () => `${world.repoPath}:${world.repoPath}`;

    it('mounts an existing file outside the repo read-only for ro', async () => {
      const file = path.join(outside, 'body.md');

      await writeFile(file, 'body');
      const run = await dispatchPathArg(file, 'ro');

      expect(run.mounts).toEqual([repoMount(), `${file}:${file}:ro`]);
      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge', file]);
    });

    it('mounts the parent directory read-write for rw, even when the file does not exist yet', async () => {
      const run = await dispatchPathArg(path.join(outside, 'out.json'), 'rw');

      expect(run.mounts).toEqual([repoMount(), `${outside}:${outside}`]);
    });

    it('mounts nothing extra for a path inside the repo', async () => {
      const file = path.join(world.repoPath, 'body.md');

      await writeFile(file, 'body');
      const run = await dispatchPathArg(file, 'ro');

      expect(run.mounts).toEqual([repoMount()]);
    });

    it('rewrites a relative path landing outside the repo to absolute, and mounts it', async () => {
      const file = path.join(outside, 'body.md');

      await writeFile(file, 'body');
      const run = await dispatchPathArg('body.md', 'ro', { cwd: outside });

      expect(run.mounts).toEqual([repoMount(), `${file}:${file}:ro`]);
      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge', file]);
    });

    it('keeps a relative path inside the repo as-is, with no extra mount', async () => {
      await writeFile(path.join(world.repoPath, 'body.md'), 'body');
      const run = await dispatchPathArg('body.md', 'ro');

      expect(run.mounts).toEqual([repoMount()]);
      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge', 'body.md']);
    });

    it('ignores a declared index that is absent on this call', async () => {
      const env = await useFakeDocker();

      await world.dispatch({ env, flags: ['--path-arg=5:ro'] });

      expect(splitRunArgv((await onlyRunCall()).argv).mounts).toEqual([repoMount()]);
    });

    it('ignores an empty-string path argument', async () => {
      const run = await dispatchPathArg('', 'ro');

      expect(run.mounts).toEqual([repoMount()]);
      expect(run.after).toEqual([CONFIG_GET, world.repoPath, 'auto_merge', '']);
    });

    it('does not mount a missing ro file', async () => {
      const run = await dispatchPathArg(path.join(outside, 'missing.md'), 'ro');

      expect(run.mounts).toEqual([repoMount()]);
    });

    it('does not mount a missing rw parent', async () => {
      const run = await dispatchPathArg(path.join(outside, 'no-such-dir', 'out.json'), 'rw');

      expect(run.mounts).toEqual([repoMount()]);
    });

    it('collapses an ro file nested under an rw parent, and duplicate sources, into one mount', async () => {
      const file = path.join(outside, 'body.md');

      await writeFile(file, 'body');
      const env = await useFakeDocker();

      await world.dispatch({
        env,
        flags: ['--path-arg=3:rw', '--path-arg=4:ro', '--path-arg=5:ro'],
        args: [world.repoPath, 'auto_merge', path.join(outside, 'out.json'), file, file]
      });

      expect(splitRunArgv((await onlyRunCall()).argv).mounts).toEqual([repoMount(), `${outside}:${outside}`]);
    });
  });

  describe('exit codes and streams', () => {
    [0, 1, 3, 4, 130].forEach((code) => {
      it(`passes a docker run exit code ${code} through, keeping stdout and stderr separate`, async () => {
        const env = await useFakeDocker({ run: { code, stdout: 'out\n', stderr: 'err\n' } });
        const result = await world.dispatch({ env });

        expect(result).toEqual({ stdout: 'out\n', stderr: 'err\n', code });
        await onlyRunCall();
      });
    });

    [125, 126, 127].forEach((code) => {
      it(`falls back to native once on docker run exit ${code}, Docker's stderr before the warning`, async () => {
        const dockerError = `docker: Error response from daemon: failed with ${code}.\n`;
        const env = await useFakeDocker({ run: { code, stderr: dockerError } });
        const result = await world.dispatch({ env });

        expect(result).toEqual({
          stdout: 'true\n',
          stderr: dockerError + dockerUnavailableWarning(`docker run failed with ${code}`, CONFIG_GET),
          code: 0
        });
        await onlyRunCall();
      });
    });

    describe('passthrough mode (the real core/bin/arcanum with the container argv and env)', () => {
      it('produces the native output and exit code', async () => {
        const env = await useFakeDocker({ mode: 'passthrough' });
        const result = await world.dispatch({ env });

        expect(result).toEqual({ stdout: 'true\n', stderr: '', code: 0 });
        await onlyRunCall();
      });

      it('propagates a native crash with no fallback', async () => {
        const env = await useFakeDocker({ mode: 'passthrough' });
        const result = await world.dispatch({ command: CRASH, env });

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('arcanum: dispatch-fixture: simulated native crash');
        expect(result.stderr).not.toContain('Warning:');
      });
    });
  });

  describe('image acquisition', () => {
    let install;

    beforeEach(async () => {
      install = path.join(world.tmpDir, 'install');
      await mkdir(install);
    });

    it('pulls a missing image, printing the Info line on stderr only', async () => {
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.imageMissing, run: { stdout: 'ran\n' } });
      const result = await world.dispatch({ env });
      const calls = await fake.readCalls();

      expect(result).toEqual({
        stdout: 'ran\n', stderr: `Info: pulling ${IMAGE} (first docker call for this version)…\n`, code: 0
      });
      expect(calls.filter(({ argv }) => argv[0] === 'pull').map(({ argv }) => argv)).toEqual([['pull', IMAGE]]);
      expect(subcommands(calls)).not.toContain('build');
      expect(subcommands(calls).at(-1)).toEqual('run');
    }, 20000);

    it('builds the runtime target with the version build arg when the pull fails', async () => {
      await writeFile(path.join(install, 'arcanum.json'), JSON.stringify({ version: '1.2.3' }));
      const ref = 'darthjee/arcanum:1.2.3';
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.imageMissing, pull: { code: 1 }, run: { stdout: 'ran\n' } });
      const result = await world.dispatch({ env, overrides: { installRoot: install } });
      const calls = await fake.readCalls();

      expect(result).toEqual({
        stdout: 'ran\n',
        stderr: `Info: pulling ${ref} (first docker call for this version)…\nInfo: building ${ref}…\n`,
        code: 0
      });
      expect(calls.filter(({ argv }) => argv[0] === 'build').map(({ argv }) => argv)).toEqual([[
        'build', '-f', path.join(install, 'core', 'Dockerfile'), '--target', 'runtime',
        '--build-arg', 'ARCANUM_VERSION=1.2.3', '-t', ref, install
      ]]);
      expect(splitRunArgv((await onlyRunCall()).argv).image).toEqual(ref);
    }, 20000);

    it('tags a dev install (no exact tag on HEAD) local-<sha> and builds it without pulling', async () => {
      await git(['init', '-q'], install);
      await git(['-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'dev'], install);
      const sha = (await runCommand(['git', '-C', install, 'rev-parse', '--short', 'HEAD'], install)).stdout.trim();
      const ref = `darthjee/arcanum:local-${sha}`;
      const env = await useFakeDocker({ inspect: DOCKER_PRESETS.imageMissing, run: { stdout: 'ran\n' } });
      const result = await world.dispatch({ env, overrides: { installRoot: install } });
      const calls = await fake.readCalls();

      expect(result).toEqual({ stdout: 'ran\n', stderr: `Info: building ${ref}…\n`, code: 0 });
      expect(subcommands(calls)).not.toContain('pull');
      expect(calls.find(({ argv }) => argv[0] === 'build').argv).toContain(`ARCANUM_VERSION=local-${sha}`);
      expect(splitRunArgv((await onlyRunCall()).argv).image).toEqual(ref);
    }, 20000);
  });

  describe('nested guard env', () => {
    let envDumpBin;

    beforeEach(async () => {
      envDumpBin = await writeEnvDumpBin(world.tmpDir);
    });

    /**
     * @param {object} extraEnv - env on top of the world's.
     * @returns {Promise<object>} the env the native call received.
     */
    async function nativeEnv(extraEnv) {
      const result = await world.dispatch({
        env: { ...world.env, ...extraEnv },
        overrides: { image: IMAGE, nativeBin: envDumpBin }
      });

      expect(result.code).toEqual(0);

      return JSON.parse(result.stdout);
    }

    const infra = {
      GH_TOKEN: 'nested-token',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'safe.directory',
      GIT_CONFIG_VALUE_0: '/somewhere',
      GIT_CONFIG_GLOBAL: '/somewhere/gitconfig',
      UNRELATED: 'nope'
    };

    it('forwards the set container infrastructure env inside the container', async () => {
      const received = await nativeEnv({ ...infra, ARCANUM_IN_DOCKER: '1' });

      expect(received.ARCANUM_IN_DOCKER).toEqual('1');
      expect(received.HOME).toEqual(world.tmpDir);
      expect(received.CLAUDE_CONFIG_DIR).toEqual(world.configDir);
      expect(received.GH_TOKEN).toEqual('nested-token');
      expect(received.GIT_CONFIG_COUNT).toEqual('1');
      expect(received.GIT_CONFIG_KEY_0).toEqual('safe.directory');
      expect(received.GIT_CONFIG_VALUE_0).toEqual('/somewhere');
      expect(received.GIT_CONFIG_GLOBAL).toEqual('/somewhere/gitconfig');
      expect(received.UNRELATED).toBeUndefined();
      expect(received.GH_HOST).toBeUndefined();
      expect(received.SSH_AUTH_SOCK).toBeUndefined();
    });

    it('forwards nothing extra on the host', async () => {
      await seedEngineConfig(world.repoPath, {}, 'native');
      const received = await nativeEnv(infra);

      expect(received.ARCANUM_REPO_PATH).toEqual(world.repoPath);
      ['HOME', 'CLAUDE_CONFIG_DIR', 'GH_TOKEN', 'GIT_CONFIG_COUNT', 'GIT_CONFIG_GLOBAL', 'UNRELATED'].forEach((name) => {
        expect(received[name]).withContext(name).toBeUndefined();
      });
    });
  });
});

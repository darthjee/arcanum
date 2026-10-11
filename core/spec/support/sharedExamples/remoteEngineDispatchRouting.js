import path from 'node:path';
import {
  HTTPS_NOT_ALLOWED, HTTPS_ORIGIN, SSH_ORIGIN, containerSshSock, createRemoteNeedsWorld, expectRemoteNeedsRun,
  nativeCommandFailed
} from '../factories/engineDispatchDockerSetup.js';
import { mergeEngineMode } from '../utils/engineMode.js';
import { createFakeDockerBin } from '../utils/fakeDockerBin.js';
import { SSH_REMOTE_FAILURE } from '../utils/fakeSshBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { runCommand, seedOriginUrl } from '../utils/runCommand.js';
import { itRoutesEngineDispatch } from './engineDispatchRouting.js';

/**
 * Builds one case's world and runs `prepare` in it, with `origin` set
 * to `originUrl` and `engine.mode` seeded first.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - the engine mode.
 * @param {string} originUrl - the `origin` URL to seed.
 * @param {(repo: {repoPath: string}, mode: string, world: object) => Promise<object>} prepare - the caller's `prepare`.
 * @returns {Promise<{world: object, args: string[], env: object, input?: string, cwd?: string, cleanup: () => Promise<void>}>}
 *   the world and the prepared invocation.
 */
async function prepareInWorld(repo, mode, originUrl, prepare) {
  const world = await createRemoteNeedsWorld();

  await seedOriginUrl(repo.repoPath, originUrl);
  await mergeEngineMode(repo, mode);

  const prepared = await prepare(repo, mode, world);

  return {
    ...prepared,
    world,
    env: { ...world.env, ...prepared.env },
    cleanup: async () => {
      if (prepared.cleanup) await prepared.cleanup();
      await world.cleanup();
    }
  };
}

/**
 * Asserts every call the world's fake `ssh` logged came from the
 * in-"container" git, through the forwarded `GIT_SSH_COMMAND` and
 * agent socket — and that there was at least one.
 * @param {object} world - the `createRemoteNeedsWorld`.
 * @returns {Promise<void>} resolves once asserted.
 */
async function expectContainerSshCalls(world) {
  const sshCalls = await world.fakeSsh.readCalls();

  expect(sshCalls.length).withContext('fake ssh calls').toBeGreaterThan(0);
  sshCalls.forEach(({ argv, sshAuthSock }) => {
    expect(argv.slice(0, 4))
      .toEqual(['-o', `UserKnownHostsFile=${world.knownHosts}`, '-o', 'StrictHostKeyChecking=yes']);
    expect(sshAuthSock).toEqual(containerSshSock());
  });
}

/**
 * Shared example for a docker-ready command whose shim declares a
 * `--needs` list holding `remote` (docker batch 4, issue #748). Every
 * case runs in a fresh git fixture repo and a `createRemoteNeedsWorld`
 * (temp `HOME`, `.gitconfig` with `protocol.https.allow=never`,
 * `.claude/arcanum-config.json`, fake `ssh` first on `PATH`,
 * `GH_TOKEN` seeded), so no case ever reaches a real remote. Registers
 * a `describe(description, ...)` holding:
 *
 * - `itRoutesEngineDispatch` with an ssh `origin`, in all three modes;
 *   the `docker` case also asserts `expectRemoteNeedsRun` (agent socket
 *   and `known_hosts` `:ro` mounts, `SSH_AUTH_SOCK` /
 *   `GIT_SSH_COMMAND`) and, with `reachesRemote`, that every fake
 *   `ssh` call came through the forwarded `GIT_SSH_COMMAND` and socket;
 * - a docker-only case with an https `origin`, asserting the gh
 *   credential helper's `GIT_CONFIG_*` pairs and `GH_TOKEN` and that
 *   no `ssh` ran.
 * @param {string} description - the `describe` block's label.
 * @param {string} shimScript - the real `engine_dispatch` shim's path.
 * @param {object} spec - the command.
 * @param {string} spec.command - the dispatched command name.
 * @param {string[]} spec.needs - the shim's `--needs` tags.
 * @param {(repo: {repoPath: string}, mode: string, world: object) => Promise<{args: string[], env?: object, input?: string, cwd?: string, cleanup?: () => Promise<void>}>} spec.prepare
 *   - per-case fixture setup (`origin` and `engine.mode` are already
 *   seeded); its `env` is layered over the world's (prefix
 *   `world.env.PATH` to add fakes).
 * @param {(args: string[]) => string[]} [spec.dockerArgs] - the argv
 *   the docker run passes after `<command>`, from the shim args
 *   (default: the shim args unchanged).
 * @param {boolean} [spec.reachesRemote] - whether the ssh case's
 *   command talks to `origin` (so the fake `ssh` must have been run).
 * @param {(result: object, ctx: {repoPath: string, world: object, args: string[]}) => Promise<void>|void} spec.shell
 *   - the ssh shell case's assertion, handed the case's repo, world and
 *   shim args.
 * @param {(result: object, ctx: object) => Promise<void>|void} spec.native - the ssh native case's.
 * @param {(result: object, ctx: object) => Promise<void>|void} spec.docker - the ssh docker case's
 *   result assertion (the run shape is asserted by this example).
 * @param {(result: object, ctx: object) => Promise<void>|void} spec.https - the https docker case's.
 * @returns {void}
 */
export function itRoutesRemoteEngineDispatch(description, shimScript, {
  command, needs, prepare, dockerArgs = (args) => args, reachesRemote = false, shell, native, docker, https
}) {
  describe(description, () => {
    let current;

    itRoutesEngineDispatch(
      'with an ssh origin',
      shimScript,
      async (repo, mode) => {
        current = { repoPath: repo.repoPath, ...(await prepareInWorld(repo, mode, SSH_ORIGIN, prepare)) };

        return current;
      },
      {
        shell: (result) => shell(result, current),
        native: (result) => native(result, current),
        docker: async (result, calls) => {
          await docker(result, current);
          expectRemoteNeedsRun(
            calls, current.repoPath, [command, ...dockerArgs(current.args)], current.world, { needs, origin: 'ssh' }
          );
          if (reachesRemote) await expectContainerSshCalls(current.world);
        }
      }
    );

    it('wires the gh credential helper for an https origin when engine.mode=docker', async () => {
      const repo = await createGitFixtureRepo();
      const fakeDocker = await createFakeDockerBin({ mode: 'passthrough' });

      try {
        const prepared = await prepareInWorld(repo, 'docker', HTTPS_ORIGIN, prepare);

        try {
          const result = await runCommand(
            [shimScript, ...prepared.args],
            prepared.cwd ?? repo.repoPath,
            { ...prepared.env, PATH: `${fakeDocker.binDir}${path.delimiter}${prepared.env.PATH}` },
            prepared.input
          );

          await https(result, { ...prepared, repoPath: repo.repoPath });
          expectRemoteNeedsRun(
            await fakeDocker.readCalls(), repo.repoPath, [command, ...dockerArgs(prepared.args)], prepared.world,
            { needs, origin: 'https' }
          );
          expect(await prepared.world.fakeSsh.readCalls()).withContext('fake ssh calls').toEqual([]);
        } finally {
          await prepared.cleanup();
        }
      } finally {
        await Promise.all([fakeDocker.cleanup(), repo.cleanup()]);
      }
    });
  });
}

/** The push every commit-then-push command runs on the fixture's `main`. */
const PUSH_MAIN = 'git push -u origin main:main';

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {Promise<string>} its HEAD commit's subject.
 */
async function headSubject(repoPath) {
  return (await runCommand(['git', '-C', repoPath, 'log', '-1', '--format=%s'], repoPath)).stdout;
}

/**
 * The `shell`/`native`/`docker`/`https` callbacks for a command that
 * commits on the fixture's `main` and then pushes it (commit-change,
 * commit-issue, commit-plan, cleanup-artifacts): every mode makes the
 * commit — with the world's `.gitconfig` identity, which docker gets
 * through the `gitconfig` need — then fails the push offline. The
 * shell side echoes `git commit` and exits with git's 128; native and
 * docker print only core/bin/arcanum's failure and exit 1.
 * @param {string} subject - the commit subject every mode must leave.
 * @returns {object} the callbacks, for `itRoutesRemoteEngineDispatch`.
 */
export function commitThenPushAssertions(subject) {
  /**
   * @param {string} stderr - the push's own stderr.
   * @returns {(result: object, ctx: {repoPath: string}) => Promise<void>} the native-side assertion.
   */
  const nativeSide = (stderr) => async (result, { repoPath }) => {
    expect(result).toEqual({ stdout: '', stderr: nativeCommandFailed(PUSH_MAIN, stderr), code: 1 });
    expect(await headSubject(repoPath)).toEqual(`${subject}\n`);
  };

  return {
    shell: async (result, { repoPath }) => {
      expect(result.code).toEqual(128);
      expect(result.stderr).toEqual(SSH_REMOTE_FAILURE);
      expect(result.stdout).toContain(`] ${subject}\n`);
      expect(await headSubject(repoPath)).toEqual(`${subject}\n`);
    },
    native: nativeSide(SSH_REMOTE_FAILURE),
    docker: nativeSide(SSH_REMOTE_FAILURE),
    https: nativeSide(HTTPS_NOT_ALLOWED)
  };
}

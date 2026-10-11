import { createGhNeedsWorld } from '../factories/engineDispatchDockerSetup.js';
import { itRoutesEngineDispatch } from './engineDispatchRouting.js';

/**
 * Shared example for a docker-ready `--needs=global-config,gitconfig,gh`
 * command (docker batch 3, issue #747): `itRoutesEngineDispatch` with
 * all three modes, where the `docker` case additionally runs in a
 * `createGhNeedsWorld` — a global `arcanum-config.json` under
 * `CLAUDE_CONFIG_DIR`, a temp gitconfig as `GIT_CONFIG_GLOBAL` and
 * `GH_TOKEN` seeded with `SPEC_GH_TOKEN` — layered over the env
 * `prepare` returned, so both `:ro` mounts and the `-e GH_TOKEN` name
 * show up in the `docker run` (assert them with `expectGhNeedsRun`).
 *
 * The passthrough fake `docker` runs `core/bin/arcanum` on the host
 * with the host `PATH`, so a fake `gh` first on `prepare`'s `PATH`
 * (e.g. one whose `auth token` always fails) answers the "container"
 * side exactly as it answers the native side.
 * @param {string} description - the `describe` block's label.
 * @param {string} shimScript - the real `engine_dispatch` shim's path.
 * @param {(repo: {repoPath: string}, mode: string) => Promise<object>} prepare -
 *   see `itRoutesEngineDispatch` (called with mode `docker` for the
 *   docker case).
 * @param {object} assertions - per-mode assertion callbacks.
 * @param {(result: object) => void} assertions.shell - the shell case's.
 * @param {(result: object) => void} assertions.native - the native case's.
 * @param {(result: object, calls: object[], world: object) => void} assertions.docker -
 *   the docker case's, also handed the gh-needs world it ran in.
 * @returns {void}
 */
export function itRoutesGhEngineDispatch(description, shimScript, prepare, { shell, native, docker }) {
  let world;

  itRoutesEngineDispatch(
    description,
    shimScript,
    async (repo, mode) => {
      const prepared = await prepare(repo, mode);

      if (mode !== 'docker') return prepared;

      world = await createGhNeedsWorld();

      return {
        ...prepared,
        env: { ...(prepared.env ?? process.env), ...world.env },
        cleanup: async () => {
          await world.cleanup();
          if (prepared.cleanup) await prepared.cleanup();
        }
      };
    },
    { shell, native, docker: (result, calls) => docker(result, calls, world) }
  );
}

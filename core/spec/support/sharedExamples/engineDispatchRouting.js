import path from 'node:path';
import { mergeEngineMode } from '../utils/engineMode.js';
import { createFakeDockerBin } from '../utils/fakeDockerBin.js';
import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { runCommand } from '../utils/runCommand.js';

/**
 * Runs `run` with a passthrough fake `docker` first on `env`'s `PATH`
 * and `engine.mode=docker` seeded in `repo`, then hands the result and
 * the fake's logged calls to `assert`.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {object} env - the env `prepare` returned (or `process.env`).
 * @param {(env: object) => Promise<object>} run - runs the shim with an env.
 * @param {(result: object, calls: object[]) => void} assert - the caller's
 *   `docker` callback.
 * @returns {Promise<void>} resolves once asserted.
 */
async function runWithFakeDocker(repo, env, run, assert) {
  const fakeDocker = await createFakeDockerBin({ mode: 'passthrough' });

  try {
    await mergeEngineMode(repo, 'docker');
    const result = await run({ ...env, PATH: `${fakeDocker.binDir}${path.delimiter}${env.PATH}` });

    await assert(result, await fakeDocker.readCalls());
  } finally {
    await fakeDocker.cleanup();
  }
}

/**
 * Shared example: a real per-entrypoint `engine_dispatch` shim routes
 * to the shell implementation when `engine.mode=shell` and to the
 * native implementation when `engine.mode=native`. Registers a
 * `describe(description, ...)` block with one `it` per mode, each
 * building a fresh git fixture repo, letting the caller prepare
 * whatever per-case fixture state a given subcommand needs (including
 * seeding `engine.mode` itself, via either `seedEngineMode` or
 * `seedLocalState`), running the shim, and handing the result to the
 * caller's own assertion callback for that mode.
 * @param {string} description - the `describe` block's label.
 * @param {string} shimScript - the real `engine_dispatch` shim script's
 *   path (e.g. `auto-fix-all/scripts/wait_ci.sh`).
 * @param {(repo: {repoPath: string}, mode: string) => Promise<{args: string[], env?: object, input?: string, cwd?: string, cleanup?: () => Promise<void>}>} prepare
 *   - per-case fixture setup, including seeding `engine.mode` for
 *   `mode`. Returns the arguments to append after `shimScript` when
 *   invoking `runCommand`, an optional environment to run it with, an
 *   optional stdin `input` (see `runCommand`), an optional `cwd`
 *   (defaults to the fixture repo), and an optional `cleanup` (e.g. a
 *   `fakeGh.cleanup()`) run alongside the fixture repo's own teardown.
 * @param {object} assertions - per-mode assertion callbacks.
 * @param {(result: {stdout: string, stderr: string, code: number}) => void} assertions.shell
 *   - asserts on the result when `engine.mode=shell`.
 * @param {(result: {stdout: string, stderr: string, code: number}) => void} assertions.native
 *   - asserts on the result when `engine.mode=native`.
 * @param {(result: {stdout: string, stderr: string, code: number}, calls: object[]) => void} [assertions.docker]
 *   - optional; when given, adds a third case: `prepare` runs with
 *   mode `docker`, then `engine.mode=docker` is seeded and a passthrough
 *   fake `docker` (see `fakeDockerBin.js`) is put first on `PATH`; the
 *   callback gets the result and the fake's logged `{ argv, env }` calls
 *   (to check the `docker run` mounts/env the command's `--needs` /
 *   `--path-arg` declarations produce). For commands whose
 *   migration-status.json status is `"docker"`.
 * @returns {void}
 */
export function itRoutesEngineDispatch(description, shimScript, prepare, { shell, native, docker }) {
  const modes = [
    { mode: 'shell', label: 'routes to the shell implementation when engine.mode=shell', assert: shell },
    { mode: 'native', label: 'routes to the native implementation when engine.mode=native', assert: native }
  ];

  if (docker) {
    modes.push({ mode: 'docker', label: 'routes to docker run when engine.mode=docker', assert: docker });
  }

  describe(description, () => {
    modes.forEach(({ mode, label, assert }) => {
      it(label, async () => {
        const repo = await createGitFixtureRepo();

        try {
          const { args, env, input, cwd = repo.repoPath, cleanup } = await prepare(repo, mode);

          try {
            const run = (runEnv) => runCommand([shimScript, ...args], cwd, runEnv, input);

            if (mode === 'docker') {
              await runWithFakeDocker(repo, env ?? process.env, run, assert);
            } else {
              await assert(await run(env));
            }
          } finally {
            if (cleanup) {
              await cleanup();
            }
          }
        } finally {
          await repo.cleanup();
        }
      });
    });
  });
}

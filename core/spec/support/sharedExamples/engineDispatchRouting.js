import { createGitFixtureRepo } from '../utils/gitFixtureRepo.js';
import { runCommand } from '../utils/runCommand.js';

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
 * @param {(repo: {repoPath: string}, mode: string) => Promise<{args: string[], env?: object, cleanup?: () => Promise<void>}>} prepare
 *   - per-case fixture setup, including seeding `engine.mode` for
 *   `mode`. Returns the arguments to append after `shimScript` when
 *   invoking `runCommand`, an optional environment to run it with, and
 *   an optional `cleanup` (e.g. a `fakeGh.cleanup()`) run alongside the
 *   fixture repo's own teardown.
 * @param {object} assertions - per-mode assertion callbacks.
 * @param {(result: {stdout: string, stderr: string, code: number}) => void} assertions.shell
 *   - asserts on the result when `engine.mode=shell`.
 * @param {(result: {stdout: string, stderr: string, code: number}) => void} assertions.native
 *   - asserts on the result when `engine.mode=native`.
 * @returns {void}
 */
export function itRoutesEngineDispatch(description, shimScript, prepare, { shell, native }) {
  const modes = [
    { mode: 'shell', label: 'routes to the shell implementation when engine.mode=shell', assert: shell },
    { mode: 'native', label: 'routes to the native implementation when engine.mode=native', assert: native }
  ];

  describe(description, () => {
    modes.forEach(({ mode, label, assert }) => {
      it(label, async () => {
        const repo = await createGitFixtureRepo();

        try {
          const { args, env, cleanup } = await prepare(repo, mode);

          try {
            const result = await runCommand([shimScript, ...args], repo.repoPath, env);

            await assert(result);
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

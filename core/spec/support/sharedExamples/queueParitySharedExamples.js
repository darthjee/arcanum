import { runPair, seedQueue, setupParityTest, setupTempDirPair } from '../factories/queueParitySetup.js';
import { expectParity } from '../utils/runCommand.js';

/**
 * Marker for `expectedCode`: asserts the shell side's exit code is
 * anything other than `0` (rather than one exact value).
 */
export const NON_ZERO = Symbol('NON_ZERO');

/**
 * Builds the fixtures for one queue parity case, normalized to
 * `{ shellRepoPath, nativeRepoPath, env, cleanup }` whichever setup is
 * used.
 * @param {boolean} github - whether to build the git + fake `gh`
 *   fixtures (setupParityTest) rather than two plain temp dirs.
 * @param {object} env - the case's extra env vars.
 * @returns {Promise<{shellRepoPath: string, nativeRepoPath: string, env: object, cleanup: Function}>}
 *   the normalized fixtures.
 */
async function buildFixtures(github, env) {
  if (!github) {
    return { ...(await setupTempDirPair()), env };
  }

  const ctx = await setupParityTest();

  return {
    shellRepoPath: ctx.shellRepo.repoPath,
    nativeRepoPath: ctx.nativeRepo.repoPath,
    env: { PATH: `${ctx.fakeGh.binDir}:${process.env.PATH}`, ...env },
    cleanup: ctx.cleanup
  };
}

/**
 * Shared example: an `auto-fix-all-queue-*` shell entrypoint and its
 * `core/bin/arcanum` native counterpart produce byte-identical stdout
 * and exit code against identically-seeded fixture state. Registers a
 * single `it(description, ...)` that builds the fixtures (two plain
 * temp dirs, or — when `github` — two git fixture repos with a
 * github.com-shaped `origin` plus a fake `gh` on `PATH`), seeds both
 * sides' queue, runs both sides via `runPair`, asserts parity plus the
 * expected exit code/stdout, optionally runs and asserts a follow-up
 * subcommand on the same fixtures, and tears everything down.
 * @param {string} description - the `it` block's label.
 * @param {object} options - the case definition.
 * @param {string} options.op - the subcommand under test (a key of
 *   `SHELL_SCRIPTS`, e.g. `'push'`).
 * @param {string[]} [options.seed] - the queue's ids seeded on both
 *   sides; when omitted, no queue file is written at all.
 * @param {string[]} [options.args] - the args after `<repo_path>`.
 * @param {boolean} [options.github] - whether to use the git + fake `gh`
 *   fixtures (`save`/`push`) instead of plain temp dirs.
 * @param {object} [options.env] - extra env vars (e.g. `FAKE_GH_*` /
 *   `FAKE_FETCH_*`); when `github`, `PATH` with the fake `gh`'s bin dir
 *   is prepended automatically.
 * @param {boolean} [options.fakeFetch] - whether to preload the
 *   fake-fetch module on the native side (see runPair).
 * @param {number|symbol} options.expectedCode - the shell side's
 *   expected exit code, or `NON_ZERO` to only assert it isn't `0`.
 * @param {string} options.expectedStdout - the shell side's expected
 *   stdout.
 * @param {{op: string, args?: string[], expectedStdout: string}} [options.followUp]
 *   - an optional second subcommand run on the same fixtures afterwards;
 *   its shell stdout must equal `expectedStdout` and its native stdout
 *   must equal its shell stdout.
 * @returns {void}
 */
export function itMatchesShellForQueueOp(description, {
  op,
  seed,
  args = [],
  github = false,
  env = {},
  fakeFetch = false,
  expectedCode,
  expectedStdout,
  followUp
}) {
  it(description, async () => {
    const fixtures = await buildFixtures(github, env);
    const { shellRepoPath, nativeRepoPath } = fixtures;

    try {
      if (seed) {
        await Promise.all([seedQueue(shellRepoPath, seed), seedQueue(nativeRepoPath, seed)]);
      }

      const { shell, native } = await runPair(op, shellRepoPath, nativeRepoPath, args, {
        env: fixtures.env,
        fakeFetch
      });

      expectParity(shell, native);
      if (expectedCode === NON_ZERO) {
        expect(shell.code).not.toEqual(0);
      } else {
        expect(shell.code).toEqual(expectedCode);
      }
      expect(shell.stdout).toEqual(expectedStdout);

      if (followUp) {
        const next = await runPair(followUp.op, shellRepoPath, nativeRepoPath, followUp.args || []);

        expect(next.shell.stdout).toEqual(followUp.expectedStdout);
        expect(next.native.stdout).toEqual(next.shell.stdout);
      }
    } finally {
      await fixtures.cleanup();
    }
  });
}

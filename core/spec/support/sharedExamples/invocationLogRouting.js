import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectRepoMountOnlyRun } from '../factories/engineDispatchDockerSetup.js';
import { createTempDir, removeTempDir } from '../utils/tempDir.js';
import { itRoutesEngineDispatch } from './engineDispatchRouting.js';

/**
 * @param {string} logFile - the invocation log's path.
 * @returns {Promise<string>} its content, or `''` when absent.
 */
async function logContent(logFile) {
  return existsSync(logFile) ? readFile(logFile, 'utf8') : '';
}

/**
 * Shared example for a docker-ready command whose shell and native
 * implementations are byte-identical: built on `itRoutesEngineDispatch`
 * with all three modes (`shell`, `native`, `docker`), it proves the
 * routing through core/bin/arcanum's invocation log, which only the
 * native side ever writes (`command <name> invoked at ...`).
 *
 * Every case runs in the fixture repo's real path (so `$PWD` and
 * `git rev-parse --show-toplevel` match the paths the case passes) with
 * `engine.log.location` seeded to a directory inside the repo (so the
 * docker run gains no log mount) and `CLAUDE_CONFIG_DIR` pointed at an
 * empty directory (so no global config leaks in). Each mode then checks the same
 * `check` expectations — so docker's stdout/exit code equal native's —
 * plus: shell leaves the log empty; native and docker log the command;
 * docker reaches exactly one `docker run` with only the repo mount, no
 * extra env, and `<command> <dockerArgs...>` after the image.
 * @param {string} description - the `describe` block's label.
 * @param {string} shimScript - the real `engine_dispatch` shim's path.
 * @param {object} spec - the case.
 * @param {string} spec.command - the dispatched command name.
 * @param {(ctx: {repoPath: string, mode: string}) => Promise<{args: string[], cwd?: string, input?: string, env?: object, cleanup?: () => Promise<void>}>} spec.prepare
 *   - seeds per-case fixtures under `ctx.repoPath`; returns the shim's
 *   arguments (and optional `cwd`, defaulting to `ctx.repoPath`).
 * @param {(result: object, ctx: {repoPath: string, mode: string}) => Promise<void>|void} spec.check
 *   - the expectations every mode must meet.
 * @param {(ctx: {repoPath: string}) => string[]} spec.dockerArgs - the
 *   argv the docker run passes after `<command>`.
 * @returns {void}
 */
export function itRoutesWithInvocationLog(description, shimScript, { command, prepare, check, dockerArgs }) {
  let ctx;

  /**
   * @param {string} mode - the mode the case runs in.
   * @returns {(result: object, calls?: object[]) => Promise<void>} its assertion.
   */
  const assertFor = (mode) => async (result, calls) => {
    await check(result, ctx);

    const log = await logContent(ctx.logFile);

    if (mode === 'shell') {
      expect(log).toEqual('');
    } else {
      expect(log).toContain(`command ${command} invoked at `);
    }

    if (mode === 'docker') {
      expectRepoMountOnlyRun(calls, ctx.repoPath, [command, ...dockerArgs(ctx)]);
    }
  };

  itRoutesEngineDispatch(
    description,
    shimScript,
    async (repo, mode) => {
      const repoPath = await realpath(repo.repoPath);
      const logDir = path.join(repoPath, '.claude', 'state', 'log');

      await mkdir(logDir, { recursive: true });
      await writeFile(
        path.join(repoPath, '.claude', 'state', 'arcanum-config.json'),
        JSON.stringify({ engine: { mode, log: { location: logDir } } })
      );

      ctx = { repoPath, mode, logFile: path.join(logDir, `arcanum-${path.basename(repoPath)}-log.txt`) };

      // An empty CLAUDE_CONFIG_DIR keeps this machine's global config out.
      const configDir = await createTempDir('arcanum-core-routing-global-');
      const prepared = await prepare(ctx);

      return {
        cwd: repoPath,
        ...prepared,
        env: { ...process.env, ...prepared.env, CLAUDE_CONFIG_DIR: configDir },
        cleanup: async () => {
          await removeTempDir(configDir);
          if (prepared.cleanup) await prepared.cleanup();
        }
      };
    },
    { shell: assertFor('shell'), native: assertFor('native'), docker: assertFor('docker') }
  );
}

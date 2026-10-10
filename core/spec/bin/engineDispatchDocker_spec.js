import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runEngineDispatchFn, writeStatusMap } from '../support/utils/engineDispatchLib.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { REPO_ROOT, git } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const SHELL_TWIN = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'config_get_shell.sh');
const CONFIG_GET = 'auto-fix-all-config-get';
const CRASH = 'dispatch-fixture-crash';
const STATUSES = ['shell', 'native', 'docker', 'host-only'];

/**
 * @param {string} command - the dispatched command.
 * @returns {string} the exact stderr warning for a `shell`-status fallback.
 */
function fallbackWarning(command) {
  return `Warning: no native implementation of '${command}' yet (arcanum/_lib/migration-status.json) — ` +
    'falling back to the shell implementation.\n';
}

// Dispatch-level specs for arcanum/_lib/engine_dispatch.sh (see
// docs/agents/specs/docker/testing.md). Each case sources the lib in a
// `bash -c` wrapper and points the sourced
// _ENGINE_DISPATCH_MIGRATION_STATUS_FILE at a per-test fixture map.
// The docker cases (resolution table, argv, path arguments, exit codes,
// image acquisition, nested guard) are added by the later #729
// sub-issues.
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

        expect(result).toEqual({ stdout: 'true\n', stderr: fallbackWarning(CRASH), code: 0 });
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

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { itRoutesEngineDispatch } from '../support/sharedExamples/engineDispatchRouting.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Routing test for the real init-claude label-command engine_dispatch
// shims (issue #594): write_label_config.sh (replace/remove/add) and
// sync_labels.sh, under engine.mode=shell and engine.mode=native.
//
// Both implementations are byte-identical by design, so the routing is
// proven through core/bin/arcanum's invocation log: every case seeds
// `engine.log.location`, which only the native side ever writes to
// (`command <name> invoked at ...`). Each case also passes a relative
// <config_path>, asserting it lands under the shim's own cwd in both
// modes. sync_labels.sh is answered "n", so neither side reaches GitHub.

const SCRIPTS_DIR = path.join(REPO_ROOT, 'init-claude', 'scripts');
const WRITE_SHIM = path.join(SCRIPTS_DIR, 'write_label_config.sh');
const SYNC_SHIM = path.join(SCRIPTS_DIR, 'sync_labels.sh');

/**
 * Seed `engine.mode` plus an `engine.log.location` temp dir in the
 * repo's local-state config.
 * @param {{repoPath: string}} repo - the fixture repo.
 * @param {string} mode - `"shell"` or `"native"`.
 * @returns {Promise<{logFile: string, cleanup: () => Promise<void>}>} the
 *   invocation log's path and a cleanup for its dir.
 */
async function seedModeAndLog(repo, mode) {
  const logDir = await createTempDir('arcanum-core-labels-log-');
  const stateDir = path.join(repo.repoPath, '.claude', 'state');

  await mkdir(stateDir, { recursive: true });
  await writeFile(
    path.join(stateDir, 'arcanum-config.json'),
    JSON.stringify({ engine: { mode, log: { location: logDir } } })
  );

  return {
    logFile: path.join(logDir, `arcanum-${path.basename(repo.repoPath)}-log.txt`),
    cleanup: () => removeTempDir(logDir)
  };
}

/**
 * @param {string} logFile - the invocation log's path.
 * @returns {Promise<string>} its content, or `''` when absent.
 */
async function logContent(logFile) {
  return existsSync(logFile) ? readFile(logFile, 'utf8') : '';
}

describe('init-claude label commands engine_dispatch routing (via the real shims)', () => {
  const WRITE_CASES = [
    { sub: 'replace', items: ['A:111111', 'B:222222'], expected: ['A:111111', 'B:222222'] },
    { sub: 'remove', items: ['Old'], expected: ['Keep:333333'] },
    { sub: 'add', items: ['New:444444'], expected: ['Old:000000', 'Keep:333333', 'New:444444'] }
  ];

  WRITE_CASES.forEach(({ sub, items, expected }) => {
    let ctx;

    /**
     * @param {string} mode - the engine mode that should have run.
     * @returns {Promise<void>} resolves once asserted.
     */
    const assertFor = (mode) => async (result) => {
      expect(result.code).withContext(result.stderr).toEqual(0);
      expect(result.stdout).toEqual('');

      const { labels } = JSON.parse(await readFile(path.join(ctx.repoPath, 'nested', 'labels.json'), 'utf8'));

      expect(labels.map(({ name, color }) => `${name}:${color}`)).toEqual(expected);

      const log = await logContent(ctx.logFile);

      if (mode === 'native') {
        expect(log).toContain(`command init-claude-write-label-config-${sub} invoked at `);
      } else {
        expect(log).toEqual('');
      }
    };

    itRoutesEngineDispatch(
      `write_label_config.sh ${sub}`,
      WRITE_SHIM,
      async (repo, mode) => {
        const { logFile, cleanup } = await seedModeAndLog(repo, mode);

        ctx = { repoPath: repo.repoPath, logFile };
        await mkdir(path.join(repo.repoPath, 'nested'));
        await writeFile(
          path.join(repo.repoPath, 'nested', 'labels.json'),
          '{"labels":[{"name":"Old","color":"000000"},{"name":"Keep","color":"333333"}]}'
        );

        return { args: [sub, 'nested/labels.json', ...items], cleanup };
      },
      { shell: assertFor('shell'), native: assertFor('native') }
    );
  });

  describe('sync_labels.sh', () => {
    let ctx;

    /**
     * @param {string} mode - the engine mode that should have run.
     * @returns {Promise<void>} resolves once asserted.
     */
    const assertFor = (mode) => async (result) => {
      expect(result.code).withContext(result.stderr).toEqual(1);
      expect(result.stdout).toEqual(
        '| Label | Color |\n| --- | --- |\n| Bug | #b60205 |\nSync these labels to GitHub? [y/n]: STATUS=discuss\n'
      );

      const log = await logContent(ctx.logFile);

      if (mode === 'native') {
        expect(log).toContain('command init-claude-sync-labels invoked at ');
      } else {
        expect(log).toEqual('');
      }
    };

    itRoutesEngineDispatch(
      'sync_labels.sh (answered "n", relative config under a subdirectory cwd)',
      SYNC_SHIM,
      async (repo, mode) => {
        const { logFile, cleanup } = await seedModeAndLog(repo, mode);
        const cwd = path.join(repo.repoPath, 'sub');

        ctx = { logFile };
        await mkdir(cwd);
        await writeFile(path.join(cwd, 'labels.json'), '{"labels":[{"name":"Bug","color":"b60205"}]}');

        return { args: [repo.repoPath, 'labels.json'], cwd, input: 'n\n', cleanup };
      },
      { shell: assertFor('shell'), native: assertFor('native') }
    );
  });

  describe('shim-level usage errors (never dispatched)', () => {
    let repo;
    let log;

    beforeEach(async () => {
      repo = await createGitFixtureRepo();
      log = await seedModeAndLog(repo, 'native');
    });

    afterEach(async () => {
      await log.cleanup();
      await repo.cleanup();
    });

    const USAGE = [
      `Usage: ${WRITE_SHIM} replace <config_path> <Label1>:<color1> [<Label2>:<color2> ...]`,
      `       ${WRITE_SHIM} remove  <config_path> <Label1> [<Label2> ...]`,
      `       ${WRITE_SHIM} add     <config_path> <Label1>:<color1> [<Label2>:<color2> ...]`,
      '  Each pair is <label name>:<hex color>, color without a leading \'#\' (e.g. Bug:b60205).',
      ''
    ].join('\n');

    [[], ['bogus', 'c.json', 'A:000000'], ['add'], ['add', ''], ['remove', 'c.json']].forEach((args) => {
      it(`prints the usage block and exits 2 for write_label_config.sh ${JSON.stringify(args)}`, async () => {
        const result = await runCommand([WRITE_SHIM, ...args], repo.repoPath);

        expect(result.code).toEqual(2);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toEqual(USAGE);
        expect(await logContent(log.logFile)).toEqual('');
      });
    });

    it('fails with the :? usage message for sync_labels.sh without <repo_path>', async () => {
      const result = await runCommand([SYNC_SHIM], repo.repoPath);

      expect(result.code).toEqual(1);
      expect(result.stdout).toEqual('');
      expect(result.stderr).toContain(`Usage: ${SYNC_SHIM} <repo_path> [<config_path>]`);
      expect(await logContent(log.logFile)).toEqual('');
    });
  });
});

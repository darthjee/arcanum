import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectGhNeedsRun } from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { itRoutesEngineDispatch } from '../support/sharedExamples/engineDispatchRouting.js';
import { itRoutesGhEngineDispatch } from '../support/sharedExamples/ghEngineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { REPO_ROOT, runCommand } from '../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

// Routing test for the real init-claude label-command engine_dispatch
// shims (issue #594): write_label_config.sh (replace/remove/add) and
// sync_labels.sh, under engine.mode=shell and engine.mode=native — and,
// for write_label_config.sh (issue #746, docker batch 2), under
// engine.mode=docker too (a passthrough fake `docker`).
//
// Both implementations are byte-identical by design, so the routing is
// proven through core/bin/arcanum's invocation log: every case seeds
// `engine.log.location`, which only the native side ever writes to
// (`command <name> invoked at ...`). write_label_config.sh passes its
// <config_path> made absolute against its cwd with
// `--path-arg=1:rw-mkdir` (issue #753): a relative path inside the repo
// needs no mount, an absolute one outside it gets its directory mounted
// read-write — created on the host first when missing, matching the
// shell and native sides' own `mkdir -p`. sync_labels.sh is
// answered "n", so neither side reaches GitHub.
//
// sync_labels.sh under engine.mode=docker (issue #747, docker batch 3)
// is answered "y" instead, with a fake `gh` whose `auth token` always
// fails: the shell side syncs against the fake `gh`, while native and
// the passthrough fake `docker` (core/bin/arcanum on the host, same
// `PATH`) print the table and prompt, read the "y" from stdin — proving
// stdin reaches the container — and fail at token resolution. The
// docker run carries the `--needs=global-config,gitconfig,gh` mounts and
// env, plus a read-only mount of <config_path> (`--path-arg=2:ro`) only
// when it sits outside the repo.

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
 * Writes the starting `labels.json` (`Old`, `Keep`) under `dir`.
 * @param {string} dir - the directory (created if missing).
 * @returns {Promise<void>} resolves once written.
 */
async function seedLabels(dir) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'labels.json'),
    '{"labels":[{"name":"Old","color":"000000"},{"name":"Keep","color":"333333"}]}'
  );
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
    const command = `init-claude-write-label-config-${sub}`;

    /**
     * @param {string} file - the label config's path.
     * @returns {(result: object) => Promise<void>} the expectations every mode must meet.
     */
    const expectLabels = (file) => async (result) => {
      expect(result).toEqual({ stdout: '', stderr: '', code: 0 });

      const { labels } = JSON.parse(await readFile(file, 'utf8'));

      expect(labels.map(({ name, color }) => `${name}:${color}`)).toEqual(expected);
    };

    itRoutesWithInvocationLog(`write_label_config.sh ${sub} (relative config inside the repo)`, WRITE_SHIM, {
      command,
      prepare: async ({ repoPath }) => {
        await seedLabels(path.join(repoPath, 'nested'));

        return { args: [sub, 'nested/labels.json', ...items] };
      },
      check: (result, { repoPath }) => expectLabels(path.join(repoPath, 'nested', 'labels.json'))(result),
      dockerArgs: ({ repoPath }) => [repoPath, path.join(repoPath, 'nested', 'labels.json'), ...items]
    });

    let configDir;

    itRoutesWithInvocationLog(`write_label_config.sh ${sub} (absolute config outside the repo)`, WRITE_SHIM, {
      command,
      prepare: async () => {
        configDir = await realpath(await createTempDir('arcanum-core-labels-config-'));
        await seedLabels(configDir);

        return {
          args: [sub, path.join(configDir, 'labels.json'), ...items],
          cleanup: () => removeTempDir(configDir)
        };
      },
      check: (result) => expectLabels(path.join(configDir, 'labels.json'))(result),
      dockerArgs: ({ repoPath }) => [repoPath, path.join(configDir, 'labels.json'), ...items],
      dockerMounts: () => [`${configDir}:${configDir}`]
    });
  });

  [
    { sub: 'replace', items: ['A:111111'], expected: ['A:111111'] },
    { sub: 'add', items: ['New:444444'], expected: ['New:444444'] }
  ].forEach(({ sub, items, expected }) => {
    let configDir;
    let configFile;

    itRoutesWithInvocationLog(`write_label_config.sh ${sub} (config outside the repo, missing parent)`, WRITE_SHIM, {
      command: `init-claude-write-label-config-${sub}`,
      prepare: async () => {
        configDir = await realpath(await createTempDir('arcanum-core-labels-missing-'));
        configFile = path.join(configDir, 'new-dir', 'labels.json');

        return { args: [sub, configFile, ...items], cleanup: () => removeTempDir(configDir) };
      },
      check: async (result) => {
        expect(result).toEqual({ stdout: '', stderr: '', code: 0 });

        const { labels } = JSON.parse(await readFile(configFile, 'utf8'));

        expect(labels.map(({ name, color }) => `${name}:${color}`)).toEqual(expected);
      },
      dockerArgs: ({ repoPath }) => [repoPath, configFile, ...items],
      dockerMounts: () => [`${path.dirname(configFile)}:${path.dirname(configFile)}`]
    });
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

  describe('sync_labels.sh (answered "y", gh needs)', () => {
    const TABLE = '| Label | Color |\n| --- | --- |\n| Bug | #b60205 |\nSync these labels to GitHub? [y/n]: ';
    const NATIVE_RESULT = {
      stdout: TABLE,
      stderr: 'arcanum: Error: could not obtain GitHub token via gh auth token\n',
      code: 1
    };
    let repoPath;
    let configFile;

    [
      { label: 'inside the repo', outside: false, mounts: () => [] },
      { label: 'outside the repo', outside: true, mounts: () => [`${configFile}:${configFile}:ro`] }
    ].forEach(({ label, outside, mounts }) => {
      itRoutesGhEngineDispatch(
        `sync_labels.sh with an absolute config ${label}`,
        SYNC_SHIM,
        async (repo, mode) => {
          const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
          const configDir = outside ? await realpath(await createTempDir('arcanum-core-labels-sync-')) : repo.repoPath;

          repoPath = repo.repoPath;
          configFile = path.join(configDir, 'labels.json');
          await seedGithubLikeRepo(repo);
          await seedEngineMode(repo, mode);
          await writeFile(configFile, '{"labels":[{"name":"Bug","color":"b60205"}]}');

          return {
            args: [repo.repoPath, configFile],
            input: 'y\n',
            env: { ...process.env, PATH: `${fakeGh.binDir}${path.delimiter}${process.env.PATH}` },
            cleanup: async () => {
              await fakeGh.cleanup();
              if (outside) await removeTempDir(configDir);
            }
          };
        },
        {
          shell: (result) => {
            expect(result).toEqual({ stdout: `${TABLE}STATUS=synced\nCREATED=Bug\n`, stderr: '', code: 0 });
          },
          native: (result) => {
            expect(result).toEqual(NATIVE_RESULT);
          },
          docker: (result, calls, world) => {
            expect(result).toEqual(NATIVE_RESULT);
            expectGhNeedsRun(calls, repoPath, ['init-claude-sync-labels', repoPath, configFile], world, mounts());
          }
        }
      );
    });
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

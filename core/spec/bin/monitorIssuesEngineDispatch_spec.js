import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expectRepoMountOnlyRun } from '../support/factories/engineDispatchDockerSetup.js';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { runUntil, SCRIPTS_DIR } from '../support/factories/monitorIssuesParitySetup.js';
import { itRoutesEngineDispatch } from '../support/sharedExamples/engineDispatchRouting.js';
import { itRoutesWithInvocationLog } from '../support/sharedExamples/invocationLogRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {string} its monitor-issues repo config file.
 */
function monitorConfigFile(repoPath) {
  return path.join(repoPath, '.claude', 'configuration', 'monitor-issues.json');
}

/**
 * @param {string} repoPath - the fixture repo.
 * @returns {string} its rewrite queue file.
 */
function rewriteQueueFile(repoPath) {
  return path.join(repoPath, '.claude', 'state', 'monitor-issues-rewrite-queue.json');
}

// Routing test for the real monitor-issues engine_dispatch shims (issue
// #586): one command of each family (config.sh, rewrite_queue.sh,
// github.sh, monitor_issues.sh) under engine.mode=shell and
// engine.mode=native, via a scenario whose observable outcome differs
// between the two implementations — e.g. native usage errors carry
// core/bin/arcanum's `arcanum: ` stderr prefix, and a fake `gh` whose
// `auth token` always fails (baked in, so it survives the shim's `env
// -i`) fails the native side before any REST call while the shell side
// never asks for a token.
//
// Docker batch 1 (issue #745): the config.sh and rewrite_queue.sh
// usage-error cases also run under engine.mode=docker (a passthrough
// fake `docker`), and every config.sh/rewrite_queue.sh subcommand gets a
// success case proven through core/bin/arcanum's invocation log, whose
// docker run carries only the repo mount and no extra env.
describe('monitor-issues engine_dispatch routing (via the real shims)', () => {
  describe('usage errors', () => {
    let realRepoPath;

    /**
     * Seeds `engine.mode` and records the repo's real path (the shims
     * dispatch with `$PWD`). An empty `CLAUDE_CONFIG_DIR` keeps this
     * machine's global config (e.g. a docker log mount) out.
     * @param {{repoPath: string}} repo - the fixture repo.
     * @param {string} mode - the engine mode.
     * @param {string[]} args - the shim's arguments.
     * @returns {Promise<object>} the `prepare` result.
     */
    async function prepareUsageError(repo, mode, args) {
      const configDir = await createTempDir('arcanum-core-monitor-issues-global-');

      realRepoPath = await realpath(repo.repoPath);
      await seedEngineMode(repo, mode);

      return {
        args,
        env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
        cleanup: () => removeTempDir(configDir)
      };
    }

    itRoutesEngineDispatch(
      'config.sh get (missing key)',
      path.join(SCRIPTS_DIR, 'config.sh'),
      (repo, mode) => prepareUsageError(repo, mode, ['get']),
      {
        shell: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stderr).toEqual('Error: get requires a key\n');
        },
        native: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stderr).toContain('arcanum: Error: get requires a key');
        },
        docker: (result, calls) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Error: get requires a key');
          expectRepoMountOnlyRun(calls, realRepoPath, ['monitor-issues-config-get', realRepoPath]);
        }
      }
    );

    itRoutesEngineDispatch(
      'rewrite_queue.sh push (missing id)',
      path.join(SCRIPTS_DIR, 'rewrite_queue.sh'),
      (repo, mode) => prepareUsageError(repo, mode, ['push']),
      {
        shell: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stderr).toEqual('Error: push requires an ID\n');
        },
        native: (result) => {
          expect(result.code).toEqual(1);
          expect(result.stderr).toContain('arcanum: Error: push requires an ID');
        },
        docker: (result, calls) => {
          expect(result.code).toEqual(1);
          expect(result.stdout).toEqual('');
          expect(result.stderr).toContain('arcanum: Error: push requires an ID');
          expectRepoMountOnlyRun(calls, realRepoPath, ['monitor-issues-rewrite-queue-push', realRepoPath]);
        }
      }
    );
  });

  describe('config.sh (docker batch 1)', () => {
    const CONFIG_CASES = [
      { sub: 'get', args: ['enabled'], stdout: 'true\n', code: 0, after: true },
      { sub: 'is-enabled', args: ['enabled'], stdout: '', code: 0, after: true },
      { sub: 'set', args: ['enabled', 'false'], stdout: '', code: 0, after: false },
      { sub: 'toggle', args: ['enabled'], stdout: 'false\n', code: 0, after: false }
    ];

    CONFIG_CASES.forEach(({ sub, args, stdout, code, after }) => {
      itRoutesWithInvocationLog(sub, path.join(SCRIPTS_DIR, 'config.sh'), {
        command: `monitor-issues-config-${sub}`,
        prepare: async ({ repoPath }) => {
          await mkdir(path.dirname(monitorConfigFile(repoPath)), { recursive: true });
          await writeFile(monitorConfigFile(repoPath), JSON.stringify({ enabled: true }));

          return { args: [sub, ...args] };
        },
        check: async (result, { repoPath }) => {
          expect(result).toEqual({ stdout, stderr: '', code });
          expect(JSON.parse(await readFile(monitorConfigFile(repoPath), 'utf8')).enabled).toEqual(after);
        },
        dockerArgs: ({ repoPath }) => [repoPath, ...args]
      });
    });
  });

  describe('rewrite_queue.sh (docker batch 1)', () => {
    const QUEUE_CASES = [
      { sub: 'push', args: ['9'], stdout: 'Pushed: 9\n', ids: ['5', '9'] },
      { sub: 'pop', args: [], stdout: '5\n', ids: [] }
    ];

    QUEUE_CASES.forEach(({ sub, args, stdout, ids }) => {
      itRoutesWithInvocationLog(sub, path.join(SCRIPTS_DIR, 'rewrite_queue.sh'), {
        command: `monitor-issues-rewrite-queue-${sub}`,
        prepare: async ({ repoPath }) => {
          await writeFile(rewriteQueueFile(repoPath), JSON.stringify([{ id: '5' }]));

          return { args: [sub, ...args] };
        },
        check: async (result, { repoPath }) => {
          expect(result).toEqual({ stdout, stderr: '', code: 0 });
          expect(JSON.parse(await readFile(rewriteQueueFile(repoPath), 'utf8')).map(({ id }) => id)).toEqual(ids);
        },
        dockerArgs: ({ repoPath }) => [repoPath, ...args]
      });
    });
  });

  itRoutesEngineDispatch(
    'github.sh remove-tag',
    path.join(SCRIPTS_DIR, 'github.sh'),
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);

      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

      return { args: ['remove-tag', repo.repoPath, '5', 'created'], env, cleanup: fakeGh.cleanup };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(0);
        expect(result.stdout).toEqual('Tag \'created\' not present on issue #5 — nothing to do.\n');
      },
      native: (result) => {
        expect(result.code).not.toEqual(0);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('Error: could not fetch issue #5');
      }
    }
  );

  describe('monitor_issues.sh', () => {
    const SHIM = path.join(SCRIPTS_DIR, 'monitor_issues.sh');

    async function runMonitor(mode) {
      const repo = await createGitFixtureRepo();
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);

      try {
        await seedGithubLikeRepo(repo);
        await seedEngineMode(repo, mode);

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}`, FAKE_GH_ISSUE_LIST_FAIL: '1' };

        return await runUntil(['bash', SHIM, repo.repoPath], {
          cwd: repo.repoPath,
          env,
          isDone: (stdout) => stdout.includes('ERROR in poll cycle')
        });
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    }

    it('routes to the shell implementation when engine.mode=shell', async () => {
      const result = await runMonitor('shell');

      expect(result.timedOut).toBeFalse();
      expect(result.stdout).toContain('ERROR: gh issue list failed: fake gh: issue list failed');
    }, 60000);

    it('routes to the native implementation when engine.mode=native', async () => {
      const result = await runMonitor('native');

      expect(result.timedOut).toBeFalse();
      expect(result.stdout).toContain(
        'ERROR: gh issue list failed: Error: could not obtain GitHub token via gh auth token'
      );
    }, 60000);
  });
});

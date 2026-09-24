import path from 'node:path';
import { seedGithubLikeRepo } from '../support/factories/githubParitySetup.js';
import { runUntil, SCRIPTS_DIR } from '../support/factories/monitorIssuesParitySetup.js';
import { itRoutesEngineDispatch } from '../support/sharedExamples/engineDispatchRouting.js';
import { seedEngineMode } from '../support/utils/engineMode.js';
import { createFakeGhBin } from '../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../support/utils/gitFixtureRepo.js';

// Routing test for the real monitor-issues engine_dispatch shims (issue
// #586): one command of each family (config.sh, rewrite_queue.sh,
// github.sh, monitor_issues.sh) under engine.mode=shell and
// engine.mode=native, via a scenario whose observable outcome differs
// between the two implementations — e.g. native usage errors carry
// core/bin/arcanum's `arcanum: ` stderr prefix, and a fake `gh` whose
// `auth token` always fails (baked in, so it survives the shim's `env
// -i`) fails the native side before any REST call while the shell side
// never asks for a token.
describe('monitor-issues engine_dispatch routing (via the real shims)', () => {
  itRoutesEngineDispatch(
    'config.sh get (missing key)',
    path.join(SCRIPTS_DIR, 'config.sh'),
    async (repo, mode) => {
      await seedEngineMode(repo, mode);

      return { args: ['get'] };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stderr).toEqual('Error: get requires a key\n');
      },
      native: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stderr).toContain('arcanum: Error: get requires a key');
      }
    }
  );

  itRoutesEngineDispatch(
    'rewrite_queue.sh push (missing id)',
    path.join(SCRIPTS_DIR, 'rewrite_queue.sh'),
    async (repo, mode) => {
      await seedEngineMode(repo, mode);

      return { args: ['push'] };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stderr).toEqual('Error: push requires an ID\n');
      },
      native: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stderr).toContain('arcanum: Error: push requires an ID');
      }
    }
  );

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

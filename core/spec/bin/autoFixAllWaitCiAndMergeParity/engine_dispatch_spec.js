import {
  seedGithubLikeRepo,
  seedLocalState,
  SHIM_SCRIPT
} from '../../support/factories/autoFixAllWaitCiAndMergeParitySetup.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { runCommand } from '../../support/utils/runCommand.js';

const MODEL_EMAIL = 'model@example.com';

// Parity test for the "auto-fix-all-wait-ci-and-merge" migrated
// entrypoint (issue #266) — see
// docs/agents/architecture/script-engine.md's "output/exit-code
// contract" and
// docs/agents/plans/266-migrate-auto-fix-all-wait-ci-and-merge-entrypoint-to-native-node-js/node.md.
//
// See preconditions_spec.js/ci_outcomes_spec.js for the shell-vs-native
// output-parity scenarios (both bypass the engine_dispatch shim,
// running wait_ci_and_merge_shell.sh directly). This file instead
// exercises the real auto-fix-all/scripts/wait_ci_and_merge.sh
// engine_dispatch shim itself, for both engine.mode=shell and
// engine.mode=native, proving the shim really does select the intended
// implementation.
describe('auto-fix-all-wait-ci-and-merge parity (shell vs. native) — engine_dispatch routing', () => {
  describe('engine_dispatch routing (via the real wait_ci_and_merge.sh shim)', () => {
    it('routes to the shell implementation when engine.mode=shell', async () => {
      const fakeGh = await createFakeGhBin();
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedLocalState(repo, { engine: { mode: 'shell' } });

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath, MODEL_EMAIL], repo.repoPath, env);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('no pull request found for the current branch');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });

    it('routes to the native implementation when engine.mode=native', async () => {
      const fakeGh = await createFakeGhBin({ authTokenAlwaysFails: true });
      const repo = await createGitFixtureRepo();

      try {
        await seedGithubLikeRepo(repo);
        await seedLocalState(repo, { engine: { mode: 'native' } });

        const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };
        const result = await runCommand([SHIM_SCRIPT, repo.repoPath, MODEL_EMAIL], repo.repoPath, env);

        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('could not obtain GitHub token via gh auth token');
      } finally {
        await Promise.all([repo.cleanup(), fakeGh.cleanup()]);
      }
    });
  });
});

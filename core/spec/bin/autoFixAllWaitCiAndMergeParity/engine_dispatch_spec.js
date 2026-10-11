import {
  seedGithubLikeRepo,
  seedLocalState,
  SHIM_SCRIPT
} from '../../support/factories/autoFixAllWaitCiAndMergeParitySetup.js';
import { expectGhNeedsRun } from '../../support/factories/engineDispatchDockerSetup.js';
import { itRoutesGhEngineDispatch } from '../../support/sharedExamples/ghEngineDispatchRouting.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';

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
  let repoPath;

  itRoutesGhEngineDispatch(
    'engine_dispatch routing (via the real wait_ci_and_merge.sh shim)',
    SHIM_SCRIPT,
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'shell' ? undefined : { authTokenAlwaysFails: true });

      repoPath = repo.repoPath;
      await seedGithubLikeRepo(repo);
      await seedLocalState(repo, { engine: { mode } });

      const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

      return { args: [repo.repoPath, MODEL_EMAIL], env, cleanup: fakeGh.cleanup };
    },
    {
      shell: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('no pull request found for the current branch');
      },
      native: (result) => {
        expect(result.code).toEqual(1);
        expect(result.stdout).toEqual('');
        expect(result.stderr).toContain('could not obtain GitHub token via gh auth token');
      },
      // Docker batch 3 (issue #747): the passthrough fake `docker` runs
      // core/bin/arcanum on the host with the same fake `gh`, so it
      // fails like native; the run carries the gh needs.
      docker: (result, calls, world) => {
        expect(result).toEqual({
          stdout: '',
          stderr: 'arcanum: Error: could not obtain GitHub token via gh auth token\n',
          code: 1
        });
        expectGhNeedsRun(calls, repoPath, ['auto-fix-all-wait-ci-and-merge', ...[repoPath, MODEL_EMAIL]], world);
      }
    }
  );
});

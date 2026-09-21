import path from 'node:path';
import { seedGithubLikeRepo } from '../../support/factories/autoFixAllWaitCiParitySetup.js';
import { itRoutesEngineDispatch } from '../../support/sharedExamples/engineDispatchRouting.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import { createFakeGhBin } from '../../support/utils/fakeGhBin.js';
import { REPO_ROOT } from '../../support/utils/runCommand.js';

const SHIM_SCRIPT = path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci.sh');

// Parity test for the "auto-fix-all-wait-ci" migrated entrypoint (issue
// #262) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/262-migrate-auto-fix-all-wait-ci-entrypoint-to-native-node-js/node.md.
//
// See preconditions_spec.js/ci_outcomes_spec.js for the shell-vs-native
// output-parity scenarios (both bypass the engine_dispatch shim, running
// wait_ci_shell.sh directly). This file instead exercises the real
// wait_ci.sh engine_dispatch shim itself.
describe('auto-fix-all-wait-ci parity (shell vs. native) — engine_dispatch', () => {
  // Exercises the real auto-fix-all/scripts/wait_ci.sh engine_dispatch
  // shim from node/01 (unlike every scenario above, which bypasses it
  // and compares the two implementations directly) — proving
  // engine_dispatch.sh actually routes to the intended implementation
  // for both engine.mode=shell and engine.mode=native, per this
  // migration's own node/06 step.
  //
  // Once native mode routes through the shim, `env -i` strips this
  // process's own `ARCANUM_TEST_FAKE_FETCH`/`FAKE_FETCH_*` env vars
  // (only the explicit HOME/PATH allowlist survives — see
  // wait_ci.sh's own header comment), and the shim invokes
  // `core/bin/arcanum` as a plain argv call, with no `--import` flag to
  // preload the fake-fetch monkey-patch — so `AutoFixAllWaitCi`'s raw
  // `fetch` calls can't be faked this way here, and a runtime
  // `FAKE_GH_AUTH_TOKEN_FAIL` env var wouldn't survive to native's `gh`
  // calls either. Both scenarios below are instead built to fail before
  // any `fetch`/`gh api` call is ever reached: `FAKE_GH_PR_NUMBER` is
  // left unset, which fails inside `gh pr view` for the shell side, and
  // the native side uses a dedicated fake `gh` binary whose `auth token`
  // unconditionally fails (baked into the script file itself via
  // `createFakeGhBin({ authTokenAlwaysFails: true })`, so it survives
  // `env -i`) — making `GithubToken#get` fail even earlier, with a
  // distinct, native-only failure message that only reaches native's
  // own code path, proving real native execution (not a silent shell
  // fallback) occurred.
  itRoutesEngineDispatch(
    'engine_dispatch routing (via the real wait_ci.sh shim)',
    SHIM_SCRIPT,
    async (repo, mode) => {
      const fakeGh = await createFakeGhBin(mode === 'native' ? { authTokenAlwaysFails: true } : undefined);

      await seedGithubLikeRepo(repo);
      await seedEngineMode(repo, mode);

      const env = { ...process.env, PATH: `${fakeGh.binDir}:${process.env.PATH}` };

      return { args: [repo.repoPath], env, cleanup: fakeGh.cleanup };
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
      }
    }
  );
});

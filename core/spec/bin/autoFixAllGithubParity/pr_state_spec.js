import { expectParity, setupParityTest } from '../../support/factories/githubParitySetup.js';
import { runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github pr-state" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh pr-state and
// `core/bin/arcanum auto-fix-all-github-pr-state` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — pr-state', () => {
  it('matches shell exit code and "STATE=MERGED\\n" stdout for a merged PR', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_STATE: 'MERGED' },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_PR_MERGED: '1', FAKE_FETCH_PR_STATE: 'closed' }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-state', 'auto-fix-all-github-pr-state', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('STATE=MERGED\n');
    } finally {
      await ctx.cleanup();
    }
  });
});

import { expectParity, setupParityTest } from '../../support/factories/githubParitySetup.js';
import { runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github pr-number" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh pr-number and
// `core/bin/arcanum auto-fix-all-github-pr-number` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — pr-number', () => {
  it('matches shell exit code and stdout for a resolved PR number', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42' },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42' }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-number', 'auto-fix-all-github-pr-number', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('42\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code and stdout when no pull request is found', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runBoth(
        'pr-number', 'auto-fix-all-github-pr-number', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });
});

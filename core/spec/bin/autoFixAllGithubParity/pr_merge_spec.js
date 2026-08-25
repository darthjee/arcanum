import { setupParityTest } from '../../support/factories/githubParitySetup.js';
import { expectParity, runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github pr-merge" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh pr-merge and
// `core/bin/arcanum auto-fix-all-github-pr-merge` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — pr-merge', () => {
  it('matches shell exit code and "<url>\\n" stdout for a successful merge', async () => {
    const prUrl = 'https://github.com/darthjee/arcanum-github-fixture/pull/42';
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_TITLE: 'My PR', FAKE_GH_PR_URL: prUrl },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_PR_TITLE: 'My PR', FAKE_FETCH_PR_URL: prUrl }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-merge', 'auto-fix-all-github-pr-merge', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(`${prUrl}\n`);
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code and stdout when no pull request is found', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runBoth(
        'pr-merge', 'auto-fix-all-github-pr-merge', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });
});

import { expectParity, setupParityTest } from '../../support/factories/githubParitySetup.js';
import { runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github has-shipit-label" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh has-shipit-label and
// `core/bin/arcanum auto-fix-all-github-has-shipit-label` against
// equivalent inputs, asserting byte-identical stdout and exit code —
// see setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — has-shipit-label', () => {
  it('matches shell exit code (0) and empty stdout when the shipit label is present', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_ISSUE_LABELS: 'shipit\nOther' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'shipit\nOther' }
    });

    try {
      const { shell, native } = await runBoth(
        'has-shipit-label',
        'auto-fix-all-github-has-shipit-label',
        ['5'],
        ctx.shellRepo,
        ctx.nativeRepo,
        ctx.shellEnv,
        ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code (1) and empty stdout when the shipit label is absent', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Other' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Other' }
    });

    try {
      const { shell, native } = await runBoth(
        'has-shipit-label',
        'auto-fix-all-github-has-shipit-label',
        ['5'],
        ctx.shellRepo,
        ctx.nativeRepo,
        ctx.shellEnv,
        ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });
});

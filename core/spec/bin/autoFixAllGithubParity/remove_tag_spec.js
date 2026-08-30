import { setupParityTest } from '../../support/factories/githubParitySetup.js';
import { expectInvalidRepoPathParity, expectParity, runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github remove-tag" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh remove-tag and
// `core/bin/arcanum auto-fix-all-github-remove-tag` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — remove-tag', () => {
  it('matches shell exit code/stdout for a successful remove', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_ISSUE_LABELS: 'Ready for Work' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Ready for Work' }
    });

    try {
      const { shell, native } = await runBoth(
        'remove-tag',
        'auto-fix-all-github-remove-tag',
        ['5', 'ready_for_work'],
        ctx.shellRepo,
        ctx.nativeRepo,
        ctx.shellEnv,
        ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(
        'Removed tag \'ready_for_work\' from issue #5 on darthjee/arcanum-github-fixture\n'
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell for a non-directory / non-git repo_path (repo_path_enter parity)', async () => {
    await expectInvalidRepoPathParity('remove-tag', 'auto-fix-all-github-remove-tag', ['5', 'ready_for_work']);
  });
});

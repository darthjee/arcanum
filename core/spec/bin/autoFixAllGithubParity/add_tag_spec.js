import { expectParity, seedGithubLikeRepo, setupParityTest } from '../../support/factories/githubParitySetup.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { NATIVE_BIN, runBoth, runCommand, SHELL_SCRIPT } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-all-github add-tag" migrated
// entrypoint (issue #265) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/265-migrate-auto-fix-all-github-entrypoint-pr-number-pr-state-pr-merge-cleanup-branch-has-shipit-label-add-tag-remove-tag-to-native-node-js/node.md.
// Runs auto-fix-all/scripts/github.sh add-tag and
// `core/bin/arcanum auto-fix-all-github-add-tag` against equivalent
// inputs, asserting byte-identical stdout and exit code — see
// setupParityTest/runBoth for how `gh`/`fetch` are faked on each side.
describe('auto-fix-all-github parity (shell vs. native) — add-tag', () => {
  it('matches shell exit code/stdout for a successful add', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_ISSUE_LABELS: '' },
      fetchVars: { FAKE_FETCH_ISSUE_LABELS: '' }
    });

    try {
      const { shell, native } = await runBoth(
        'add-tag',
        'auto-fix-all-github-add-tag',
        ['5', 'ready_for_work'],
        ctx.shellRepo,
        ctx.nativeRepo,
        ctx.shellEnv,
        ctx.nativeEnv
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('Added tag \'ready_for_work\' to issue #5 on darthjee/arcanum-github-fixture\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code (1) and empty stdout for the shipit guard', async () => {
    const shellRepo = await createGitFixtureRepo();
    const nativeRepo = await createGitFixtureRepo();

    try {
      await Promise.all([seedGithubLikeRepo(shellRepo), seedGithubLikeRepo(nativeRepo)]);

      const shell = await runCommand([SHELL_SCRIPT, 'add-tag', shellRepo.repoPath, '5', 'shipit'], shellRepo.repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'auto-fix-all-github-add-tag', nativeRepo.repoPath, '5', 'shipit'],
        nativeRepo.repoPath
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
    } finally {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
    }
  });
});

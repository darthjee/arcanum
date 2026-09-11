import { setupParityTest } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import { AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT, expectParity, runBoth } from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-issue-github pr-view" migrated
// entrypoint (issue #430) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node.md's
// "Shared contracts" (`DispatchFailure('', 1)` on the "no PR found"
// path). Runs auto-fix-issue/scripts/github_shell.sh pr-view (directly,
// NOT through the engine_dispatch shim) and `core/bin/arcanum
// auto-fix-issue-github-pr-view` against equivalent inputs, asserting
// byte-identical stdout and exit code.
describe('auto-fix-issue-github parity (shell vs. native) — pr-view', () => {
  it('matches shell exit code and stdout for a resolved (draft) PR', async () => {
    const ctx = await setupParityTest({
      ghVars: {
        FAKE_GH_PR_NUMBER: '42',
        FAKE_GH_PR_URL: 'https://github.com/example/repo/pull/42',
        FAKE_GH_PR_IS_DRAFT: 'true'
      },
      fetchVars: {
        FAKE_FETCH_PR_NUMBER: '42',
        FAKE_FETCH_PR_URL: 'https://github.com/example/repo/pull/42',
        FAKE_FETCH_PR_DRAFT: '1'
      }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-view', 'auto-fix-issue-github-pr-view', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv,
        AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('URL=https://github.com/example/repo/pull/42\nIS_DRAFT=true\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('produces empty stdout/stderr and exit 1 on both sides when no PR is found', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runBoth(
        'pr-view', 'auto-fix-issue-github-pr-view', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv,
        AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr).toEqual('');
      expect(native.stdout).toEqual('');
      expect(native.stderr).toEqual('');
    } finally {
      await ctx.cleanup();
    }
  });
});

import { setupParityTest } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import { AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT, expectParity, runBoth } from '../../support/utils/runCommand.js';

const REPO_REF = 'darthjee/arcanum-github-fixture';

// Parity test for the "auto-fix-issue-github pr-ready" migrated
// entrypoint (issue #430) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node.md.
// Runs auto-fix-issue/scripts/github_shell.sh pr-ready (directly, NOT
// through the engine_dispatch shim) and `core/bin/arcanum
// auto-fix-issue-github-pr-ready` against equivalent inputs, asserting
// byte-identical stdout and exit code.
describe('auto-fix-issue-github parity (shell vs. native) — pr-ready', () => {
  it('matches shell exit code and stdout when the PR is successfully marked ready', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_URL: 'https://github.com/example/repo/pull/42' },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_PR_URL: 'https://github.com/example/repo/pull/42' }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-ready', 'auto-fix-issue-github-pr-ready', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv,
        AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('OK\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code and stderr when marking the PR ready fails', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_NUMBER: '42', FAKE_GH_PR_READY_FAIL: '1' },
      fetchVars: { FAKE_FETCH_PR_NUMBER: '42', FAKE_FETCH_MARK_READY_FAIL: '1' }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-ready', 'auto-fix-issue-github-pr-ready', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv,
        AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
      // Only stdout/exit code are required byte-identical (see
      // docs/agents/architecture/script-engine.md) — the shell side's
      // stderr also carries the underlying `gh pr ready` failure's own
      // message, which native has no equivalent for (it never shells
      // out to `gh`), so both sides are only checked for the shared,
      // canonical failure line.
      expect(shell.stderr).toContain(`Error: could not mark PR ready on ${REPO_REF}`);
      expect(native.stderr.trim()).toEqual(`arcanum: Error: could not mark PR ready on ${REPO_REF}`);
    } finally {
      await ctx.cleanup();
    }
  });
});

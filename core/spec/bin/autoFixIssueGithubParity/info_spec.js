import { setupParityTest } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import {
  AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT, expectInvalidRepoPathParity, expectParity, runBoth
} from '../../support/utils/runCommand.js';

// Parity test for the "auto-fix-issue-github info" migrated entrypoint
// (issue #430) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node.md.
// Runs auto-fix-issue/scripts/github_shell.sh info (directly, NOT
// through the auto-fix-issue/scripts/github.sh engine_dispatch shim —
// see engine_dispatch_spec.js for that) and `core/bin/arcanum
// auto-fix-issue-github-info` against equivalent inputs, asserting
// byte-identical stdout and exit code.
describe('auto-fix-issue-github parity (shell vs. native) — info', () => {
  it('matches shell exit code and stdout for a resolved github.com origin', async () => {
    const ctx = await setupParityTest();

    try {
      const { shell, native } = await runBoth(
        'info', 'auto-fix-issue-github-info', [], ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv,
        AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual('DOMAIN=github.com\nREPO=darthjee/arcanum-github-fixture\n');
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell for a non-directory / non-git repo_path (repo_path_enter parity)', async () => {
    await expectInvalidRepoPathParity('info', 'auto-fix-issue-github-info', [], AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT);
  });
});

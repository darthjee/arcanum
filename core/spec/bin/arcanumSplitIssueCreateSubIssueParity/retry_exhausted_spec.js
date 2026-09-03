import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import {
  ISSUE_ID,
  NATIVE_BIN,
  SHELL_SCRIPT,
  runCommand,
  seedZeroRetryRepo,
  writeSubIssueFile
} from '../../support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js';

// Parity test for the "arcanum-split-issue-create-sub-issue" migrated
// entrypoint (issue #259) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/259-migrate-arcanum-split-issue-create-sub-issue-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/create_sub_issue_shell.sh (directly, NOT
// through the arcanum-split-issue/scripts/create_sub_issue.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-create-sub-issue` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// This file covers the retry-exhausted failure path. See
// `argument_validation_spec.js` for the argument / file-existence
// validation scenarios.
//
// The retry-exhausted failure path is exercised here, offline and
// deterministically: setting .claude/state/arcanum-config.json's
// plan-issues.max-retry-count to 0 makes both the shell implementation's
// retry `while` loop and SpawnIssue.js's own retry `for` loop skip every
// attempt entirely (never touching gh/curl/fetch) and immediately print
// STATUS=failed — this also happens to reveal that create_sub_issue_shell.sh
// prints STATUS=failed TWICE on this path (it echoes spawn_issue.sh's own
// STATUS=failed verbatim, then appends its own STATUS=failed on top), a
// quirk the native module now reproduces exactly (see the "fix" commit on
// this issue for the discovery).

describe('arcanum-split-issue-create-sub-issue parity (shell vs. native) — retry-exhausted failure path', () => {
  describe('the retry-exhausted failure path (plan-issues.max-retry-count: 0)', () => {
    it('matches shell exit code and the doubled STATUS=failed stdout, prefixed by the progress line', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedZeroRetryRepo(shellRepo.repoPath), seedZeroRetryRepo(nativeRepo.repoPath)]);

        const shellFile = await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '01',
          'my_sub_issue',
          '# My Sub Issue\n\nBody content here.\n'
        );
        const nativeFile = await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '01',
          'my_sub_issue',
          '# My Sub Issue\n\nBody content here.\n'
        );

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ISSUE_ID, shellFile], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue', nativeRepo.repoPath, ISSUE_ID, nativeFile],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual(
          `Creating sub-issue 01 for issue #${ISSUE_ID}: My Sub Issue\nSTATUS=failed\nSTATUS=failed\n`
        );
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });
});

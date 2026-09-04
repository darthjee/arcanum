import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import {
  ISSUE_ID,
  NATIVE_BIN,
  SHELL_SCRIPT,
  runBoth,
  runCommand,
  seedZeroRetryRepo,
  writeSubIssueFile
} from '../../support/factories/arcanumSplitIssuePushSubIssuesParitySetup.js';

// Parity test for the "arcanum-split-issue-push-sub-issues" migrated
// entrypoint (issue #260) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/260-migrate-arcanum-split-issue-push-sub-issues-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/push_sub_issues_shell.sh (directly, NOT
// through the arcanum-split-issue/scripts/push_sub_issues.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-push-sub-issues` against identical inputs, asserting
// byte-identical stdout and exit code.
//
// This file covers the zero-matching-files and stops-at-first-failure
// scenarios. See `argument_validation_spec.js` for the <repo_path>
// precondition (hard failure) scenarios.
//
// Coverage note: mirroring arcanumSplitIssueCreateSubIssueParity_spec.js's
// own precedent, the STATUS=ok multi-file happy path (actually creating
// sub-issues on GitHub) is out of scope here — both engines ultimately
// bottom out at create_sub_issue_shell.sh -> spawn_issue.sh -> real
// curl/gh calls, which can't be exercised offline. That path (ascending
// dispatch order, CREATED= accumulation) is instead covered by
// ArcanumSplitIssuePushSubIssues_spec.js's fully fake-injected unit tests
// (node/03).
//
// The "stops at first failure" contract IS exercised here, offline and
// deterministically: push_sub_issues_shell.sh itself delegates each
// file's create call to create_sub_issue.sh (an engine_dispatch shim,
// already migrated) — setting .claude/state/arcanum-config.json's
// plan-issues.max-retry-count to 0 (with no engine.mode override, so the
// default "shell" mode applies uniformly on both sides for that nested
// dispatch) makes SpawnIssue's retry loop (shell or native) skip every
// attempt entirely and immediately fail, never touching gh/curl/fetch.

describe('arcanum-split-issue-push-sub-issues parity (shell vs. native) — push behavior', () => {
  describe('zero matching files', () => {
    it('matches shell STATUS=ok/CREATED= and exit code for an empty issues directory', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\nCREATED=\n');
      } finally {
        await repo.cleanup();
      }
    });

    it('matches shell STATUS=ok/CREATED= and exit code when only non-matching files are present', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const issuesDir = path.join(repo.repoPath, 'docs', 'agents', 'issues');

        await mkdir(issuesDir, { recursive: true });
        await writeFile(path.join(issuesDir, 'unrelated.md'), 'not a sub-issue draft\n');

        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(0);
        expect(shell.stdout).toEqual('STATUS=ok\nCREATED=\n');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('the "stops at first failure" contract (plan-issues.max-retry-count: 0)', () => {
    it('matches shell STATUS=failed/CREATED=/FAILED= and exit code, stopping after the first of 2+ files', async () => {
      const shellRepo = await createGitFixtureRepo();
      const nativeRepo = await createGitFixtureRepo();

      try {
        await Promise.all([seedZeroRetryRepo(shellRepo.repoPath), seedZeroRetryRepo(nativeRepo.repoPath)]);

        const shellFirstFile = await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '01',
          'first_sub_issue',
          '# First Sub Issue\n\nBody content here.\n'
        );

        await writeSubIssueFile(
          shellRepo.repoPath,
          ISSUE_ID,
          '02',
          'second_sub_issue',
          '# Second Sub Issue\n\nBody content here.\n'
        );

        const nativeFirstFile = await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '01',
          'first_sub_issue',
          '# First Sub Issue\n\nBody content here.\n'
        );

        await writeSubIssueFile(
          nativeRepo.repoPath,
          ISSUE_ID,
          '02',
          'second_sub_issue',
          '# Second Sub Issue\n\nBody content here.\n'
        );

        expect(shellFirstFile).toEqual(nativeFirstFile);

        const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, ISSUE_ID], shellRepo.repoPath);
        const native = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-push-sub-issues', nativeRepo.repoPath, ISSUE_ID],
          nativeRepo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).toEqual(1);
        expect(shell.stdout).toEqual(`STATUS=failed\nCREATED=\nFAILED=${shellFirstFile}\n`);
      } finally {
        await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
      }
    });
  });
});

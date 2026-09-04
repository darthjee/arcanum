import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import {
  runBoth,
  runCommand,
  SHELL_SCRIPT,
  NATIVE_BIN
} from '../../support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js';

// Parity test for the "arcanum-split-issue-create-sub-issue-file" migrated
// entrypoint (issue #257) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/257-migrate-arcanum-split-issue-create-sub-issue-file-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Runs
// arcanum-split-issue/scripts/create_sub_issue_file_shell.sh (directly,
// NOT through the arcanum-split-issue/scripts/create_sub_issue_file.sh
// engine_dispatch shim — so this test isn't circular) and `core/bin/arcanum
// arcanum-split-issue-create-sub-issue-file` against identical
// inputs/repo state, asserting byte-identical stdout and exit code for
// both. Purely filesystem-based — no `gh`/network dependency — so both
// failure and success paths are exercised here.
//
// This file covers the file-creation success path. See
// `argument_validation_spec.js` for the argument / file-existence
// validation scenarios.

describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native) — success path', () => {
  describe('the success path', () => {
    it('matches shell exit code and FILE=... stdout, and counting is gap-tolerant across separate shell/native runs', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const bodyFile = path.join(repo.repoPath, 'body.md');

        await writeFile(bodyFile, 'body content\n');

        const { shell, native } = await runBoth(
          [repo.repoPath, '999', 'Hello, World! Foo-Bar', bodyFile],
          repo.repoPath
        );

        expect(shell.code).toEqual(0);
        expect(native.code).toEqual(shell.code);
        expect(shell.stdout).toEqual('FILE=docs/agents/issues/999_01_hello_world_foo_bar.md\n');
        expect(native.stdout).toEqual('FILE=docs/agents/issues/999_02_hello_world_foo_bar.md\n');

        const shellWritten = await readFile(
          path.join(repo.repoPath, 'docs', 'agents', 'issues', '999_01_hello_world_foo_bar.md'),
          'utf8'
        );
        const nativeWritten = await readFile(
          path.join(repo.repoPath, 'docs', 'agents', 'issues', '999_02_hello_world_foo_bar.md'),
          'utf8'
        );

        expect(shellWritten).toEqual('# Hello, World! Foo-Bar\n\nbody content\n');
        expect(nativeWritten).toEqual(shellWritten);
      } finally {
        await repo.cleanup();
      }
    });

    it('increments the same count sequence for shell and native when run against the same directory state', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const issuesDir = path.join(repo.repoPath, 'docs', 'agents', 'issues');
        const bodyFile = path.join(repo.repoPath, 'body.md');

        await mkdir(issuesDir, { recursive: true });
        await writeFile(bodyFile, '');

        const shellResult = await runCommand(
          [SHELL_SCRIPT, repo.repoPath, '999', 'Shell Entry', bodyFile],
          repo.repoPath
        );

        expect(shellResult.code).toEqual(0);
        expect(shellResult.stdout).toEqual('FILE=docs/agents/issues/999_01_shell_entry.md\n');

        const nativeResult = await runCommand(
          [process.execPath, NATIVE_BIN, 'arcanum-split-issue-create-sub-issue-file', repo.repoPath, '999', 'Native Entry', bodyFile],
          repo.repoPath
        );

        expect(nativeResult.code).toEqual(0);
        expect(nativeResult.stdout).toEqual('FILE=docs/agents/issues/999_02_native_entry.md\n');
      } finally {
        await repo.cleanup();
      }
    });
  });
});

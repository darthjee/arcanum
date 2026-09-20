import path from 'node:path';
import {
  itRejectsInvalidRepoPath,
  itRejectsMissingArgument
} from '../../support/sharedExamples/cliParityValidation.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
import { runBoth } from '../../support/factories/arcanumSplitIssueCreateSubIssueFileParitySetup.js';

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
// This file covers the argument / file-existence validation scenarios. See
// `success_path_spec.js` for the file-creation success path.

describe('arcanum-split-issue-create-sub-issue-file parity (shell vs. native) — argument validation', () => {
  itRejectsMissingArgument(
    'a missing <repo_path> argument',
    (cwd) => runBoth(['', '999', 'Title', '/dev/null'], cwd),
    async () => {
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      return { cwd, cleanup: () => removeTempDir(cwd) };
    }
  );

  itRejectsMissingArgument(
    'a missing <issue_id> argument',
    (cwd) => runBoth([cwd, '', 'Title', '/dev/null'], cwd),
    async () => {
      const repo = await createGitFixtureRepo();

      return { cwd: repo.repoPath, cleanup: repo.cleanup };
    }
  );

  itRejectsMissingArgument(
    'a missing <title> argument',
    (cwd) => runBoth([cwd, '999', '', '/dev/null'], cwd),
    async () => {
      const repo = await createGitFixtureRepo();

      return { cwd: repo.repoPath, cleanup: repo.cleanup };
    }
  );

  itRejectsMissingArgument(
    'a missing <body_file> argument',
    (cwd) => runBoth([cwd, '999', 'Title', ''], cwd),
    async () => {
      const repo = await createGitFixtureRepo();

      return { cwd: repo.repoPath, cleanup: repo.cleanup };
    }
  );

  itRejectsInvalidRepoPath(
    (repoPath, cwd) => runBoth([repoPath, '999', 'Title', '/dev/null'], cwd),
    { cwdPrefix: 'arcanum-core-ascsif-parity-' }
  );

  describe('a body_file that does not exist', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const missingBodyFile = path.join(repo.repoPath, 'missing-body.md');

        const { shell, native } = await runBoth(
          [repo.repoPath, '999', 'Title', missingBodyFile],
          repo.repoPath
        );

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingBodyFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingBodyFile}`);
      } finally {
        await repo.cleanup();
      }
    });
  });
});

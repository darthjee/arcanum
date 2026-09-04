import path from 'node:path';
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
  describe('a missing <repo_path> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const { shell, native } = await runBoth(['', '999', 'Title', '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a missing <issue_id> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '', 'Title', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <title> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '999', '', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <body_file> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, '999', 'Title', ''], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a repo_path that is not a directory', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');

        const { shell, native } = await runBoth([missingPath, '999', 'Title', '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a repo_path that is not a git repository', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const cwd = await createTempDir('arcanum-core-ascsif-parity-');

      try {
        const { shell, native } = await runBoth([cwd, '999', 'Title', '/dev/null'], cwd);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

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

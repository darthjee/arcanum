import path from 'node:path';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
import { ISSUE_ID, runBoth } from '../../support/factories/arcanumSplitIssueCreateSubIssueParitySetup.js';

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
// This file covers the argument / file-existence validation scenarios. See
// `retry_exhausted_spec.js` for the retry-exhausted failure path.
//
// Coverage note: mirroring spawnIssueParity_spec.js's /
// githubIssueCreateParity_spec.js's own precedent, the STATUS=ok happy
// path is NOT exercised here. create_sub_issue_shell.sh delegates the
// actual GitHub work to arcanum/_lib/spawn_issue.sh — itself an
// engine_dispatch shim (spawn-issue is already migrated) — which in shell
// mode ultimately shells out to `curl` (via github_issue_shell.sh's
// cmd_create), a real network call that can't be intercepted the way
// `gh` is (no PATH-swappable binary) without either touching the real
// network or editing arcanum/_lib/spawn_issue.sh's own env-var allowlist
// (out of this agent's scope — see docs/agents/architecture/script-engine.md).
// The happy path is instead covered by
// ArcanumSplitIssueCreateSubIssue_spec.js's fully fake-injected unit
// tests (node/03).

describe('arcanum-split-issue-create-sub-issue parity (shell vs. native) — argument validation', () => {
  describe('a missing <repo_path> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const { shell, native } = await runBoth(['', ISSUE_ID, '/dev/null'], cwd);

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
        const { shell, native } = await runBoth([repo.repoPath, '', '/dev/null'], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
      } finally {
        await repo.cleanup();
      }
    });
  });

  describe('a missing <sub_issue_file> argument', () => {
    it('matches shell exit code and stdout', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID, ''], repo.repoPath);

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
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');

        const { shell, native } = await runBoth([missingPath, ISSUE_ID, '/dev/null'], cwd);

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
      const cwd = await createTempDir('arcanum-core-ascsi-parity-');

      try {
        const { shell, native } = await runBoth([cwd, ISSUE_ID, '/dev/null'], cwd);

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

  describe('a sub_issue_file that does not exist', () => {
    it('matches shell exit code, stdout, and stderr message', async () => {
      const repo = await createGitFixtureRepo();

      try {
        const missingFile = path.join(repo.repoPath, 'docs', 'agents', 'issues', 'missing.md');

        const { shell, native } = await runBoth([repo.repoPath, ISSUE_ID, missingFile], repo.repoPath);

        expect(native.stdout).toEqual(shell.stdout);
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stdout).toEqual('');
        expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingFile}`);
        expect(native.stderr.trim()).toContain(`Error: file not found: ${missingFile}`);
      } finally {
        await repo.cleanup();
      }
    });
  });
});

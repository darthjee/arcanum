import path from 'node:path';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';
import { ISSUE_ID, runBoth } from '../../support/factories/arcanumSplitIssuePushSubIssuesParitySetup.js';

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
// This file covers the <repo_path> precondition (hard failure) scenarios.
// See `push_behavior_spec.js` for the zero-matching-files and
// stops-at-first-failure scenarios.

describe('arcanum-split-issue-push-sub-issues parity (shell vs. native) — argument validation', () => {
  describe('a present-but-non-directory repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-pssi-parity-');

      try {
        const missingPath = path.join(cwd, 'no-such-dir');
        const { shell, native } = await runBoth([missingPath, ISSUE_ID], cwd);

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a directory: ${missingPath}`);
        expect(native.stderr.trim()).toContain(`Error: not a directory: ${missingPath}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });

  describe('a non-git repo_path (hard failure)', () => {
    it('matches shell exit code and stderr message, with no stdout on either side', async () => {
      const cwd = await createTempDir('arcanum-core-pssi-parity-');

      try {
        const { shell, native } = await runBoth([cwd, ISSUE_ID], cwd);

        expect(shell.stdout).toEqual('');
        expect(native.stdout).toEqual('');
        expect(native.code).toEqual(shell.code);
        expect(shell.code).not.toEqual(0);
        expect(shell.stderr.trim()).toEqual(`Error: not a git repository: ${cwd}`);
        expect(native.stderr.trim()).toContain(`Error: not a git repository: ${cwd}`);
      } finally {
        await removeTempDir(cwd);
      }
    });
  });
});

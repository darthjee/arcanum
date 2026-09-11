import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setupParityTest } from '../../support/factories/autoFixIssueGithubParitySetup.js';
import { AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT, expectParity, runBoth } from '../../support/utils/runCommand.js';
import { createTempDir, removeTempDir } from '../../support/utils/tempDir.js';

const REPO_REF = 'darthjee/arcanum-github-fixture';
const TITLE = 'My fixture PR';

// Parity test for the "auto-fix-issue-github pr-create" migrated
// entrypoint (issue #430) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/430-migrate-auto-fix-issue-github-entrypoint-to-native-node-js/node.md.
// Both fixture repos are left on their default `main` branch (not
// `issue-<id>`), so `_persist_pr_state`/`_sync_pr_labels_and_state` (and
// their native counterparts) are no-ops on both sides — see
// autoFixIssueGithubParitySetup.js. Runs
// auto-fix-issue/scripts/github_shell.sh pr-create (directly, NOT
// through the engine_dispatch shim) and `core/bin/arcanum
// auto-fix-issue-github-pr-create` against equivalent inputs, asserting
// byte-identical stdout and exit code. `gh pr create`'s own REST
// equivalent is faked on both sides — see setupParityTest/runBoth for
// how `gh`/`fetch` are faked.
describe('auto-fix-issue-github parity (shell vs. native) — pr-create', () => {
  let bodyDir;
  let bodyFile;

  beforeEach(async () => {
    bodyDir = await createTempDir('arcanum-core-afigh-pr-create-body-');
    bodyFile = path.join(bodyDir, 'body.md');
    await writeFile(bodyFile, 'PR body text\n');
  });

  afterEach(async () => {
    await removeTempDir(bodyDir);
  });

  it('matches shell exit code and stdout for a successfully created PR', async () => {
    const url = 'https://github.com/example/repo/pull/77';
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_CREATE_URL: url },
      fetchVars: { FAKE_FETCH_PR_CREATE_URL: url }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-create', 'auto-fix-issue-github-pr-create', [TITLE, bodyFile],
        ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv, AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).toEqual(0);
      expect(shell.stdout).toEqual(`${url}\n`);
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code and stderr when the body file does not exist', async () => {
    const ctx = await setupParityTest();
    const missingFile = path.join(bodyDir, 'missing.md');

    try {
      const { shell, native } = await runBoth(
        'pr-create', 'auto-fix-issue-github-pr-create', [TITLE, missingFile],
        ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv, AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toEqual(`Error: file not found: ${missingFile}`);
      expect(native.stderr.trim()).toContain(`Error: file not found: ${missingFile}`);
    } finally {
      await ctx.cleanup();
    }
  });

  it('matches shell exit code and stderr when PR creation fails', async () => {
    const ctx = await setupParityTest({
      ghVars: { FAKE_GH_PR_CREATE_FAIL: '1' },
      fetchVars: { FAKE_FETCH_PR_CREATE_FAIL: '1' }
    });

    try {
      const { shell, native } = await runBoth(
        'pr-create', 'auto-fix-issue-github-pr-create', [TITLE, bodyFile],
        ctx.shellRepo, ctx.nativeRepo, ctx.shellEnv, ctx.nativeEnv, AUTO_FIX_ISSUE_GITHUB_SHELL_SCRIPT
      );

      expectParity(shell, native);
      expect(shell.code).not.toEqual(0);
      expect(shell.stdout).toEqual('');
      // Only stdout/exit code are required byte-identical (see
      // docs/agents/architecture/script-engine.md) — the shell side's
      // stderr also carries the underlying `gh pr create` failure's own
      // message, which native has no equivalent for (it never shells
      // out to `gh`), so both sides are only checked for the shared,
      // canonical failure line.
      expect(shell.stderr).toContain(`Error: could not create PR on ${REPO_REF}`);
      expect(native.stderr.trim()).toEqual(`arcanum: Error: could not create PR on ${REPO_REF}`);
    } finally {
      await ctx.cleanup();
    }
  });
});

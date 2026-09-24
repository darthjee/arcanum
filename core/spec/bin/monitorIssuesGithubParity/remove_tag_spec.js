import path from 'node:path';
import { setupParityTest } from '../../support/factories/githubParitySetup.js';
import { SCRIPTS_DIR } from '../../support/factories/monitorIssuesParitySetup.js';
import { expectParity, FAKE_FETCH_PRELOAD, NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';

// Parity test for the "monitor-issues-github-remove-tag" migrated
// entrypoint (issue #586): runs
// monitor-issues/scripts/github_remove_tag_shell.sh (fake `gh`) and
// `core/bin/arcanum monitor-issues-github-remove-tag` (fake `fetch`)
// against equivalent inputs, asserting byte-identical stdout and exit
// code.
const SHELL_SCRIPT = path.join(SCRIPTS_DIR, 'github_remove_tag_shell.sh');

describe('monitor-issues-github-remove-tag parity (shell vs. native)', () => {
  async function runScenario(scenario, args) {
    const ctx = await setupParityTest(scenario);

    try {
      const shell = await runCommand(
        ['bash', SHELL_SCRIPT, ctx.shellRepo.repoPath, ...args], ctx.shellRepo.repoPath, ctx.shellEnv
      );
      const native = await runCommand(
        [process.execPath, '--import', FAKE_FETCH_PRELOAD, NATIVE_BIN, 'monitor-issues-github-remove-tag',
          ctx.nativeRepo.repoPath, ...args],
        ctx.nativeRepo.repoPath,
        ctx.nativeEnv
      );

      return { shell, native };
    } finally {
      await ctx.cleanup();
    }
  }

  it('matches for a successful remove', async () => {
    const { shell, native } = await runScenario(
      { ghVars: { FAKE_GH_ISSUE_LABELS: 'Created' }, fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Created' } },
      ['5', 'created']
    );

    expectParity(shell, native);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('Removed tag \'created\' from issue #5 on darthjee/arcanum-github-fixture\n');
  });

  it('matches when the label is already absent', async () => {
    const { shell, native } = await runScenario({}, ['5', 'created']);

    expectParity(shell, native);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('Tag \'created\' not present on issue #5 — nothing to do.\n');
  });

  it('matches for the human-only shipit guard (exit 1)', async () => {
    const { shell, native } = await runScenario({}, ['5', 'shipit']);

    expectParity(shell, native);
    expect(shell.code).toEqual(1);
  });

  it('matches when the label removal fails (exit 1)', async () => {
    const { shell, native } = await runScenario(
      {
        ghVars: { FAKE_GH_ISSUE_LABELS: 'Created', FAKE_GH_ISSUE_EDIT_FAIL: '1' },
        fetchVars: { FAKE_FETCH_ISSUE_LABELS: 'Created', FAKE_FETCH_ISSUE_EDIT_FAIL: '1' }
      },
      ['5', 'created']
    );

    expectParity(shell, native);
    expect(shell.code).toEqual(1);
  });
});

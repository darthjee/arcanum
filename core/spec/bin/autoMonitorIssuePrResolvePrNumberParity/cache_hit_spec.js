import { createFixtureRepo, runBoth as runIssueState } from '../../support/factories/issueStateParitySetup.js';
import { ID, SHELL_SCRIPT } from '../../support/factories/autoMonitorIssuePrResolvePrNumberParitySetup.js';
import { NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-monitor-issue-pr-resolve-pr-number" migrated
// entrypoint (issue #435) — see docs/agents/architecture/script-engine.md's
// "output/exit-code contract" and
// docs/agents/plans/435-migrate-auto-monitor-issue-pr-resolve-pr-number-entrypoint-to-native-node-js/node.md's
// "Shared contracts". Covers the cache-hit short-circuit: pre-seeds
// `.claude/state/issue-<id>.json`'s `pr_id` field identically on both
// sides (via `issue_state_shell.sh`/`core/bin/arcanum issue-state`
// directly — no `gh`/`fetch` double needed at all, since a cache hit
// never reaches the branch/PR lookup), then runs
// auto-monitor-issue-pr/scripts/resolve_pr_number_shell.sh (directly,
// NOT through the resolve_pr_number.sh engine_dispatch shim) and
// `core/bin/arcanum auto-monitor-issue-pr-resolve-pr-number` against
// equivalent inputs, asserting byte-identical stdout and exit code.

describe('auto-monitor-issue-pr-resolve-pr-number parity (shell vs. native) — cache hit', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createFixtureRepo('arcanum-core-rpn-parity-shell-');
    nativeRepo = await createFixtureRepo('arcanum-core-rpn-parity-native-');
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  it('returns the cached pr_id without any gh/fetch lookup', async () => {
    await runIssueState(['set', ID, 'pr_id', '99'], shellRepo, nativeRepo);

    const shell = await runCommand([SHELL_SCRIPT, shellRepo, ID], shellRepo);
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'auto-monitor-issue-pr-resolve-pr-number', nativeRepo, ID], nativeRepo
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('99\n');
  });

  it('strips a leading "#" before reading the cache, returning the cached pr_id', async () => {
    await runIssueState(['set', ID, 'pr_id', '99'], shellRepo, nativeRepo);

    const shell = await runCommand([SHELL_SCRIPT, shellRepo, `#${ID}`], shellRepo);
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'auto-monitor-issue-pr-resolve-pr-number', nativeRepo, `#${ID}`], nativeRepo
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).toEqual(0);
    expect(shell.stdout).toEqual('99\n');
  });
});

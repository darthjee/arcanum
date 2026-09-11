import { createFixtureRepo } from '../../support/factories/issueStateParitySetup.js';
import { SHELL_SCRIPT } from '../../support/factories/autoMonitorIssuePrResolvePrNumberParitySetup.js';
import { NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';
import { removeTempDir } from '../../support/utils/tempDir.js';

// Parity test for the "auto-monitor-issue-pr-resolve-pr-number" migrated
// entrypoint (issue #435) — see this suite's cache_hit_spec.js header for
// the full shared-contracts context. Covers the missing-argument/
// non-numeric-`id` usage-error path — both sides reject before ever
// touching git/GitHub, so no `gh`/`fetch` double is needed.
describe('auto-monitor-issue-pr-resolve-pr-number parity (shell vs. native) — usage error', () => {
  let shellRepo;
  let nativeRepo;

  beforeEach(async () => {
    shellRepo = await createFixtureRepo('arcanum-core-rpn-parity-usage-shell-');
    nativeRepo = await createFixtureRepo('arcanum-core-rpn-parity-usage-native-');
  });

  afterEach(async () => {
    await removeTempDir(shellRepo);
    await removeTempDir(nativeRepo);
  });

  it('matches shell exit code and empty stdout when id is missing', async () => {
    const shell = await runCommand([SHELL_SCRIPT, shellRepo], shellRepo);
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'auto-monitor-issue-pr-resolve-pr-number', nativeRepo], nativeRepo
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).not.toEqual(0);
    expect(shell.stdout).toEqual('');
  });

  it('matches shell exit code and empty stdout when id is non-numeric', async () => {
    const shell = await runCommand([SHELL_SCRIPT, shellRepo, 'abc'], shellRepo);
    const native = await runCommand(
      [process.execPath, NATIVE_BIN, 'auto-monitor-issue-pr-resolve-pr-number', nativeRepo, 'abc'], nativeRepo
    );

    expect(native.stdout).toEqual(shell.stdout);
    expect(native.code).toEqual(shell.code);
    expect(shell.code).not.toEqual(0);
    expect(shell.stdout).toEqual('');
  });
});

import { SHELL_SCRIPT } from '../../support/factories/autoMonitorPrMonitorPrParitySetup.js';
import { createGitFixtureRepo } from '../../support/utils/gitFixtureRepo.js';
import { NATIVE_BIN, runCommand } from '../../support/utils/runCommand.js';

const USAGE = 'Usage: monitor_pr.sh <repo_path> --pr-number <pr_number> [--issue-id <id>]';
const USAGE_TAIL = '<repo_path> --pr-number <pr_number> [--issue-id <id>]';

// Parity test for the "auto-monitor-pr-monitor-pr" migrated entrypoint
// (issue #436) — see `pending_spec.js`'s header for the full
// shared-contracts context. Covers the usage-error path (missing
// `--pr-number` / an unrecognized flag) — both sides reject before ever
// touching `gh`/GitHub, so no fake `gh`/`fetch` double is needed; only a
// valid (but otherwise unused) git repo, since `context: 'repo'`
// commands validate `repoPath` before the command's own flag parsing
// ever runs (see `Dispatcher#run`).
describe('auto-monitor-pr-monitor-pr parity (shell vs. native) — usage error', () => {
  it('matches shell exit code and stderr when --pr-number is missing', async () => {
    const shellRepo = await createGitFixtureRepo();
    const nativeRepo = await createGitFixtureRepo();

    try {
      const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, '--issue-id', '5'], shellRepo.repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'auto-monitor-pr-monitor-pr', nativeRepo.repoPath, '--issue-id', '5'],
        nativeRepo.repoPath
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain(USAGE_TAIL);
      expect(native.stderr.trim()).toContain(USAGE);
    } finally {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
    }
  });

  it('matches shell exit code and stderr on an unrecognized flag', async () => {
    const shellRepo = await createGitFixtureRepo();
    const nativeRepo = await createGitFixtureRepo();

    try {
      const shell = await runCommand([SHELL_SCRIPT, shellRepo.repoPath, '--bogus', 'x'], shellRepo.repoPath);
      const native = await runCommand(
        [process.execPath, NATIVE_BIN, 'auto-monitor-pr-monitor-pr', nativeRepo.repoPath, '--bogus', 'x'],
        nativeRepo.repoPath
      );

      expect(native.stdout).toEqual(shell.stdout);
      expect(native.code).toEqual(shell.code);
      expect(shell.code).toEqual(1);
      expect(shell.stdout).toEqual('');
      expect(shell.stderr.trim()).toContain(USAGE_TAIL);
      expect(native.stderr.trim()).toContain(USAGE);
    } finally {
      await Promise.all([shellRepo.cleanup(), nativeRepo.cleanup()]);
    }
  });
});

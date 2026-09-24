import path from 'node:path';
import { setupParityTest } from '../../support/factories/githubParitySetup.js';
import {
  readOptional, runNativeMonitor, runShellMonitor, stripTimestamps, writeJson
} from '../../support/factories/monitorIssuesParitySetup.js';
import { seedEngineMode } from '../../support/utils/engineMode.js';
import { git } from '../../support/utils/runCommand.js';

// Parity test for the "monitor-issues-monitor-issues" migrated
// entrypoint (issue #586): runs one poll cycle of
// monitor-issues/scripts/monitor_issues_shell.sh (fake `gh issue list`,
// sub-dispatches forced to `engine.mode=shell`) and of `core/bin/arcanum
// monitor-issues-monitor-issues` (fake `fetch`) against equivalent
// inputs, SIGTERMs both once the cycle's last issue is handled, and
// compares the timestamp-stripped logs plus every file the cycle writes.
const STATE = path.join('.claude', 'state');
const ISSUES = [
  { number: 7, title: 'Seven', updatedAt: '2026-01-02T00:00:00Z', labels: ['Question', 'Created', 'Ready for Work'] },
  { number: 8, title: 'Eight', updatedAt: '2026-01-02T00:00:00Z', labels: ['Bug'] },
  { number: 9, title: 'Nine', updatedAt: '2026-01-02T00:00:00Z', labels: ['Created'] }
];
const FILES = [
  'issue-7.json',
  'issue-8.json',
  'issue-9.json',
  'auto-fix-all-queue.json',
  'monitor-issues-rewrite-queue.json'
].map((name) => path.join(STATE, name));

/**
 * @param {string} stdout - the captured log so far.
 * @returns {boolean} whether every returned issue has been handled.
 */
function cycleDone(stdout) {
  return ['#7', '#8', '#9'].every((id) => new RegExp(`(Processed ${id} |Skipping ${id} |Skipping updated_at write for ${id} )`).test(stdout));
}

/**
 * @param {string|null} content - a state file's content.
 * @returns {string|null} the content with ISO timestamps masked.
 */
function maskTimestamps(content) {
  return content && content.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/g, '<ts>');
}

describe('monitor-issues-monitor-issues parity (shell vs. native)', () => {
  it('matches the log and written files for one poll cycle', async () => {
    const ctx = await setupParityTest({
      ghVars: {
        FAKE_GH_ISSUE_LIST_JSON: JSON.stringify(
          ISSUES.map(({ labels, ...rest }) => ({ ...rest, labels: labels.map((name) => ({ name })) }))
        ),
        FAKE_GH_ISSUE_LABELS: 'Created\nReady for Work'
      },
      fetchVars: {
        FAKE_FETCH_SEARCH_ITEMS_JSON: JSON.stringify(ISSUES.map(({ updatedAt, labels, ...rest }) => ({
          ...rest, updated_at: updatedAt, labels: labels.map((name) => ({ name }))
        }))),
        FAKE_FETCH_ISSUE_LABELS: 'Created\nReady for Work'
      }
    });
    const nativeEnv = { ...ctx.nativeEnv, ARCANUM_TEST_FAKE_FETCH: 'monitor-issues' };

    try {
      for (const repo of [ctx.shellRepo, ctx.nativeRepo]) {
        await seedEngineMode(repo, 'shell');
        await git(['config', 'user.ghuser', 'fixture-user'], repo.repoPath);
        await writeJson(repo.repoPath, path.join(STATE, 'issue-9.json'), { updated_at: '2027-01-01T00:00:00Z' });
      }

      const shell = await runShellMonitor(ctx.shellRepo.repoPath, ctx.shellEnv, cycleDone);
      const native = await runNativeMonitor(ctx.nativeRepo.repoPath, nativeEnv, cycleDone);

      expect(shell.timedOut).toBeFalse();
      expect(native.timedOut).toBeFalse();
      expect(stripTimestamps(native.stdout)).toEqual(stripTimestamps(shell.stdout));
      expect(shell.stdout).toContain('Processed #7 — updated_at recorded');

      for (const file of FILES) {
        const shellContent = await readOptional(ctx.shellRepo.repoPath, file);
        const nativeContent = await readOptional(ctx.nativeRepo.repoPath, file);

        expect(maskTimestamps(nativeContent)).withContext(file).toEqual(maskTimestamps(shellContent));
      }

      const cursor = path.join(STATE, 'issue-monitor-last-checked.txt');

      expect(await readOptional(ctx.nativeRepo.repoPath, cursor)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n$/);
      expect(await readOptional(ctx.shellRepo.repoPath, cursor)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\n$/);
    } finally {
      await ctx.cleanup();
    }
  }, 90000);
});

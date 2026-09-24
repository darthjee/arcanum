import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { createMonitor, logLine } from '../../../support/factories/monitorIssuesMonitorIssues.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('MonitorIssuesMonitorIssues (dispatch)', () => {
  let dir;

  beforeEach(async () => {
    dir = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  function issue(number, labels, updatedAt = '2026-01-02T00:00:00Z') {
    return { number, title: `Issue ${number}`, updatedAt, labels: labels.map((name) => ({ name })) };
  }

  it('skips an issue that is not newer than its stored updated_at', async () => {
    const { monitor, stdout, issueStateService, rewriteQueue } = createMonitor(dir, {
      issues: [issue(5, ['Created'], '2026-01-01T00:00:00Z')],
      stored: { 5: '2026-01-01T00:00:00Z' }
    });

    await monitor.run();

    expect(stdout()).toContain(
      logLine('Skipping #5 — not newer (gh=2026-01-01T00:00:00Z stored=2026-01-01T00:00:00Z)')
    );
    expect(rewriteQueue.push).not.toHaveBeenCalled();
    expect(issueStateService.set).not.toHaveBeenCalled();
  });

  it('records updated_at and tags for an issue with no actionable tag', async () => {
    const { monitor, stdout, issueStateService } = createMonitor(dir, { issues: [issue(5, ['Bug'])] });

    await monitor.run();

    expect(stdout()).toContain(logLine('Processing #5 — tags: []'));
    expect(issueStateService.set).toHaveBeenCalledWith('5', 'updated_at', '2026-01-02T03:04:05Z');
    expect(issueStateService.setJson).toHaveBeenCalledWith('5', 'tags', '[]');
    expect(stdout()).toContain(logLine('Processed #5 — updated_at recorded'));
  });

  it('dispatches question (log only), created and ready_for_work, in that order', async () => {
    const { monitor, stdout, rewriteQueue, autoFixQueue, issueStateService } = createMonitor(dir, {
      issues: [issue(7, ['Ready for Work', 'Created', 'Question'])]
    });

    await monitor.run();

    const output = stdout();

    expect(output).toContain(logLine('Processing #7 — tags: [\n  "ready_for_work",\n  "created",\n  "question"\n]'));
    expect(output).toContain(logLine('Issue #7 has actionable tag \'question\' — needs an answer from the agent'));
    expect(output).toContain(
      `${logLine('Issue #7 has actionable tag \'created\' — pushing to rewrite queue')}Pushed: 7\n`
    );
    expect(output).toContain(logLine('Issue #7 has actionable tag \'ready_for_work\' — pushing to auto-fix-all queue'));
    expect(output.indexOf('\'question\'')).toBeLessThan(output.indexOf('\'created\''));
    expect(output.indexOf('\'created\'')).toBeLessThan(output.indexOf('\'ready_for_work\''));
    expect(rewriteQueue.push).toHaveBeenCalledWith('7');
    expect(autoFixQueue.push).toHaveBeenCalledWith('7');
    expect(issueStateService.setJson).toHaveBeenCalledWith(
      '7', 'tags', JSON.stringify(['ready_for_work', 'created', 'question'], null, 2)
    );
  });

  it('does not record updated_at when the rewrite-queue push fails, but still runs the other dispatches', async () => {
    const { monitor, stdout, stderr, rewriteQueue, autoFixQueue, issueStateService } = createMonitor(dir, {
      issues: [issue(8, ['Created', 'Ready for Work'])]
    });

    rewriteQueue.push.and.rejectWith(new Error('Error: boom'));

    await monitor.run();

    expect(stderr()).toEqual('Error: boom\n');
    expect(stdout()).toContain(logLine('ERROR: failed to push #8 to the rewrite queue'));
    expect(autoFixQueue.push).toHaveBeenCalledWith('8');
    expect(issueStateService.set).not.toHaveBeenCalled();
    expect(stdout()).toContain(
      logLine('Skipping updated_at write for #8 — a dispatched action failed; will retry next poll')
    );
  });

  it('does not record updated_at when the auto-fix-all push fails with a DispatchFailure', async () => {
    const { monitor, stdout, autoFixQueue, issueStateService } = createMonitor(dir, {
      issues: [issue(9, ['Ready for Work'])]
    });

    autoFixQueue.push.and.rejectWith(new DispatchFailure('partial\n', 1));

    await monitor.run();

    expect(stdout()).toContain(`partial\n${logLine('ERROR: failed to push #9 to the queue')}`);
    expect(issueStateService.set).not.toHaveBeenCalled();
    expect(issueStateService.setJson).not.toHaveBeenCalled();
  });

  it('processes every returned issue independently', async () => {
    const { monitor, issueStateService } = createMonitor(dir, {
      issues: [issue(1, []), issue(2, ['Created'], '2026-01-01T00:00:00Z'), issue(3, [])],
      stored: { 2: '2026-01-01T00:00:00Z' }
    });

    await monitor.run();

    expect(issueStateService.set.calls.allArgs().map(([id]) => id)).toEqual(['1', '3']);
  });
});

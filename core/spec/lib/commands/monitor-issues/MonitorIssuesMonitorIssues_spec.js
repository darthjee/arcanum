import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MonitorIssuesMonitorIssues from '../../../../lib/commands/monitor-issues/MonitorIssuesMonitorIssues.js';
import { createMonitor, logLine, REPO_REF } from '../../../support/factories/monitorIssuesMonitorIssues.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('MonitorIssuesMonitorIssues (loop)', () => {
  let dir;
  let cursorFile;
  let lockFile;

  beforeEach(async () => {
    dir = await createTempDir();
    cursorFile = path.join(dir, '.claude', 'state', 'issue-monitor-last-checked.txt');
    lockFile = path.join(dir, '.claude', 'state', 'issue-monitor.lock');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#run', () => {
    it('logs the start line with the repo ref and the <default> user', async () => {
      const { monitor, stdout } = createMonitor(dir);

      await monitor.run();

      expect(stdout()).toMatch(/^\[2026-01-02T03:04:05Z\] Starting issue monitor for repo=darthjee\/arcanum user=<default>\n/);
    });

    it('logs the configured ghuser and restricts the search to that author', async () => {
      const { monitor, stdout, issueClient } = createMonitor(dir, { ghUser: 'darthjee' });

      await monitor.run();

      expect(stdout()).toContain(logLine(`Starting issue monitor for repo=${REPO_REF} user=darthjee`));
      expect(issueClient.searchOpenIssuesUpdatedSince).toHaveBeenCalledWith(
        '1970-01-01T00:00:00Z', { author: 'darthjee' }
      );
    });

    it('sleeps the poll interval after each cycle', async () => {
      const { monitor, sleepFn } = createMonitor(dir, { maxCycles: 3, pollIntervalMs: 42 });

      await monitor.run();

      expect(sleepFn).toHaveBeenCalledTimes(3);
      expect(sleepFn).toHaveBeenCalledWith(42);
    });

    it('logs a failed search and the cycle error, then keeps looping', async () => {
      const { monitor, stdout, sleepFn } = createMonitor(dir, {
        issues: new Error('Error: could not search issues in darthjee/arcanum'),
        maxCycles: 2
      });

      await monitor.run();

      expect(stdout()).toContain(logLine('ERROR: gh issue list failed: Error: could not search issues in darthjee/arcanum'));
      expect(stdout().split(logLine('ERROR in poll cycle — retrying after sleep')).length).toEqual(3);
      expect(sleepFn).toHaveBeenCalledTimes(2);
    });

    it('removes the lock file when the run finishes', async () => {
      await mkdir(path.dirname(lockFile), { recursive: true });
      await writeFile(lockFile, 'x');

      const { monitor } = createMonitor(dir);

      await monitor.run();

      await expectAsync(access(lockFile)).toBeRejected();
    });
  });

  describe('cursor', () => {
    it('polls since the epoch when the cursor file is absent, then writes now - 1s', async () => {
      const { monitor, stdout, issueClient } = createMonitor(dir);

      await monitor.run();

      expect(issueClient.searchOpenIssuesUpdatedSince).toHaveBeenCalledWith('1970-01-01T00:00:00Z', { author: '' });
      expect(stdout()).toContain(logLine('Polling issues updated since 1970-01-01T00:00:00Z ...'));
      expect(await readFile(cursorFile, 'utf8')).toEqual('2026-01-02T03:04:04Z\n');
    });

    it('polls since the stored cursor', async () => {
      await mkdir(path.dirname(cursorFile), { recursive: true });
      await writeFile(cursorFile, '2025-12-31T00:00:00Z\n');

      const { monitor, issueClient } = createMonitor(dir);

      await monitor.run();

      expect(issueClient.searchOpenIssuesUpdatedSince).toHaveBeenCalledWith('2025-12-31T00:00:00Z', { author: '' });
    });

    it('treats an empty cursor file as the epoch', async () => {
      await mkdir(path.dirname(cursorFile), { recursive: true });
      await writeFile(cursorFile, '');

      const { monitor, issueClient } = createMonitor(dir);

      await monitor.run();

      expect(issueClient.searchOpenIssuesUpdatedSince).toHaveBeenCalledWith('1970-01-01T00:00:00Z', { author: '' });
    });

    it('logs the number of issues returned', async () => {
      const { monitor, stdout } = createMonitor(dir);

      await monitor.run();

      expect(stdout()).toContain(logLine('Got 0 issue(s) from GitHub.'));
    });
  });

  describe('signals', () => {
    it('removes its SIGINT/SIGTERM listeners once the run finishes', async () => {
      const { monitor, processRef } = createMonitor(dir);

      await monitor.run();

      expect(processRef.listenerCount('SIGINT')).toEqual(0);
      expect(processRef.listenerCount('SIGTERM')).toEqual(0);
    });

    for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
      it(`releases the lock and exits ${code} on ${signal}`, async () => {
        await mkdir(path.dirname(lockFile), { recursive: true });
        await writeFile(lockFile, 'x');

        let emitted;
        const context = {};

        context.sleepFn = jasmine.createSpy('sleep').and.callFake(() => {
          emitted = new Promise((resolve) => {
            context.exitFn.and.callFake(resolve);
          });
          context.processRef.emit(signal);

          return emitted;
        });
        context.exitFn = jasmine.createSpy('exit');

        const built = createMonitor(dir, { sleepFn: context.sleepFn, exitFn: context.exitFn });

        context.processRef = built.processRef;

        await built.monitor.run();

        expect(context.exitFn).toHaveBeenCalledWith(code);
        await expectAsync(access(lockFile)).toBeRejected();
      });
    }
  });

  describe('default collaborators', () => {
    it('constructs without injected dependencies', () => {
      expect(new MonitorIssuesMonitorIssues({ repoPath: dir })).toBeInstanceOf(MonitorIssuesMonitorIssues);
    });
  });
});

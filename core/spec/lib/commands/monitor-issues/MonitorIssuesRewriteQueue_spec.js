import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MonitorIssuesRewriteQueue from '../../../../lib/commands/monitor-issues/MonitorIssuesRewriteQueue.js';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createRepoContextMock } from '../../../support/factories/repoContextFactory.js';
import { captureRejection } from '../../../support/utils/captureRejection.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('MonitorIssuesRewriteQueue', () => {
  let dir;
  let queueFile;
  let lockFile;
  let lock;
  let queue;

  beforeEach(async () => {
    dir = await createTempDir();
    queueFile = path.join(dir, '.claude', 'state', 'monitor-issues-rewrite-queue.json');
    lockFile = path.join(dir, '.claude', 'state', 'monitor-issues-rewrite-queue.lock');
    lock = new Lock({ sleepMs: 5 });
    queue = new MonitorIssuesRewriteQueue(createRepoContextMock({ repoPath: dir }), { lock });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  async function writeQueue(entries) {
    await mkdir(path.dirname(queueFile), { recursive: true });
    await writeFile(queueFile, JSON.stringify(entries));
  }

  async function readQueue() {
    return JSON.parse(await readFile(queueFile, 'utf8'));
  }

  describe('#push', () => {
    it('creates the queue and returns the confirmation line', async () => {
      await expectAsync(queue.push('5')).toBeResolvedTo('Pushed: 5\n');
      expect(await readQueue()).toEqual([{ id: '5' }]);
    });

    it('appends to an existing queue', async () => {
      await writeQueue([{ id: '1' }]);

      await queue.push('5');

      expect(await readQueue()).toEqual([{ id: '1' }, { id: '5' }]);
    });

    it('is idempotent for an id already present', async () => {
      await writeQueue([{ id: '5' }, { id: '6' }]);

      await expectAsync(queue.push('5')).toBeResolvedTo('Pushed: 5\n');
      expect(await readQueue()).toEqual([{ id: '5' }, { id: '6' }]);
    });

    it('guards the mutation with the rewrite-queue lock', async () => {
      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      await queue.push('5');

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('rejects when the id is missing or empty', async () => {
      await expectAsync(queue.push()).toBeRejectedWithError('Error: push requires an ID');
      await expectAsync(queue.push('')).toBeRejectedWithError('Error: push requires an ID');
    });
  });

  describe('#pop', () => {
    it('removes and returns the first id', async () => {
      await writeQueue([{ id: '5' }, { id: '6' }]);

      await expectAsync(queue.pop()).toBeResolvedTo('5\n');
      expect(await readQueue()).toEqual([{ id: '6' }]);
    });

    it('rejects with DispatchFailure("", 1) on an empty or absent queue, releasing the lock', async () => {
      spyOn(lock, 'release').and.callThrough();

      const thrown = await captureRejection(queue.pop());

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
      expect(lock.release).toHaveBeenCalledWith(lockFile);

      await writeQueue([]);
      await expectAsync(queue.pop()).toBeRejectedWith(jasmine.any(DispatchFailure));
    });
  });
});

import path from 'node:path';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { createAutoFixAllQueue, writeQueueFile, readQueueFile } from '../../../support/factories/autoFixAllQueue.js';

describe('AutoFixAllQueue (reads)', () => {
  let dir;
  let queueFile;

  beforeEach(async () => {
    dir = await createTempDir();
    queueFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.json');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#next', () => {
    it('returns the first id without removing it', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }, { id: 'b' }]);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.next()).toBeResolvedTo('a\n');
      expect(await readQueueFile(queueFile)).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('returns an empty id when the queue is empty', async () => {
      await writeQueueFile(queueFile, []);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.next()).toBeResolvedTo('\n');
    });

    it('returns an empty id when the queue file is absent', async () => {
      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.next()).toBeResolvedTo('\n');
    });
  });

  describe('#waitNext', () => {
    it('resolves immediately when the queue is already non-empty', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }]);

      const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
      const queue = createAutoFixAllQueue(dir, { sleepFn });

      await expectAsync(queue.waitNext()).toBeResolvedTo('a\n');
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('polls until an item appears, then resolves with it', async () => {
      await writeQueueFile(queueFile, []);

      let pollCount = 0;
      const sleepFn = jasmine.createSpy('sleep').and.callFake(async () => {
        pollCount += 1;

        if (pollCount === 2) {
          await writeQueueFile(queueFile, [{ id: 'late' }]);
        }
      });
      const queue = createAutoFixAllQueue(dir, { pollIntervalMs: 7, sleepFn });

      await expectAsync(queue.waitNext()).toBeResolvedTo('late\n');
      expect(sleepFn).toHaveBeenCalledTimes(2);
      expect(sleepFn).toHaveBeenCalledWith(7);
    });
  });

  describe('#list', () => {
    it('prints each id on its own line for a non-empty queue', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.list()).toBeResolvedTo('a\nb\nc\n');
    });

    it('prints "(empty)" for a zero-length queue', async () => {
      await writeQueueFile(queueFile, []);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.list()).toBeResolvedTo('(empty)\n');
    });

    it('prints "(empty)" when the queue file is absent', async () => {
      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.list()).toBeResolvedTo('(empty)\n');
    });
  });
});

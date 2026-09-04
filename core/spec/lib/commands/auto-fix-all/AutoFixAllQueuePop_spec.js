import path from 'node:path';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { createAutoFixAllQueue, writeQueueFile, readQueueFile } from '../../../support/factories/autoFixAllQueue.js';

describe('AutoFixAllQueue (pop & empty)', () => {
  let dir;
  let queueFile;
  let lockFile;

  beforeEach(async () => {
    dir = await createTempDir();
    queueFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.json');
    lockFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.lock');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#pop', () => {
    it('removes the first entry, leaving the rest', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.pop()).toBeResolvedTo(undefined);
      expect(await readQueueFile(queueFile)).toEqual([{ id: 'b' }, { id: 'c' }]);
    });

    it('produces no stdout (resolves undefined)', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }]);

      const queue = createAutoFixAllQueue(dir);

      const result = await queue.pop();

      expect(result).toBeUndefined();
    });

    it('acquires and releases the lock file around the mutation', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }]);

      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const queue = createAutoFixAllQueue(dir, { lock });

      await queue.pop();

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });
  });

  describe('#empty', () => {
    it('resolves for a zero-length queue', async () => {
      await writeQueueFile(queueFile, []);

      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.empty()).toBeResolved();
    });

    it('resolves when the queue file is absent', async () => {
      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.empty()).toBeResolved();
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1) for a non-empty queue', async () => {
      await writeQueueFile(queueFile, [{ id: 'a' }]);

      const queue = createAutoFixAllQueue(dir);
      let thrown;

      try {
        await queue.empty();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });
});

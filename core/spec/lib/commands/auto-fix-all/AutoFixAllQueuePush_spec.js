import path from 'node:path';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import Lock from '../../../../lib/utils/file/Lock.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';
import { fakeFetch } from '../../../support/utils/fakeFetch.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { createAutoFixAllQueue, writeQueueFile, readQueueFile } from '../../../support/factories/autoFixAllQueue.js';

describe('AutoFixAllQueue (push)', () => {
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

  describe('#push', () => {
    it('appends the given ids to an existing queue and prints the confirmation line', async () => {
      await writeQueueFile(queueFile, [{ id: 'existing' }]);

      const queue = createAutoFixAllQueue(dir);

      const { stdout } = await captureStdout(() => queue.push('1', '2'));

      expect(stdout.split('\n')[0]).toEqual('Pushed: 1 2');
      expect(await readQueueFile(queueFile)).toEqual([{ id: 'existing' }, { id: '1' }, { id: '2' }]);
    });

    it('rejects with a plain Error when no ids are given', async () => {
      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.push()).toBeRejectedWithError('Error: push requires at least one ID');
    });

    it('acquires and releases the lock file around the mutation', async () => {
      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const queue = createAutoFixAllQueue(dir, { lock });

      await captureStdout(() => queue.push('1'));

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('best-effort attempts the label mutation for every given id', async () => {
      const fetchFn = fakeFetch();
      const queue = createAutoFixAllQueue(dir, { fetchFn });

      await captureStdout(() => queue.push('30'));

      expect(fetchFn).toHaveBeenCalled();
    });

    it('warns to stderr, and prints only the confirmation line to stdout, when a label mutation fails', async () => {
      spyOn(process.stderr, 'write');

      const queue = createAutoFixAllQueue(dir, { fetchFn: fakeFetch({ mutateFails: true }) });

      const { stdout } = await captureStdout(() => queue.push('10'));

      expect(stdout).toEqual('Pushed: 10\n');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1), after printing the confirmation line, when resolving the origin/token itself fails', async () => {
      const queue = createAutoFixAllQueue(dir, { origin: { resolveWithRef: async () => { throw new Error('no origin'); } } });
      let thrown;

      const { stdout } = await captureStdout(async () => {
        try {
          await queue.push('10');
        } catch (error) {
          thrown = error;
        }
      });

      expect(stdout).toEqual('Pushed: 10\n');
      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('lock contention', () => {
    it('serializes concurrent push calls through the shared lock so no ids are lost', async () => {
      const lock = new Lock({ sleepMs: 5 });
      const first = createAutoFixAllQueue(dir, { lock });
      const second = createAutoFixAllQueue(dir, { lock });

      await captureStdout(() => Promise.all([first.push('a', 'b'), second.push('c', 'd')]));

      const ids = (await readQueueFile(queueFile)).map((entry) => entry.id).sort();

      expect(ids).toEqual(['a', 'b', 'c', 'd']);
    });

    it('serializes an overlapping push and pop through the shared lock without corrupting the queue', async () => {
      await writeQueueFile(queueFile, [{ id: 'current' }]);

      const lock = new Lock({ sleepMs: 5 });
      const pusher = createAutoFixAllQueue(dir, { lock });
      const popper = createAutoFixAllQueue(dir, { lock });

      await captureStdout(() => Promise.all([pusher.push('next'), popper.pop()]));

      const ids = (await readQueueFile(queueFile)).map((entry) => entry.id);

      expect(ids.length).toEqual(1);
      expect(ids).toContain('next');
    });
  });
});

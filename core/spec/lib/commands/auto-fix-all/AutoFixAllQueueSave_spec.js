import path from 'node:path';
import DispatchFailure from '../../../../lib/utils/errors/DispatchFailure.js';
import { captureStdout } from '../../../support/utils/captureStdout.js';
import { fakeFetch } from '../../../support/utils/fakeFetch.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';
import { createAutoFixAllQueue, writeQueueFile, readQueueFile } from '../../../support/factories/autoFixAllQueue.js';

describe('AutoFixAllQueue (save)', () => {
  let dir;
  let queueFile;

  beforeEach(async () => {
    dir = await createTempDir();
    queueFile = path.join(dir, '.claude', 'state', 'auto-fix-all-queue.json');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#save', () => {
    it('overwrites the queue with the exact given ids and prints the confirmation line', async () => {
      await writeQueueFile(queueFile, [{ id: 'old' }]);

      const queue = createAutoFixAllQueue(dir);

      const { stdout } = await captureStdout(() => queue.save('1', '2', '3'));

      expect(stdout.split('\n')[0]).toEqual('Queue saved: 1 2 3');
      expect(await readQueueFile(queueFile)).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });

    it('rejects with a plain Error when no ids are given', async () => {
      const queue = createAutoFixAllQueue(dir);

      await expectAsync(queue.save()).toBeRejectedWithError('Error: save requires at least one ID');
    });

    it('best-effort attempts the label mutation for every given id', async () => {
      const fetchFn = fakeFetch();
      const queue = createAutoFixAllQueue(dir, { fetchFn });

      await captureStdout(() => queue.save('10', '20'));

      // 3 GET calls per id (enqueued/ready_for_work/created), 1 POST
      // (add enqueued, not yet present) and 2 DELETE (remove
      // ready_for_work/created, both present) per id.
      const urls = fetchFn.calls.allArgs().map(([url]) => url);

      expect(urls.filter((url) => url === 'https://api.github.com/repos/darthjee/arcanum/issues/10').length).toEqual(3);
      expect(urls.filter((url) => url === 'https://api.github.com/repos/darthjee/arcanum/issues/20').length).toEqual(3);

      const methods = fetchFn.calls.allArgs().map(([, options]) => options.method);

      expect(methods.filter((method) => method === 'POST').length).toEqual(2);
      expect(methods.filter((method) => method === 'DELETE').length).toEqual(4);
    });

    it('warns to stderr, and prints only the confirmation line to stdout, when a label mutation fails', async () => {
      spyOn(process.stderr, 'write');

      const queue = createAutoFixAllQueue(dir, { fetchFn: fakeFetch({ getFails: true }) });

      const { stdout } = await captureStdout(() => queue.save('10'));

      expect(stdout).toEqual('Queue saved: 10\n');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'ready_for_work\' tag from issue #10 on darthjee/arcanum\n'
      );
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not remove \'created\' tag from issue #10 on darthjee/arcanum\n'
      );
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1), after printing the confirmation line, when resolving the origin/token itself fails', async () => {
      const queue = createAutoFixAllQueue(dir, { origin: { resolveWithRef: async () => { throw new Error('no origin'); } } });
      let thrown;

      const { stdout } = await captureStdout(async () => {
        try {
          await queue.save('10');
        } catch (error) {
          thrown = error;
        }
      });

      expect(stdout).toEqual('Queue saved: 10\n');
      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });
});

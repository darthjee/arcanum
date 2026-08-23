import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AutoFixAllQueue from '../../lib/AutoFixAllQueue.js';
import DispatchFailure from '../../lib/DispatchFailure.js';
import Lock from '../../lib/Lock.js';
import { createTempDir, removeTempDir } from '../support/utils/tempDir.js';

const REPO = 'darthjee/arcanum';
const TOKEN = 'fake-token';

/**
 * Build a fake `fetch` implementation answering the 3 REST calls
 * `AutoFixAllQueue`'s best-effort label mutation makes per tag: `GET
 * .../issues/<id>` (current labels), `POST .../issues/<id>/labels`
 * (add), `DELETE .../issues/<id>/labels/<label>` (remove).
 * @param {object} [opts] - behavior overrides.
 * @param {string[]} [opts.existingLabels] - the labels every issue
 *   fetch reports as already present.
 * @param {boolean} [opts.getFails] - whether the labels GET fails.
 * @param {boolean} [opts.mutateFails] - whether every POST/DELETE fails.
 * @returns {Function} a jasmine spy usable as `fetchFn`.
 */
function fakeFetch({ existingLabels = ['Ready for Work', 'Created'], getFails = false, mutateFails = false } = {}) {
  return jasmine.createSpy('fetch').and.callFake(async (url, options = {}) => {
    if (options.method === undefined) {
      if (getFails) {
        return { ok: false };
      }

      return { ok: true, json: async () => ({ labels: existingLabels.map((name) => ({ name })) }) };
    }

    if (options.method === 'POST' || options.method === 'DELETE') {
      return { ok: !mutateFails };
    }

    throw new Error(`unexpected fetch call: ${url} ${JSON.stringify(options)}`);
  });
}

describe('AutoFixAllQueue', () => {
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

  async function writeQueueFile(entries) {
    await mkdir(path.dirname(queueFile), { recursive: true });
    await writeFile(queueFile, JSON.stringify(entries));
  }

  async function readQueueFile() {
    return JSON.parse(await readFile(queueFile, 'utf8'));
  }

  function newQueue(overrides = {}) {
    return new AutoFixAllQueue({
      lock: new Lock({ sleepMs: 5 }),
      origin: { resolve: async () => ({ domain: 'github.com', repo: REPO }) },
      githubToken: { get: async () => TOKEN },
      fetchFn: fakeFetch(),
      pollIntervalMs: 5,
      sleepFn: async () => {},
      ...overrides
    });
  }

  /**
   * `save`/`push` write directly to `process.stdout` (see
   * AutoFixAllQueue.js#save's doc comment) rather than returning a
   * string — capture everything written to `process.stdout` for the
   * duration of `fn`, so specs can assert on it the same way parity
   * specs assert on a subprocess's captured stdout.
   * @param {Function} fn - a zero-argument function (sync or async)
   *   to run while `process.stdout.write` is captured.
   * @returns {Promise<{result: *, stdout: string}>} `fn`'s own resolved
   *   value, plus everything written to `process.stdout` meanwhile.
   */
  async function captureStdout(fn) {
    const chunks = [];
    const spy = spyOn(process.stdout, 'write').and.callFake((chunk) => {
      chunks.push(chunk);

      return true;
    });

    const result = await fn();

    spy.and.callThrough();

    return { result, stdout: chunks.join('') };
  }

  describe('#save', () => {
    it('overwrites the queue with the exact given ids and prints the confirmation line', async () => {
      await writeQueueFile([{ id: 'old' }]);

      const queue = newQueue();

      const { stdout } = await captureStdout(() => queue.save(dir, '1', '2', '3'));

      expect(stdout.split('\n')[0]).toEqual('Queue saved: 1 2 3');
      expect(await readQueueFile()).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }]);
    });

    it('rejects with a plain Error when no ids are given', async () => {
      const queue = newQueue();

      await expectAsync(queue.save(dir)).toBeRejectedWithError('Error: save requires at least one ID');
    });

    it('best-effort attempts the label mutation for every given id', async () => {
      const fetchFn = fakeFetch();
      const queue = newQueue({ fetchFn });

      await captureStdout(() => queue.save(dir, '10', '20'));

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

      const queue = newQueue({ fetchFn: fakeFetch({ getFails: true }) });

      const { stdout } = await captureStdout(() => queue.save(dir, '10'));

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
      const queue = newQueue({ origin: { resolve: async () => { throw new Error('no origin'); } } });
      let thrown;

      const { stdout } = await captureStdout(async () => {
        try {
          await queue.save(dir, '10');
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

  describe('#next', () => {
    it('returns the first id without removing it', async () => {
      await writeQueueFile([{ id: 'a' }, { id: 'b' }]);

      const queue = newQueue();

      await expectAsync(queue.next(dir)).toBeResolvedTo('a\n');
      expect(await readQueueFile()).toEqual([{ id: 'a' }, { id: 'b' }]);
    });

    it('returns an empty id when the queue is empty', async () => {
      await writeQueueFile([]);

      const queue = newQueue();

      await expectAsync(queue.next(dir)).toBeResolvedTo('\n');
    });

    it('returns an empty id when the queue file is absent', async () => {
      const queue = newQueue();

      await expectAsync(queue.next(dir)).toBeResolvedTo('\n');
    });
  });

  describe('#waitNext', () => {
    it('resolves immediately when the queue is already non-empty', async () => {
      await writeQueueFile([{ id: 'a' }]);

      const sleepFn = jasmine.createSpy('sleep').and.resolveTo(undefined);
      const queue = newQueue({ sleepFn });

      await expectAsync(queue.waitNext(dir)).toBeResolvedTo('a\n');
      expect(sleepFn).not.toHaveBeenCalled();
    });

    it('polls until an item appears, then resolves with it', async () => {
      await writeQueueFile([]);

      let pollCount = 0;
      const sleepFn = jasmine.createSpy('sleep').and.callFake(async () => {
        pollCount += 1;

        if (pollCount === 2) {
          await writeQueueFile([{ id: 'late' }]);
        }
      });
      const queue = newQueue({ pollIntervalMs: 7, sleepFn });

      await expectAsync(queue.waitNext(dir)).toBeResolvedTo('late\n');
      expect(sleepFn).toHaveBeenCalledTimes(2);
      expect(sleepFn).toHaveBeenCalledWith(7);
    });
  });

  describe('#push', () => {
    it('appends the given ids to an existing queue and prints the confirmation line', async () => {
      await writeQueueFile([{ id: 'existing' }]);

      const queue = newQueue();

      const { stdout } = await captureStdout(() => queue.push(dir, '1', '2'));

      expect(stdout.split('\n')[0]).toEqual('Pushed: 1 2');
      expect(await readQueueFile()).toEqual([{ id: 'existing' }, { id: '1' }, { id: '2' }]);
    });

    it('rejects with a plain Error when no ids are given', async () => {
      const queue = newQueue();

      await expectAsync(queue.push(dir)).toBeRejectedWithError('Error: push requires at least one ID');
    });

    it('acquires and releases the lock file around the mutation', async () => {
      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const queue = newQueue({ lock });

      await captureStdout(() => queue.push(dir, '1'));

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });

    it('best-effort attempts the label mutation for every given id', async () => {
      const fetchFn = fakeFetch();
      const queue = newQueue({ fetchFn });

      await captureStdout(() => queue.push(dir, '30'));

      expect(fetchFn).toHaveBeenCalled();
    });

    it('warns to stderr, and prints only the confirmation line to stdout, when a label mutation fails', async () => {
      spyOn(process.stderr, 'write');

      const queue = newQueue({ fetchFn: fakeFetch({ mutateFails: true }) });

      const { stdout } = await captureStdout(() => queue.push(dir, '10'));

      expect(stdout).toEqual('Pushed: 10\n');
      expect(process.stderr.write).toHaveBeenCalledWith(
        'Warning: could not add \'enqueued\' tag to issue #10 on darthjee/arcanum\n'
      );
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1), after printing the confirmation line, when resolving the origin/token itself fails', async () => {
      const queue = newQueue({ origin: { resolve: async () => { throw new Error('no origin'); } } });
      let thrown;

      const { stdout } = await captureStdout(async () => {
        try {
          await queue.push(dir, '10');
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

  describe('#pop', () => {
    it('removes the first entry, leaving the rest', async () => {
      await writeQueueFile([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      const queue = newQueue();

      await expectAsync(queue.pop(dir)).toBeResolvedTo(undefined);
      expect(await readQueueFile()).toEqual([{ id: 'b' }, { id: 'c' }]);
    });

    it('produces no stdout (resolves undefined)', async () => {
      await writeQueueFile([{ id: 'a' }]);

      const queue = newQueue();

      const result = await queue.pop(dir);

      expect(result).toBeUndefined();
    });

    it('acquires and releases the lock file around the mutation', async () => {
      await writeQueueFile([{ id: 'a' }]);

      const lock = new Lock({ sleepMs: 5 });

      spyOn(lock, 'acquire').and.callThrough();
      spyOn(lock, 'release').and.callThrough();

      const queue = newQueue({ lock });

      await queue.pop(dir);

      expect(lock.acquire).toHaveBeenCalledWith(lockFile);
      expect(lock.release).toHaveBeenCalledWith(lockFile);
    });
  });

  describe('#empty', () => {
    it('resolves for a zero-length queue', async () => {
      await writeQueueFile([]);

      const queue = newQueue();

      await expectAsync(queue.empty(dir)).toBeResolved();
    });

    it('resolves when the queue file is absent', async () => {
      const queue = newQueue();

      await expectAsync(queue.empty(dir)).toBeResolved();
    });

    it('rejects with a DispatchFailure (stdout "", exit code 1) for a non-empty queue', async () => {
      await writeQueueFile([{ id: 'a' }]);

      const queue = newQueue();
      let thrown;

      try {
        await queue.empty(dir);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(DispatchFailure);
      expect(thrown.stdout).toEqual('');
      expect(thrown.exitCode).toEqual(1);
    });
  });

  describe('#list', () => {
    it('prints each id on its own line for a non-empty queue', async () => {
      await writeQueueFile([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

      const queue = newQueue();

      await expectAsync(queue.list(dir)).toBeResolvedTo('a\nb\nc\n');
    });

    it('prints "(empty)" for a zero-length queue', async () => {
      await writeQueueFile([]);

      const queue = newQueue();

      await expectAsync(queue.list(dir)).toBeResolvedTo('(empty)\n');
    });

    it('prints "(empty)" when the queue file is absent', async () => {
      const queue = newQueue();

      await expectAsync(queue.list(dir)).toBeResolvedTo('(empty)\n');
    });
  });

  describe('lock contention', () => {
    it('serializes concurrent push calls through the shared lock so no ids are lost', async () => {
      const lock = new Lock({ sleepMs: 5 });
      const first = newQueue({ lock });
      const second = newQueue({ lock });

      await captureStdout(() => Promise.all([first.push(dir, 'a', 'b'), second.push(dir, 'c', 'd')]));

      const ids = (await readQueueFile()).map((entry) => entry.id).sort();

      expect(ids).toEqual(['a', 'b', 'c', 'd']);
    });

    it('serializes an overlapping push and pop through the shared lock without corrupting the queue', async () => {
      await writeQueueFile([{ id: 'current' }]);

      const lock = new Lock({ sleepMs: 5 });
      const pusher = newQueue({ lock });
      const popper = newQueue({ lock });

      await captureStdout(() => Promise.all([pusher.push(dir, 'next'), popper.pop(dir)]));

      const ids = (await readQueueFile()).map((entry) => entry.id);

      expect(ids.length).toEqual(1);
      expect(ids).toContain('next');
    });
  });
});

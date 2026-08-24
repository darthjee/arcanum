import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import Lock from '../../../../lib/utils/file/Lock.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

describe('Lock', () => {
  let dir;
  let lockFile;

  beforeEach(async () => {
    dir = await createTempDir();
    lockFile = path.join(dir, 'issue-1.lock');
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#acquire / #release', () => {
    it('creates the lock file while held and removes it on release', async () => {
      const lock = new Lock({ sleepMs: 5 });

      await lock.acquire(lockFile);
      await expectAsync(access(lockFile)).toBeResolved();

      await lock.release(lockFile);
      await expectAsync(access(lockFile)).toBeRejected();
    });

    it('creates parent directories for the lock file as needed', async () => {
      const nestedLockFile = path.join(dir, 'nested', 'issue-1.lock');
      const lock = new Lock({ sleepMs: 5 });

      await lock.acquire(nestedLockFile);

      await expectAsync(access(nestedLockFile)).toBeResolved();
      await lock.release(nestedLockFile);
    });

    it('retries on contention: a second writer stealing the lock file forces a retry', async () => {
      const lock = new Lock({ sleepMs: 5 });
      let writeCount = 0;
      const realAcquire = lock.acquire.bind(lock);

      spyOn(lock, '_read').and.callFake(async (file) => {
        writeCount += 1;

        if (writeCount === 1) {
          // Simulate another writer winning the race on the very first attempt.
          return 'someone-else';
        }

        return readFile(file, 'utf8');
      });

      await realAcquire(lockFile);

      expect(writeCount).toBeGreaterThanOrEqual(2);
      await lock.release(lockFile);
    });
  });

  describe('lock contention between two Lock instances', () => {
    // Mirrors arcanum/_lib/lock.sh's actual guarantee exactly: contention
    // is only detected between writers whose write+sleep+re-read windows
    // genuinely overlap (a writer that has already finished acquiring
    // and simply holds the file, without re-writing it, isn't "defended"
    // against a fresh acquirer — that's the shell original's real
    // behavior, not a gap introduced by this reimplementation; real
    // mutual exclusion for a shared JSON file comes from the
    // read/merge/write happening while still holding the lock, exercised
    // end-to-end by IssueState's own concurrent-write spec). What this
    // protocol does guarantee is that it never gives up: two acquirers
    // racing for the same never-before-created lock file both eventually
    // succeed, with no deadlock.
    it('lets two overlapping acquirers both eventually succeed, with no deadlock', async () => {
      const lockA = new Lock({ sleepMs: 20 });
      const lockB = new Lock({ sleepMs: 20 });

      await Promise.all([lockA.acquire(lockFile), lockB.acquire(lockFile)]);

      await expectAsync(access(lockFile)).toBeResolved();

      await lockA.release(lockFile);
      await lockB.release(lockFile);
      await expectAsync(access(lockFile)).toBeRejected();
    });
  });
});

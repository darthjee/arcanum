import { spawn } from 'node:child_process';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Lock from '../../../../lib/shared/file/Lock.js';
import LockTimeoutError from '../../../../lib/shared/file/LockTimeoutError.js';
import { createTempDir, removeTempDir } from '../../../support/utils/tempDir.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const LOCK_SH = path.join(REPO_ROOT, 'arcanum', '_lib', 'lock.sh');

/**
 * @param {string} command - the executable.
 * @param {string[]} args - its arguments.
 * @param {object} [env] - extra environment variables.
 * @returns {Promise<{pid: number, code: (number|null), stderr: string}>}
 *   the finished child's pid, exit code and stderr.
 */
function run(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ pid: child.pid, code, stderr }));
  });
}

/**
 * @returns {Promise<boolean>} whether `bash` can be spawned.
 */
async function bashAvailable() {
  try {
    return (await run('bash', ['-c', 'true'])).code === 0;
  } catch {
    return false;
  }
}

/**
 * @param {string} counterFile - the counter file's path.
 * @returns {Promise<number>} the counter's current value.
 */
async function readCounter(counterFile) {
  return Number((await readFile(counterFile, 'utf8')).trim());
}

/**
 * Lock, read-increment-write the counter (yielding in between), unlock.
 * @param {Lock} lock - the lock instance.
 * @param {string} lockFile - the lock file's path.
 * @param {string} counterFile - the counter file's path.
 * @returns {Promise<void>} resolves once the increment is done.
 */
async function lockedIncrement(lock, lockFile, counterFile) {
  await lock.acquire(lockFile);

  try {
    const value = await readCounter(counterFile);

    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    await writeFile(counterFile, `${value + 1}\n`);
  } finally {
    await lock.release(lockFile);
  }
}

describe('Lock', () => {
  let dir;
  let lockFile;
  let lock;

  beforeEach(async () => {
    dir = await createTempDir();
    lockFile = path.join(dir, 'issue-1.lock');
    lock = new Lock({ sleepMs: 5 });
  });

  afterEach(async () => {
    await removeTempDir(dir);
  });

  describe('#acquire', () => {
    it('takes an absent lock at once, writing <hostname>:<pid>:<nonce>\\n', async () => {
      spyOn(lock, '_sleep').and.callThrough();

      await lock.acquire(lockFile);

      expect(lock._sleep).not.toHaveBeenCalled();

      const content = await readFile(lockFile, 'utf8');
      const [hostname, pid, nonce] = content.slice(0, -1).split(':');

      expect(content.endsWith('\n')).toBeTrue();
      expect(content.trim().split(':').length).toBe(3);
      expect(hostname).toBe(os.hostname());
      expect(pid).toBe(String(process.pid));
      expect(nonce).toMatch(/^\S+$/);
    });

    it('generates a fresh id per acquire call', async () => {
      await lock.acquire(lockFile);
      const first = await readFile(lockFile, 'utf8');

      await lock.release(lockFile);
      await lock.acquire(lockFile);

      expect(await readFile(lockFile, 'utf8')).not.toBe(first);
      await lock.release(lockFile);
    });

    it('creates parent directories for the lock file as needed', async () => {
      const nestedLockFile = path.join(dir, 'nested', 'issue-1.lock');

      await lock.acquire(nestedLockFile);

      await expectAsync(access(nestedLockFile)).toBeResolved();
      await lock.release(nestedLockFile);
    });

    it('waits on an existing live lock and acquires once it is removed', async () => {
      const foreign = `${os.hostname()}:${process.pid}:x\n`;
      let settled = false;

      await writeFile(lockFile, foreign);

      const pending = lock.acquire(lockFile).then(() => {
        settled = true;
      });

      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(settled).toBeFalse();
      expect(await readFile(lockFile, 'utf8')).toBe(foreign);

      await rm(lockFile);
      await pending;

      expect(settled).toBeTrue();
      expect(await readFile(lockFile, 'utf8')).not.toBe(foreign);
      await lock.release(lockFile);
    });

    it('rethrows fs errors other than EEXIST', async () => {
      const blocker = path.join(dir, 'not-a-dir');

      await writeFile(blocker, '');

      await expectAsync(lock.acquire(path.join(blocker, 'x.lock'))).toBeRejected();
    });
  });

  describe('mutual exclusion', () => {
    it('never lets two racing instances both hold the lock (no lost update)', async () => {
      const counterFile = path.join(dir, 'counter');
      const lockA = new Lock({ sleepMs: 1 });
      const lockB = new Lock({ sleepMs: 1 });
      const iterations = 25;

      await writeFile(counterFile, '0\n');

      await Promise.all([lockA, lockB].map(async (instance) => {
        for (let i = 0; i < iterations; i += 1) {
          await lockedIncrement(instance, lockFile, counterFile);
        }
      }));

      expect(await readCounter(counterFile)).toBe(iterations * 2);
      await expectAsync(access(lockFile)).toBeRejected();
    });

    it('lets one instance hold two different lock files at once', async () => {
      const otherLockFile = path.join(dir, 'issue-2.lock');

      await lock.acquire(lockFile);
      await lock.acquire(otherLockFile);

      await lock.release(lockFile);
      await expectAsync(access(lockFile)).toBeRejected();
      await expectAsync(access(otherLockFile)).toBeResolved();

      await lock.release(otherLockFile);
      await expectAsync(access(otherLockFile)).toBeRejected();
    });
  });

  describe('#release', () => {
    it('removes the lock file it holds', async () => {
      await lock.acquire(lockFile);
      await lock.release(lockFile);

      await expectAsync(access(lockFile)).toBeRejected();
    });

    it('leaves a lock file that now holds a foreign id intact', async () => {
      const foreign = 'otherhost:1:nonce\n';

      await lock.acquire(lockFile);
      await writeFile(lockFile, foreign);
      await lock.release(lockFile);

      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('is a silent no-op when nothing is held', async () => {
      const foreign = 'otherhost:1:nonce\n';

      await expectAsync(lock.release(lockFile)).toBeResolved();

      await writeFile(lockFile, foreign);
      await lock.release(lockFile);

      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('is a silent no-op when the held lock file vanished', async () => {
      await lock.acquire(lockFile);
      await rm(lockFile);

      await expectAsync(lock.release(lockFile)).toBeResolved();
    });
  });

  describe('stale locks', () => {
    let deadPid;

    beforeAll(async () => {
      ({ pid: deadPid } = await run(process.execPath, ['-e', '']));
    });

    it('breaks a same-host lock whose pid is dead, and acquires it', async () => {
      await writeFile(lockFile, `${os.hostname()}:${deadPid}:old\n`);

      await lock.acquire(lockFile, { timeoutMs: 0 });

      const [, pid] = (await readFile(lockFile, 'utf8')).trim().split(':');

      expect(pid).toBe(String(process.pid));
      await lock.release(lockFile);
    });

    it('does not break a same-host lock whose pid is alive', async () => {
      const foreign = `${os.hostname()}:${process.pid}:x\n`;

      await writeFile(lockFile, foreign);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 50, warn: false })).toBeRejectedWithError(LockTimeoutError);
      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('never breaks a lock from another host', async () => {
      const foreign = `not-${os.hostname()}:${deadPid}:x\n`;

      await writeFile(lockFile, foreign);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 50, warn: false })).toBeRejectedWithError(LockTimeoutError);
      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('never breaks an old-format (unparseable) id', async () => {
      const foreign = `host-${deadPid}-456`;

      await writeFile(lockFile, foreign);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 50, warn: false })).toBeRejectedWithError(LockTimeoutError);
      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('never breaks an empty lock file', async () => {
      await writeFile(lockFile, '');

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 20, warn: false })).toBeRejectedWithError(LockTimeoutError);
      expect(await readFile(lockFile, 'utf8')).toBe('');
    });

    it('does not remove a stale lock that changed before the re-read', async () => {
      const replacement = 'otherhost:1:new\n';
      const realRead = lock._read.bind(lock);
      let reads = 0;

      await writeFile(lockFile, `${os.hostname()}:${deadPid}:old\n`);
      spyOn(lock, '_read').and.callFake(async (file) => {
        reads += 1;

        if (reads === 2) {
          await writeFile(file, replacement);
        }

        return realRead(file);
      });

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 0 })).toBeRejectedWithError(LockTimeoutError);
      expect(await readFile(lockFile, 'utf8')).toBe(replacement);
    });

    describe('#_parseId', () => {
      it('parses <hostname>:<pid>:<nonce>', () => {
        expect(lock._parseId('box:42:n-1')).toEqual({ hostname: 'box', pid: 42 });
      });

      it('rejects anything that is not exactly 3 parts with a numeric pid', () => {
        expect(lock._parseId('host-123-456')).toBeNull();
        expect(lock._parseId('')).toBeNull();
        expect(lock._parseId('box:4x:n')).toBeNull();
        expect(lock._parseId('box:42:n:extra')).toBeNull();
      });
    });

    describe('#_isAlive', () => {
      it('treats EPERM as alive', () => {
        spyOn(process, 'kill').and.throwError(Object.assign(new Error('eperm'), { code: 'EPERM' }));

        expect(lock._isAlive(1)).toBeTrue();
      });
    });
  });

  describe('bound', () => {
    const foreign = 'otherhost:1:nonce\n';

    it('throws LockTimeoutError at once with timeoutMs: 0, leaving the foreign file byte-identical', async () => {
      await writeFile(lockFile, foreign);

      let error;

      try {
        await lock.acquire(lockFile, { timeoutMs: 0 });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(LockTimeoutError);
      expect(error.code).toBe('LOCK_TIMEOUT');
      expect(error.lockFile).toBe(lockFile);
      expect(await readFile(lockFile, 'utf8')).toBe(foreign);
    });

    it('succeeds when the lock is released before the deadline', async () => {
      await writeFile(lockFile, foreign);

      setTimeout(() => {
        rm(lockFile);
      }, 20);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 2000 })).toBeResolved();
      await lock.release(lockFile);
    });

    it('warns once after 10 failed attempts by default', async () => {
      spyOn(process.stderr, 'write');
      await writeFile(lockFile, foreign);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 300 })).toBeRejectedWithError(LockTimeoutError);

      const warnings = process.stderr.write.calls.allArgs().filter(([text]) => String(text).includes('seems stuck'));

      expect(warnings.length).toBe(1);
      expect(warnings[0][0]).toBe(
        `Warning: lock (${lockFile}) seems stuck after 10 attempts — check whether a process is actually holding it, and if not, remove the lock file manually. Retrying...\n`
      );
    });

    it('suppresses the warning with warn: false', async () => {
      spyOn(process.stderr, 'write');
      await writeFile(lockFile, foreign);

      await expectAsync(lock.acquire(lockFile, { timeoutMs: 300, warn: false })).toBeRejectedWithError(LockTimeoutError);

      expect(process.stderr.write).not.toHaveBeenCalled();
    });

    it('rejects an invalid timeoutMs with a TypeError', async () => {
      await expectAsync(lock.acquire(lockFile, { timeoutMs: -1 })).toBeRejectedWithError(TypeError);
      await expectAsync(lock.acquire(lockFile, { timeoutMs: Infinity })).toBeRejectedWithError(TypeError);
      await expectAsync(lock.acquire(lockFile, { timeoutMs: '5' })).toBeRejectedWithError(TypeError);
      await expectAsync(access(lockFile)).toBeRejected();
    });
  });

  describe('cross-implementation race with arcanum/_lib/lock.sh', () => {
    it('keeps shell and native writers mutually exclusive (no lost update)', async () => {
      if (!(await bashAvailable())) {
        pending('bash is not available');
      }

      const counterFile = path.join(dir, 'counter');
      const iterations = 20;
      const script = [
        'source "$LOCK_SH"',
        'for ((i = 0; i < ITERATIONS; i++)); do',
        '  _acquire_lock',
        '  value="$(cat "$COUNTER_FILE")"',
        '  sleep 0.005',
        '  printf \'%s\\n\' "$((value + 1))" > "$COUNTER_FILE"',
        '  _release_lock',
        'done'
      ].join('\n');

      await writeFile(counterFile, '0\n');

      const shell = run('bash', ['-c', script], {
        LOCK_SH,
        LOCK_FILE: lockFile,
        COUNTER_FILE: counterFile,
        ITERATIONS: String(iterations),
        ARCANUM_LOCK_RETRY_SLEEP: '0.01'
      });
      const native = (async () => {
        const nativeLock = new Lock({ sleepMs: 5 });

        for (let i = 0; i < iterations; i += 1) {
          await lockedIncrement(nativeLock, lockFile, counterFile);
        }
      })();
      const [shellResult] = await Promise.all([shell, native]);

      expect(shellResult.code).withContext(shellResult.stderr).toBe(0);
      expect(await readCounter(counterFile)).toBe(iterations * 2);
      await expectAsync(access(lockFile)).toBeRejected();
    }, 30000);
  });
});

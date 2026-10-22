import LockTimeoutError from '../../../../lib/shared/file/LockTimeoutError.js';

describe('LockTimeoutError', () => {
  const error = new LockTimeoutError('/tmp/state/issue-1.lock');

  it('is an Error', () => {
    expect(error).toBeInstanceOf(Error);
  });

  it('carries its name, code and lock file', () => {
    expect(error.name).toBe('LockTimeoutError');
    expect(error.code).toBe('LOCK_TIMEOUT');
    expect(error.lockFile).toBe('/tmp/state/issue-1.lock');
  });

  it('names the lock file in its message', () => {
    expect(error.message).toBe(
      'Timed out waiting for lock /tmp/state/issue-1.lock; if no process holds it, remove it by hand.'
    );
  });
});

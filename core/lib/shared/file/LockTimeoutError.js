/**
 * Raised by `Lock#acquire` when its optional `timeoutMs` bound runs out
 * before the lock could be taken. Nothing was written to the lock file
 * by the timed-out acquirer.
 */
class LockTimeoutError extends Error {
  /**
   * @param {string} lockFile - the lock file's path.
   */
  constructor(lockFile) {
    super(`Timed out waiting for lock ${lockFile}; if no process holds it, remove it by hand.`);
    this.name = 'LockTimeoutError';
    this.code = 'LOCK_TIMEOUT';
    this.lockFile = lockFile;
  }
}

export default LockTimeoutError;

/**
 * Exception type for the "print to stdout, still fail" dispatch shape —
 * a migrated entrypoint whose failure path (e.g. a retry budget being
 * exhausted, or a merge conflict) prints a `STATUS=failed` line to
 * stdout, exits with a specific exit code (1 by default), but writes
 * nothing else to stderr. `core/bin/arcanum`'s `dispatch()`
 * special-cases this exception type: its `.stdout` payload is written
 * to `process.stdout`, `process.exitCode` is set to `.exitCode`, and
 * (unlike a bare `Error`) no `arcanum: <message>` line is written to
 * stderr. See docs/agents/architecture/script-engine.md's
 * dispatch-contract section.
 */
class DispatchFailure extends Error {
  /**
   * @param {string} stdout - the exact stdout payload to print on
   *   dispatch, e.g. `'STATUS=failed\n'`.
   * @param {number} [exitCode] - the process exit code to use on
   *   dispatch. Defaults to 1.
   */
  constructor(stdout, exitCode = 1) {
    super('dispatch failure');
    this.stdout = stdout;
    this.exitCode = exitCode;
  }
}

export default DispatchFailure;

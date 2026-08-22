/**
 * Exception type for the "print to stdout, still fail" dispatch shape —
 * a migrated entrypoint whose failure path (e.g. a retry budget being
 * exhausted) prints a `STATUS=failed` line to stdout, exits 1, but
 * writes nothing else to stderr. `core/bin/arcanum`'s `dispatch()`
 * special-cases this exception type: its `.stdout` payload is written
 * to `process.stdout`, `process.exitCode` is set to 1, and (unlike a
 * bare `Error`) no `arcanum: <message>` line is written to stderr. See
 * docs/agents/architecture/script-engine.md's dispatch-contract section.
 */
class DispatchFailure extends Error {
  /**
   * @param {string} stdout - the exact stdout payload to print on
   *   dispatch, e.g. `'STATUS=failed\n'`.
   */
  constructor(stdout) {
    super('dispatch failure');
    this.stdout = stdout;
  }
}

export default DispatchFailure;

/**
 * Throwaway-turned-permanent fixture module proving `core/bin/arcanum`'s
 * command routing and the shell/native dispatch guard's output/exit-code
 * parity contract end to end (see
 * docs/agents/architecture/script-engine.md). Kept as reusable scaffolding
 * for future dispatcher-related tests, the same way
 * `core/spec/support/fixtures/` is kept — not deleted once #192 lands.
 */
class DispatchFixture {
  /**
   * Produce the fixture's success output. Must stay byte-identical to
   * scripter's shell-side `dispatch-fixture` fixture's stdout.
   * @returns {string} the exact line to print to stdout, trailing newline included.
   */
  run() {
    return 'dispatch-fixture: ok\n';
  }

  /**
   * Simulate a native-side crash/bug, so the dispatch guard's
   * "native implementation exists but crashes -> fails loud, no
   * fallback" case has something real to invoke through
   * `core/bin/arcanum dispatch-fixture-crash`.
   * @throws {Error} always, to simulate a native-side crash.
   */
  crash() {
    throw new Error('dispatch-fixture: simulated native crash');
  }
}

export default DispatchFixture;

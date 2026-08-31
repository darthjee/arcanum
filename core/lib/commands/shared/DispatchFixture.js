/**
 * Fixture module backing the `dispatch-fixture-crash` command, which proves
 * that `core/bin/arcanum`'s dispatch guard fails loud (no shell fallback)
 * when a native implementation exists but crashes (see
 * docs/agents/architecture/script-engine.md). The shell/native dispatch
 * parity proof itself is anchored on the real `auto-fix-all-config-get`
 * command instead (see
 * docs/agents/plans/340-investigate-removing-dispatch-fixture---dispatch-fixture-crash/plan.md's
 * "Shared contracts").
 */
class DispatchFixture {
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

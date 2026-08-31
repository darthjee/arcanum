# Plan: Investigate re-anchoring the InvocationLog crash-survival proof (dispatch-fixture-crash)

Issue: [342-investigate-re-anchoring-the-invocationlog-crash-survival-proof--dispatch-fixture-crash.md](../../issues/342-investigate-re-anchoring-the-invocationlog-crash-survival-proof--dispatch-fixture-crash.md)

## Overview

Decouple `core/spec/lib/core/dispatcher_spec.js`'s unit-level `InvocationLog` crash-survival tests from the real `dispatch-fixture-crash` registry entry, anchoring them instead on an already-registered real command (`auto-fix-all-config-get`) with a mocked `commandInstance()`. `core/spec/bin/arcanum_spec.js` and `DispatchFixture.js` are left unchanged, since the process-level proof has no mocking seam and genuinely needs a real crash.

See [node.md](node.md) for the full plan.

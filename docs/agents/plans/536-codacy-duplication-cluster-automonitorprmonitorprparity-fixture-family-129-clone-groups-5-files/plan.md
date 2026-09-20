# Plan: Codacy: duplication cluster — autoMonitorPrMonitorPrParity fixture family (129 clone groups, 5 files)

Issue: [536-codacy-duplication-cluster-automonitorprmonitorprparity-fixture-family-129-clone-groups-5-files.md](../issues/536-codacy-duplication-cluster-automonitorprmonitorprparity-fixture-family-129-clone-groups-5-files.md)

## Overview
Extract the identical `setupParityTest` → `runPair` → 4-`expect`s → `cleanup` block, currently re-authored independently in `terminal_states_spec.js`, `pending_spec.js`, `shipit_spec.js`, and `commented_spec.js`, into a single shared `itMatchesShellForState` helper on the existing `autoMonitorPrMonitorPrParitySetup.js` factory. `usage_error_spec.js` is out of scope — it doesn't share this fixture/assertion shape.

See [node.md](node.md) for the full plan.

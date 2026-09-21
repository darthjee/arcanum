# Plan: Codacy: duplication cluster — engine_dispatch_spec.js family across Parity suites (43 clone groups, 4 files)

Issue: [541-codacy-duplication-cluster-engine-dispatch-spec-js-family-across-parity-suites-43-clone-groups-4-files.md](../issues/541-codacy-duplication-cluster-engine-dispatch-spec-js-family-across-parity-suites-43-clone-groups-4-files.md)

## Overview

Dedupe the `engine_dispatch_spec.js` test family under `core/spec/bin/` by extracting a shared `seedEngineMode` helper and a flexible dispatch-routing shared example into `core/spec/support/`, reused by the three GitHub-fixture-based specs, while giving the structurally different `autoFixAllGithubParity/engine_dispatch_spec.js` its own separate, smaller extraction.

See [node.md](node.md) for the full plan.

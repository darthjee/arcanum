# Plan: Split spec ArcanumUpdateRunUpdateParity

Issue: [353-split-spec-arcanumupdaterunupdateparity.md](../issues/353-split-spec-arcanumupdaterunupdateparity.md)

## Overview

Spec-only reorganization: split `core/spec/bin/arcanumUpdateRunUpdateParity_spec.js` (317 lines,
covering both the `check` and `apply` subcommands) into `check_spec.js` and `apply_spec.js`,
moving the shared fixture-building helpers into a new support module. No behavior, assertion, or
non-test source change.

See [node.md](node.md) for the full plan.

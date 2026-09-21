# Plan: Codacy: duplication cluster — PermissionGrant_spec.js internal self-duplication

Issue: [544-codacy-duplication-cluster-permissiongrant-spec-js-internal-self-duplication-45-clone-groups-1-file.md](../../issues/544-codacy-duplication-cluster-permissiongrant-spec-js-internal-self-duplication-45-clone-groups-1-file.md)

## Overview

Collapse the five duplicated "arrange `PermissionGrant`, call `add`, assert the written JSON" tests in `core/spec/lib/commands/shared/PermissionGrant_spec.js` into a single `it.each`-driven parameterized test, varying initial file state and the `add()` target rather than the permission name (all five already grant the same `'Bash(git push:*)'` permission). The other four tests in the file are left unchanged.

See [node.md](node.md) for the full plan.

# Plan: Scaffold shared/ and copy the shared surface into it

Issue: [822-scaffold-shared-and-copy-the-shared-surface-into-it.md](../../issues/822-scaffold-shared-and-copy-the-shared-surface-into-it.md)

## Overview

Create the root `shared/` package (zero runtime dependencies, ESLint with the `node:`-only boundary, Jasmine + c8 with coverage enforced), copy `core/lib/shared/{config,file}/` into `shared/lib/` byte-for-byte, and copy the moved and duplicated specs and support into `shared/spec/` per the spec's inventory. `core/` and `cli/` are not touched. Single owner: `shared`.

See [shared.md](shared.md) for the full plan.

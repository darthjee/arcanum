# Plan: Writer additions needed by #780 (unset, lock timeout, top-level keys)

Issue: [825-writer-additions-needed-by-780-unset-lock-timeout-top-level-keys.md](../../issues/825-writer-additions-needed-by-780-unset-lock-timeout-top-level-keys.md)

## Overview

Extend `shared/lib/config/RepoConfigWriter.js` with three things `arcanum config set/unset` (#780) needs:

- an optional `timeoutMs` on every method, passed to `Lock.acquire`;
- an optional `namespace` on `write`, for top-level writes;
- a new `unset` method.

Existing callers and behaviour stay unchanged. This is a `shared`-only change.

See [shared.md](shared.md) for the full plan.

# Plan: Migrate resolve_and_fetch.sh to a native (Node.js) implementation

Issue: [193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation.md](../issues/193-migrate-resolve-and-fetch-sh-to-a-native--node-js--implementation.md)

## Overview

First real proof of #168's script-engine architecture: `resolve_and_fetch.sh` gets a native Node.js implementation dispatched via `engine_dispatch.sh`, while its shell contract is simultaneously simplified to accept only `#<id>` input (dropping unused title-combo generality). `scripter` simplifies and converts the shell entrypoint into a thin dispatch shim; `node` builds the native equivalent, its tests, and the parity test that proves the two match byte-for-byte.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

**Command key**: `resolve-and-fetch` (kebab-case) — used as the third argument to `engine_dispatch` in the shell shim, as the routing key in `core/bin/arcanum`, and as the key flipped to `true` in `arcanum/_lib/migration-status.json` once everything passes.

**Stdout/exit-code contract** (both sides must produce this byte-for-byte):
- Success: `STATUS=ok\nID=<id>\nTITLE=<title>\nFILE=<path>\nDOMAIN=<domain>\nREPO=<owner>/<repo>\n`, exit 0.
- Failure (bad input, issue not found, auth failure, fetch failure): `STATUS=error\nERROR=<message>\n`, exit 0.
- Not part of this contract, unchanged by this issue: `checkout_safe_branch.sh`'s dirty-working-tree precondition failure stays a hard failure (stderr message, exit 1, no `STATUS=` line at all) — this is a distinct, pre-existing failure class unrelated to id parsing, called out in the script's own header comment as deliberately outside the `STATUS=ok`/`STATUS=error` contract.

**Simplified input grammar**: `^#[0-9]+$` (surrounding whitespace trimmed). Anything else — empty string, `#abc`, `#193 - title`, a bare title — is `STATUS=error`.

**Exact error message text** (must match verbatim on both sides, since it flows into `ERROR=`):
- Malformed/missing id: `Error: invalid input '<raw_input>' — expected '#<id>'`
- GitHub auth failure: `Error: could not obtain GitHub token via gh auth token`
- GitHub fetch failure: `Error: could not fetch issue #<id> from <owner>/<repo>`

**Env passthrough**: the shell shim's `engine_dispatch` call must include `HOME` in its explicit env-var allowlist (in addition to `PATH`, which `engine_dispatch` always includes) — `gh auth token` needs `$HOME` to locate its own config under the native path's stripped `env -i` execution environment, or native-mode auth will fail where shell-mode wouldn't.

**Existing-file lookup**: glob `docs/agents/issues/<id>_*` or `docs/agents/issues/<id>-*`; first match wins. Match order is filesystem-dependent and not required to be identical between shell and native (see the issue's Edge Cases) — do not build fixtures with more than one match for the same id.

**Filename sanitization** (`normalize_title`, for a freshly-fetched issue's `FILE=`): lowercase, `[^a-z0-9]` → `-`, collapse repeated `-`, trim leading/trailing `-`. Result: `docs/agents/issues/<id>-<slug>.md`.

**`TITLE` derivation for an existing-file match** (`title_from_filename`): strip the `<id>` prefix up to the first `_`/`-`, replace remaining `_`/`-` with spaces, Title-Case each word.

**State-file write** (`.claude/state/issue-<id>.json`, via the same lock/mutate/release protocol documented in [lock-system.md](../../architecture/lock-system.md)): write instance id (`hostname-pid-timestamp`), sleep 1s, re-read to confirm the lock is still held, retry on loss (warn once after 10 consecutive failed attempts), mutate, delete the lock file. Fields written: `tags` (JSON array, mapped from GitHub labels via the canonical table below), `updated_at`, `title`, `state`.

**Label → canonical tag table** (from `tags.sh`, duplicated into `core/lib/` per the issue's Scope decision — not shared with the shell side): `Created→created`, `Ready for Work→ready_for_work`, `shipit→shipit`, `Working→working`, `Question→question`, `Fetched→fetched`, `Refined→refined`, `Ready→ready`, `Enqueued→enqueued`, `Idea→idea`, `Writting→writting`, `Enhancing→enhancing`, `PR→pr`, `Planning→planning`, `Split→split`, `Spawned→spawned`. Unrecognized labels are silently ignored.

**Gating**: `scripter`'s final step (flip `migration-status.json`) only happens once `node`'s unit tests, parity test, and code review all pass — sequenced last, after `node`'s work is already committed on this same branch.

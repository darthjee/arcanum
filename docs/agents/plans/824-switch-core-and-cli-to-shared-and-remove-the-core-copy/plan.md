# Plan: Switch core and cli to shared/ and remove the core copy

Issue: [824-switch-core-and-cli-to-shared-and-remove-the-core-copy.md](../../issues/824-switch-core-and-cli-to-shared-and-remove-the-core-copy.md)

## Overview

Make `core/` and `cli/` import the shared config surface from `shared/lib/` (relative paths), delete `core/lib/shared/` and `core/spec/lib/shared/`, and move the lint and build boundaries to the new layout. Then extend the runtime smoke test so that a runtime image that cannot resolve `shared/` fails in CI. Behaviour stays the same.

## Agents involved

- [node](node.md): switches the core imports, deletes the core copy and its specs, and updates the core lint rules and comments.
- [client](client.md): switches the cli import and moves the cli lint boundary and build allow-list to `shared/lib/`.
- [shared](shared.md): repoints the `keys.json` path in the strict-key error message.
- [infra](infra.md): adds a native config command to `make core-smoke-runtime`.

## Architect work

The architect does this as coordinator, after the specialists finish:

- Remove the copy-window "drift rule" bullet from `.claude/agents/node.md`, `.claude/agents/client.md` and `.claude/agents/shared.md`.
- Drop any remaining `core/lib/shared/` mentions from those agents' scopes.
- `arcanum/_lib/lock.sh` line 8 (`scripter` scope; a one-line comment): `core/lib/shared/file/Lock.js` becomes `shared/lib/file/Lock.js`. Dispatch `scripter` for it, or fold it into the architect pass.
- In `docs/agents/folder-structure.md`, update the `shared/` row: drop "until #824 the config surface also lives in `core/lib/shared/` (owned by `node`)".

## Shared contracts

- **Pre-check (`node`, before any deletion):** `diff -r core/lib/shared shared/lib` must print nothing. If it prints differences, stop and re-sync `shared/lib/` (`shared`) first. The two folders were identical when this was planned.
- **Import target:** every consumer imports the surface by relative path into `<repo>/shared/lib/`, e.g. `shared/lib/config/ConfigChain.js`, `shared/lib/config/keys.json`, `shared/lib/file/Lock.js`. There are no re-export shims, and nothing imports `shared/spec/**`.
- **Error message (exact text, `shared`):** `arcanum: config key "<key>" is not in shared/lib/config/keys.json (ARCANUM_STRICT_CONFIG_KEYS=1)`. Specs that assert this string must use exactly this text.
- **Boundaries:**
  - `cli/` imports nothing from `core/`.
  - `core/` and `cli/` may import `shared/lib/**` but never `shared/spec/**`.
  - The cli build's `ALLOWED_INPUT_DIRS` is `['cli/lib/', 'shared/lib/']`.
- **Not to confuse:** `core/lib/commands/shared/` and `core/spec/lib/commands/shared/` are core's own command helpers. They are **not** the shared surface and stay untouched. A blind `lib/shared` search-and-replace would hit them, so match the full prefix.

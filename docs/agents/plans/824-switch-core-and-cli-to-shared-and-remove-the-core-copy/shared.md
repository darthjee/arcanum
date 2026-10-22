# Shared Plan: Switch core and cli to shared/ and remove the core copy

Main plan: [plan.md](plan.md)

## Shared contracts

- The exact new message: `arcanum: config key "<key>" is not in shared/lib/config/keys.json (ARCANUM_STRICT_CONFIG_KEYS=1)`.
- If `node`'s pre-check finds that `core/lib/shared/` and `shared/lib/` differ, re-sync `shared/lib/` to the core copy first.

## Implementation Steps

### Step 1 — Repoint the strict-key error message

In `shared/lib/config/KeyRegistry.js` (about line 677), change `core/lib/shared/config/keys.json` to `shared/lib/config/keys.json` in the `ARCANUM_STRICT_CONFIG_KEYS` error, and repoint any other comment in `shared/` that names `core/lib/shared/`. Check with `grep -rn "core/lib/shared" shared --exclude-dir=node_modules`, which must print nothing.

### Step 2 — Update the specs

Update the two expectations in `shared/spec/config/KeyRegistry_spec.js` (around lines 321 and 362) to the new text.

## Files to Change

- `shared/lib/config/KeyRegistry.js`: the error message path.
- `shared/spec/config/KeyRegistry_spec.js`: the expected message.

## CI Checks

- `shared`: `make shared-check` (CI job: `shared`, added by #823; until it lands, run `cd shared && yarn install --frozen-lockfile && yarn lint && yarn test`)

## Notes

- This is a change to text users see, accepted in the issue. Check `core/spec` too for any spec that asserts the old string (`node` updates those).

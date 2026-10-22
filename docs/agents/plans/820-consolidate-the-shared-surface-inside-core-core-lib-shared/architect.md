# Architect Plan: Consolidate the shared surface inside core (core/lib/shared/)

Main plan: [plan.md](plan.md)

## Shared contracts

Docs follow the moved paths in [plan.md](plan.md#shared-contracts). Nothing you change is consumed by another agent.

## Implementation Steps

### Step 1 — Repoint agent files

`.claude/agents/node.md`, `scripter.md` and `client.md` name `core/lib/utils/config/keys.json`; change it to `core/lib/shared/config/keys.json`, keeping each "moves to `shared/lib/` in #824" note. `node.md`'s ownership sentence ("in `core/lib/utils/` until #820, then in `core/lib/shared/`") and `shared.md`'s matching sentence describe history and can stay; tighten them to the present tense if they read as future.

### Step 2 — Update the spec

In `docs/agents/specs/shared-lib.md`, align with the #820 decisions:
- Migration steps, step 1: the CLI side also becomes folder-based (lint restriction accepts `core/lib/shared/`; the build check accepts `cli/lib/**` and `core/lib/shared/**` and no longer reads core's ESLint config); code comments naming the moved paths are repointed to `core/lib/shared/` here, and again in #824.
- Step 3 (#824): the CLI rule and build check become a prefix swap to `shared/`; comments are repointed a second time.
- Spec-file inventory: note that `Lock_spec.js` moves whole to `core/spec/lib/shared/file/` in #820 and is split in #822.
- Implementation order note: code comments are repointed in #820 and #824, not only #824.

## Files to Change
- `.claude/agents/node.md`, `.claude/agents/scripter.md`, `.claude/agents/client.md` — `keys.json` path
- `docs/agents/specs/shared-lib.md` — migration steps, inventory note, implementation-order note

# Plan: Remove the shared lib spec

Issue: [827-remove-the-shared-lib-spec.md](../../issues/827-remove-the-shared-lib-spec.md)

## Overview
This is the last item of epic #816. #826 promoted the design to [Shared Lib](../../architecture/shared-lib.md), so the spec `docs/agents/specs/shared-lib.md` can go. Each folder's owner repoints its own code comments and lint messages to the architecture doc, and `architect` deletes the spec and its index row. Only text changes: no lint rule, regex or behavior changes.

## Agents involved

- [node](node.md)
- [client](client.md)
- [shared](shared.md)
- [architect](architect.md)

## Shared contracts

- **Link target:** `docs/agents/architecture/shared-lib.md`. Text about the import boundary (what may be imported from `shared/lib/**` and the `shared/spec/**` ban) points to `docs/agents/architecture/shared-lib.md#import-boundary`. That anchor exists (`## Import boundary`).
- **Plain-text paths:** ESLint comments and messages give the path as plain text (no markdown link), relative to the repo root, the same way as today.
- **No other changes:** keep each message's wording apart from the path. Rule options, regexes and rule order stay exactly as they are.
- **Fallback:** if a specialist's dispatch is blocked or fails, `architect` makes that specialist's text edit itself.

## CI Checks
- `core`: `yarn lint` (CI job: `checks`)
- `cli`: `yarn lint` (CI job: `cli`)
- `shared`: `yarn lint` (CI job: `shared`)

## Notes
- Final check, after every agent is done: `grep -rn 'specs/shared-lib' --exclude-dir=node_modules --exclude-dir=.git .` matches only files under `docs/agents/issues/` and `docs/agents/plans/`, which are historical records and stay as they are.
- No spec asserts on the lint message text, so no test changes are expected.

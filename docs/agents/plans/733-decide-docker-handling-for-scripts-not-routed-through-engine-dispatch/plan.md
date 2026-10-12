# Plan: Decide docker handling for scripts not routed through engine_dispatch

Issue: [733-decide-docker-handling-for-scripts-not-routed-through-engine-dispatch.md](../../issues/733-decide-docker-handling-for-scripts-not-routed-through-engine-dispatch.md)

## Overview

This change only touches docs. It records the per-kind docker decision for the scripts that do not go through `engine_dispatch.sh`. Every `TBD (#733)` row in the docker checklist gets a final `kind` (`sourced`, `wrapper`, `entrypoint` or `bootstrap`), and every row keeps status `n/a`. The decision also goes into `dispatch.md` and the `docker.md` index. Once it lands, #731 can promote the spec.

## Context

The checklist's last section lists 39 non-dispatched files. They fall into these kinds:

- **sourced**: libraries that are only ever `source`d. `push.sh` and `merge_body.sh` belong here, although the original snapshot called them entrypoints.
- **wrapper**: a one-line `exec` into a dispatched `arcanum/_lib` shim.
- **entrypoint**: only `next_step_prompt.sh` (bash, needs `jq`, owns `/dev/tty`) and `auto_next.sh` (runs `next_step_prompt.sh --no-prompt`, then `git push`). Decision: both become dispatched native commands whose `migration-status.json` value is `"host-only"`. That migration is follow-up #760, a sub-issue of #724, and is not part of this issue.
- **bootstrap**: the install/update bootstraps, which run before or outside an installed arcanum.

None of these kinds can ever be ✅. Only `dispatched` and `native-only` rows can.

No agent outside the architect has work here: no script, `core/` or infra change is involved.

## Steps

- [01 — Assign final kinds in the checklist](plan/01-checklist-kinds.md)
- [02 — Resolve the non-dispatched TTY line in dispatch.md](plan/02-dispatch-tty.md)
- [03 — Record the decision in the docker.md index](plan/03-docker-index.md)

## Notes

- Do not change any script, `migration-status.json` or `core/`. The migration of `next_step_prompt.sh` and `auto_next.sh` belongs to #760.
- Once #760 lands, it moves those two rows out of the last section into their skill-folder tables. This plan only adds a note that points to #760.
- No CI job validates these docs. Check that `grep -rn 'TBD (#733)\|pending #733\|stay with #733' docs/agents/specs` returns nothing.

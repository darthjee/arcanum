# Plan: Document boundaries/off-limits actions for the project's instructions (Agentlinter completeness_has-boundaries)

Issue: [482-document-boundaries-off-limits-actions-for-the-project-s-instructions-agentlinter-completeness-has-boundaries.md](../../issues/482-document-boundaries-off-limits-actions-for-the-project-s-instructions-agentlinter-completeness-has-boundaries.md)

## Overview
Add an explicit `## Boundaries` section to `AGENTS.md` naming concrete off-limits actions for agents in this repo, each cross-linked to the architecture doc it's already (but only implicitly) documented in. `CLAUDE.md` stays an unmodified pointer, per the existing `init-claude`-managed convention.

## Context
Codacy's Agentlinter flags `CLAUDE.md:1` for having no boundaries/constraints (`completeness_has-boundaries`). `CLAUDE.md` is intentionally just a one-line pointer to `AGENTS.md`, so the fix belongs in `AGENTS.md` instead — which currently has an `## Agents` table and `## Documentation` map but no section saying what agents must *not* do. Six concrete boundaries already exist, scattered across `docs/agents/architecture/`, but are never collected anywhere an agent session actually loads:
- `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` carry `<!-- AUTO-GENERATED, DO NOT EDIT BY HAND -->` headers.
- [Script Preference](../../architecture/script-preference.md) requires deterministic logic to live in scripts, not skill markdown.
- [Agent Roster and Architect Delegation](../../architecture/agent-roster-and-delegation.md) documents each specialist's bounded scope and routes cross-scope work through the architect.
- [Repo Path Threading](../../architecture/repo-path-threading.md) requires every git-mutating command to be explicitly scoped to `REPO_PATH`, never trusting ambient cwd.
- [Lock System](../../architecture/lock-system.md) requires shared JSON state mutations to go through its lock/mutate/release sequence.
- [Dispatch Permissions](../../architecture/dispatch-permissions.md) restricts permission-grant allowlisting to narrow, fixed, low-risk scripts — never broad/ad hoc destructive commands.

## Implementation Steps

### Step 1 — Add the `## Boundaries` section to AGENTS.md
Insert a new `## Boundaries` section into `AGENTS.md`, placed after `## Agents` and before `## Documentation`. List the six off-limits actions below, each as a short bold rule plus a one-line rationale and a link to its source doc:

1. **Never hand-edit an auto-generated file** — `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` are marked `AUTO-GENERATED, DO NOT EDIT BY HAND`; regenerate via their `scripts/generate_*.sh` instead.
2. **Never embed deterministic logic in skill markdown** — extract it into `<skill>/scripts/*.sh` or `arcanum/_lib/` (see [Script Preference](docs/agents/architecture/script-preference.md)).
3. **Never touch another specialist agent's owned scope directly** — route cross-scope work through the `architect` agent (see [Agent Roster and Architect Delegation](docs/agents/architecture/agent-roster-and-delegation.md)).
4. **Never run a bare git-mutating command trusting ambient cwd** — always scope explicitly to `REPO_PATH`, never re-derive it from `pwd` mid-run (see [Repo Path Threading](docs/agents/architecture/repo-path-threading.md)).
5. **Never mutate shared JSON state without the lock sequence** — see [Lock System](docs/agents/architecture/lock-system.md).
6. **Never preapprove broad or ad hoc destructive commands** in a specialist's permission grants — only narrow, fixed, low-risk scripts qualify; everything else relies on the blocked-dispatch escalation path (see [Dispatch Permissions](docs/agents/architecture/dispatch-permissions.md)).

Do not modify `CLAUDE.md`.

### Step 2 — Verify and note the Agentlinter finding status
Re-run (or otherwise check) Codacy's Agentlinter against the updated `AGENTS.md`/`CLAUDE.md` pair. If `completeness_has-boundaries` doesn't come back clean because it's anchored specifically on `CLAUDE.md`'s content rather than the file it points to, add a short note to the PR description explaining that `CLAUDE.md` is intentionally a pointer and the real boundaries now live in `AGENTS.md`'s new `## Boundaries` section — this is an accepted/explained finding, not a blocker.

## Files to Change
- `AGENTS.md` — add the new `## Boundaries` section described in Step 1.

## Notes
- `CLAUDE.md` must stay untouched — the whole point of this issue is keeping it a pointer while the real content lives in `AGENTS.md`.
- The six boundaries above are a starting set drawn from existing, already-documented conventions; if implementation surfaces additional undocumented-but-real boundaries, they can be added to the same section, but scope creep beyond what's grounded in an existing doc should be avoided.

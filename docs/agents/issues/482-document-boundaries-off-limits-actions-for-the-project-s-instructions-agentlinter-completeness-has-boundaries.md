# Issue: Document boundaries/off-limits actions for the project's instructions (Agentlinter completeness_has-boundaries)

## Description
Codacy's Agentlinter tool flags `CLAUDE.md:1` for having no boundaries or constraints defined — the agent isn't told what NOT to do. `CLAUDE.md`'s entire content is, by this project's own convention, a one-line pointer: `See AGENTS.md for project instructions.` (see the `init-claude` skill, which manages this pointer pattern repo-wide). `AGENTS.md` itself — the file that actually carries the project's conventions, agent table, and documentation map — likewise has no explicit "don't do X" section today.

## Problem
The finding is technically anchored on `CLAUDE.md`, but adding a boundaries section there would fight the project's own pointer-file convention. The substantive gap is in `AGENTS.md`: none of its instructions currently say what's off-limits, even though concrete boundaries already exist piecemeal across `docs/agents/architecture/` — they're just never collected in one place an agent session actually loads.

## Expected Behavior
- `AGENTS.md` gains an explicit `## Boundaries` section naming concrete off-limits actions for agents working in this repo, cross-linking to the architecture docs each one is drawn from.
- `CLAUDE.md` stays a pointer (no content duplicated into it), per the existing `init-claude`-managed convention.
- Re-running Agentlinter/Codacy shows the `completeness_has-boundaries` finding resolved (or knowingly accepted, with a note in this issue's PR explaining that `CLAUDE.md` is intentionally a pointer and the real boundaries live in `AGENTS.md`).

## Solution
Add a `## Boundaries` section to `AGENTS.md` (placed after the existing `## Agents` table, before `## Documentation`) listing concrete off-limits actions, each cross-linked to the architecture doc it's drawn from. Candidates identified from the repo's existing (but currently scattered) conventions:

- **Never hand-edit an auto-generated file.** `docs/agents/tag-mutations.md` and `docs/agents/architecture/entrypoint-migration-status.md` are both marked `<!-- AUTO-GENERATED, DO NOT EDIT BY HAND -->` — regenerate them via their documented `scripts/generate_*.sh` instead.
- **Never embed deterministic logic in skill markdown.** Parsing, mutation, validation, and anything that must produce the same output for the same input belongs in `<skill>/scripts/*.sh` or `arcanum/_lib/`, not in prose relying on AI judgment (see [Script Preference](docs/agents/architecture/script-preference.md)).
- **Never touch another specialist agent's owned scope directly.** Each agent in the `## Agents` table above owns a clearly bounded set of paths; cross-scope work is routed through the `architect` agent instead of reached into directly (see [Agent Roster and Architect Delegation](docs/agents/architecture/agent-roster-and-delegation.md)).
- **Never run a bare git-mutating command trusting ambient cwd.** `git add`/`commit`/`checkout`/`merge`/`push`/`fetch`/`rm`/`branch` must always be scoped explicitly to the resolved `REPO_PATH` (`git -C "$REPO_PATH" ...` or a script's `repo_path_enter`) — never re-derived from `pwd` partway through a run (see [Repo Path Threading](docs/agents/architecture/repo-path-threading.md)).
- **Never mutate shared JSON state without the lock sequence.** Files like the `auto-fix-all` queue must go through the write/mutate/release lock sequence, never a direct write (see [Lock System](docs/agents/architecture/lock-system.md)).
- **Never preapprove broad or ad hoc destructive commands.** Only narrow, fixed, low-risk scripts common to most specialist dispatches are candidates for a permission-grant allowlist entry; agent-specific or ad hoc commands (arbitrary `git`/`gh` writes, build/test tooling) rely on the blocked-dispatch escalation path instead (see [Dispatch Permissions](docs/agents/architecture/dispatch-permissions.md)).

Delegate to the `architect` agent, since this is root-level project documentation spanning more than one agent's scope.

## Benefits
- Gives every agent session an explicit, cross-linked list of what's off-limits, reducing the chance of an agent taking an action (bypassing another agent's scope, hand-editing a generated file, running an unscoped git command, etc.) the project never intended to allow.
- Surfaces conventions that already exist but are scattered across `docs/agents/architecture/` into the one file every agent session actually loads (`AGENTS.md`).
- Clears the `completeness_has-boundaries` Codacy finding.

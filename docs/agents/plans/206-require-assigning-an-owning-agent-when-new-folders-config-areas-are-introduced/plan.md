# Plan: Require assigning an owning agent when new folders/config areas are introduced

Issue: [206-require-assigning-an-owning-agent-when-new-folders-config-areas-are-introduced.md](../issues/206-require-assigning-an-owning-agent-when-new-folders-config-areas-are-introduced.md)

## Overview

Add a mandatory ownership check to both issue-definition skills (`discuss-issue`, `enhance-issue`): whenever an issue introduces a new top-level (root) repo folder, the dialogue must resolve to an explicitly named owning agent — never silently defaulting because no specialist obviously fits. As an immediate side-effect, also close the concrete gap that motivated this issue: extend `architect`'s documented scope from `.github/copilot-instructions.md` to all of `.github/`, since `.github/workflows/` (the file that originally went unrouted in #200) no longer exists but the rest of `.github/` was still undocumented.

## Context

Follow-up from #200: the #192 plan routed a `.github/workflows/core-ci.yml` fix to `infra` by guesswork, since `.github/workflows/**` wasn't listed as anyone's responsibility anywhere. Nothing today requires that when a new folder is introduced, someone also updates `docs/agents/` to say which agent owns it. See the issue file's `## Solution` section for the full resolved discussion (mechanism, trigger scope, no-owner-default policy, testing strategy).

## Architect steps (done directly, not dispatched — `docs/agents/**` and `.claude/agents/architect.md`'s own scope bullet are architect's own scope)

### Step 1 — Add the ownership checklist item to `docs/agents/issue-enhancement.md`

Add a new bullet to the checklist, matching the existing bullets' style (`- **<Label>** — <description>.`):

> - **New root-level folder?** — does this issue introduce a new top-level (root) folder in the repo? If so, name the exact agent that owns it now — extend an existing agent's scope, assign a new specialist, or deliberately record `architect` for genuinely cross-cutting/root-level doc-and-config folders (see `.github/` below for a worked example) — never leave it unanswered just because no specialist obviously fits. Update `docs/agents/architecture/agent-roster-and-delegation.md` and the owning agent's `.claude/agents/<name>.md` to reflect the decision.

### Step 2 — Add the same standing consideration to `discuss-issue`'s clarifying-question step

`discuss-issue/steps/discuss_and_save.md`'s step 4 ("Generate clarifying questions") is `skill-writer`'s file — see [skill-writer.md](skill-writer.md) for that half of the work. This step exists here only to note the two edits must stay in sync in substance (same trigger: root-level folders only; same no-silent-default rule) even though they're phrased for each skill's own flow.

### Step 3 — Extend `architect`'s own scope bullet to cover all of `.github/`

In `.claude/agents/architect.md`'s `## Your scope` list, change:

```
- Root-level files: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`
```

to:

```
- Root-level files: `README.md`, `AGENTS.md`, `CLAUDE.md`, `.github/` (all files — commit/PR templates, `copilot-instructions.md`, and any future files such as CI workflows, unless/until that grows enough to warrant a dedicated specialist)
```

No change needed in `docs/agents/architecture/agent-roster-and-delegation.md`'s roster table — that table only lists specialist agents (`scripter`, `skill-writer`, `skill-reviewer`, `node`, `infra`); `architect`'s own scope is documented solely in `.claude/agents/architect.md`.

## Specialist agents involved

- [skill-writer](skill-writer.md) — adds the matching ownership-check consideration to `discuss-issue/steps/discuss_and_save.md`'s clarifying-question step.

## Files to Change

- `docs/agents/issue-enhancement.md` — add the ownership checklist item (architect, Step 1 above).
- `.claude/agents/architect.md` — extend the "Root-level files" scope bullet to cover all of `.github/` (architect, Step 3 above).
- `discuss-issue/steps/discuss_and_save.md` — add the matching standing consideration to step 4 (skill-writer, see [skill-writer.md](skill-writer.md)).

## Notes

- Plan-time enforcement (a matching check in `auto-plan-issue`'s agent-selection step) was explicitly deferred by the issue — out of scope for this plan. Catching the gap at issue-definition time already would have prevented #200's misroute.
- No `## CI Checks` section: this repo's only CI jobs (`test`/`checks` in `.circleci/config.yml`) run `core/`'s Node.js suite and are unaffected by these docs/skill-file changes.
- No script work: this is pure instruction-text/documentation — nothing deterministic to extract into a script, so `scripter` has no work here.

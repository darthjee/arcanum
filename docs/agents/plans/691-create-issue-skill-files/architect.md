# Architect Plan: Create-issue: skill files

Main plan: [plan.md](plan.md)

## Shared contracts

- Next-step rule: `arcanum-create-issue` → `/arcanum-split-issue <id>` when `EPIC=true`, otherwise `/discuss-issue <id>`; delivery: offer. Kind: interactive.
- `shipit` sentence: "`shipit` is never applied without an explicit human choice".
- Resolved open points: prompt 5 "Chat" keeps the run open (no report yet); older drafts only via "Other" (typed path), no paging; suggestions stay hardcoded.

## Implementation Steps

### Step 1 — List the new skill in the docs

- `README.md` — add a row for [`/arcanum-create-issue`](arcanum-create-issue/) to "Available skills", next to `/enhance-issue` (interview-driven creation of a new GitHub issue with labels; Epic issues routed to `/arcanum-split-issue`).
- `docs/agents/folder-structure.md` — drop "(in progress, epic #687)" and "`SKILL.md` and `steps/` come with #691"; describe `SKILL.md` + `steps/start.md`, `explore.md`, `dialogue.md`, `publish.md`.
- `docs/agents/architecture/skill-finish.md` — add `arcanum-create-issue | interactive` to Scope, the next-step row to the map, and a note: Epic-based choice, applied labels go in the summary (not `--label-change`), `declined` names the draft path, prompt 5 "Chat" leaves the run open.
- `docs/agents/flow.md` / any pipeline doc listing entry points — mention `/arcanum-create-issue` as an entry point before `/discuss-issue` / `/arcanum-split-issue` where entry points are listed.
- `AGENTS.md` — only if it lists skills or native-only examples (it names `/arcanum-check-config` as the first native-only skill; add `/arcanum-create-issue` as a further example if it reads naturally).

### Step 2 — Spec status and shipit rule

- `docs/agents/specs/arcanum-create-issue.md` — Status: #691 shipped; "Skill flow", "Prompts" and "Label rules" (dialogue part) now in place. Move the three #691 open points out of "Open points" into the relevant sections as resolved decisions (see Shared contracts).
- `docs/agents/architecture/issue-tags.md` — rewrite the `shipit` paragraph opening ("is human-only: no script ever adds or removes...") to "`shipit` is never applied without an explicit human choice": no tag-mutation script adds or removes it (`tag_mutate.sh` still refuses it); the only path that sets it is `/arcanum-create-issue`'s publish, at creation, after the explicit prompt 6 confirmation. Also soften line 45's "the human-only `shipit` label" accordingly.

## Files to Change

- `README.md`
- `AGENTS.md` (only if applicable)
- `docs/agents/folder-structure.md`
- `docs/agents/flow.md` (only if it lists entry points)
- `docs/agents/architecture/skill-finish.md`
- `docs/agents/architecture/issue-tags.md`
- `docs/agents/specs/arcanum-create-issue.md`

## Notes

- Do not edit `docs/agents/tag-mutations.md` by hand (scripter regenerates it).
- `auto-fix-all/steps/process_one_issue.md` line 81 still says "`shipit` is human-only ... no script ever adds or removes it"; that remains true for the auto-fix-all pipeline and is left unchanged.

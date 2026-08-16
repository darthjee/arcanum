# Issue: Split docs/agents/architecture.md into a docs/agents/architecture/ hub of per-topic files

## Description
`docs/agents/architecture.md` is by far the largest doc in `docs/agents/` — 246 lines / ~54KB, several times the size of every other file in that folder combined (`folder-structure.md` is next largest at ~5.9KB). It documents arcanum's internals as a series of dense, long-paragraph sections (repo layout, install/release pipeline, script preference, agent roster, architect delegation, repo path threading, shared state & config files, branch bootstrap, cross-skill references, issue tags, lock system, per-repo migrations), and it keeps growing every time a new feature is documented — most recently while enhancing #160 (a new global/cross-project config layer), which would have added yet another subsection to an already large file.

This idea came up while enhancing #160: rather than fold more content into an already-large single file, `architecture.md` should be broken into `docs/agents/architecture/*.md` files by topic, with `docs/agents/architecture.md` itself becoming a hub/index that links out to each. It's spun out as its own issue instead of being done inside #160 — same reasoning that spun #160 out of #156 — because it has its own blast radius, reviewability concerns, and design decisions (see Problem/Solution below).

## Problem
- **Blast radius.** 20 files across the repo reference `docs/agents/architecture.md` today (skills under `discuss-issue/`, `plan-issue/`, `auto-plan-issue/`, `init-claude/`, `.claude/agents/architect.md`, `AGENTS.md`, other `docs/` guides, `arcanum/_lib/*.sh` script comments — confirmed via `grep -rln "architecture\.md"`). None currently use markdown anchors (`architecture.md#section`), only quoted section names (e.g. "see architecture.md's 'Per-Repo Migrations' section"), which lowers risk but still means every one of those references needs auditing and updating to point at the right new file once sections move.
- **Reviewability.** Mixing "move a lot of existing text around" with "add new feature content" in the same PR makes it hard to tell what moved vs. what's genuinely new. Splitting should land as its own, mechanically-reviewable change.
- **The split design itself is a real decision** — how many files, which topic boundaries, naming conventions, and whether `architecture.md` keeps a short summary per topic or becomes a pure table of contents — worth its own dialogue rather than a rushed footnote inside another issue.
- **Incidental finding:** the current file is also inconsistently bilingual — the "Overview" through "Script Preference" sections are written in Portuguese, everything after in English. This split is an opportunity to normalize those sections to English as they move (see Solution below).

## Expected Behavior
- `docs/agents/architecture/` exists, containing one `.md` file per major topic, split along the boundaries decided during planning.
- `docs/agents/architecture.md` becomes a hub/index: a short intro plus links into each `docs/agents/architecture/*.md` file.
- Every one of the ~20 existing references to `docs/agents/architecture.md` across the repo is audited and updated to point at the correct topic file (or left pointing at the hub, where a reference is genuinely repo-wide rather than topic-specific).
- No content is lost or altered in meaning during the move — this is a mechanical reorganization, not a rewrite, aside from translating the Portuguese sections to English as they relocate.

## Solution
- Decide split boundaries — candidate topics visible in the current file include: repo layout & install/release pipeline, script preference, agent roster & architect delegation, repo path threading, shared state & configuration files, branch bootstrap & safe-branch parking, cross-skill references, issue tags, lock system, per-repo migrations.
- Create `docs/agents/architecture/` with one `.md` file per topic.
- Turn `docs/agents/architecture.md` into a hub/index: short intro + links into each `docs/agents/architecture/*.md` file (exact shape — pure TOC vs. TOC with one-paragraph summaries per topic — to be decided during planning).
- Audit and update every existing reference to `docs/agents/architecture.md` across the repo (skills, other docs, script comments — 20 files as of this writing) so each one points at the right topic file instead of the old monolith.
- Normalize the Portuguese sections to English while moving them (opportunistic, since those sections are being touched anyway) — scoped to sections that move; not a repo-wide translation sweep.
- Leave the question of whether this pattern should extend to other `docs/agents/*.md` files for a later issue — `architecture.md` is the only file significantly larger than the rest today.

## Benefits
- **Reviewability.** Future doc additions land in a small, focused topic file instead of growing one already-huge file, keeping diffs reviewable.
- **Navigability.** Readers and agents can jump straight to the topic they need via the hub, instead of scanning a 246-line file.
- **Precedent.** Establishes a pattern to reuse if/when another `docs/agents/*.md` file grows large enough to warrant the same treatment.

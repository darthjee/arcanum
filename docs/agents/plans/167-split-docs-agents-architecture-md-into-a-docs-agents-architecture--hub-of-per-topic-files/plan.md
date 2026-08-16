# Plan: Split docs/agents/architecture.md into a docs/agents/architecture/ hub of per-topic files

Issue: [167-split-docs-agents-architecture-md-into-a-docs-agents-architecture--hub-of-per-topic-files.md](../issues/167-split-docs-agents-architecture-md-into-a-docs-agents-architecture--hub-of-per-topic-files.md)

## Overview

Split the current 246-line `docs/agents/architecture.md` into eleven per-topic files under a new `docs/agents/architecture/` folder, mirroring the file's existing `##` section boundaries with two small merges and one dedup (see below). `docs/agents/architecture.md` itself becomes a hub: a short intro plus a table of contents with a one-line summary per topic file. Every internal cross-reference inside the old file (`see "X" above/below`) is rewritten as a markdown link to the right topic file (or kept as an in-file anchor when both ends land in the same new file). Every one of the ~14 external references to `docs/agents/architecture.md`'s specific sections is then updated to point at the right topic file; references that generically illustrate "an architecture doc" (not this repo's file) or that belong to `init-claude`'s generic per-repo scaffolding are left untouched (see "Out of scope" below).

## Context

`docs/agents/architecture.md` mixes many unrelated subsystems in one continuously-growing document and is inconsistently bilingual (its first few sections are in Portuguese, the rest in English). This plan also normalizes the Portuguese sections to English as they move, and dedupes "Lógica determinística"/"Script Preference" — two sections that say the same thing in the two languages — into a single English section. No other doc's language is touched.

## Split boundaries (final)

New folder: `docs/agents/architecture/`. One file per row; "Source section(s)" refers to the current `docs/agents/architecture.md`'s `##`/`###` headings.

| New file | Source section(s) |
|---|---|
| `overview-and-layout.md` | Overview, Source Code Layout |
| `install-and-release.md` | Install & Release Pipeline (incl. Update subsection) |
| `script-preference.md` | Lógica determinística + Script Preference, merged/deduped into one English section |
| `agent-roster-and-delegation.md` | Agent Roster, Architect Delegation |
| `repo-path-threading.md` | Repo Path Threading |
| `shared-state-and-configuration.md` | Shared State & Configuration Files |
| `branch-bootstrap-and-merge-conflicts.md` | Branch Bootstrap and Merge Conflicts (incl. "Safe-branch parking for GitHub-only skills" subsection) |
| `cross-skill-references.md` | Cross-Skill References |
| `issue-tags.md` | Issue Tags (incl. "Tag mutation primitives" subsection) |
| `lock-system.md` | Lock System |
| `per-repo-migrations.md` | Per-Repo Migrations (all subsections — internal cross-references here stay in-file, since the whole section moves as one file) |

## Implementation Steps

### Step 1 — Create `docs/agents/architecture/` and move content

For each row of the table above, cut the corresponding section(s) out of the current `docs/agents/architecture.md` verbatim and paste into the new file, giving each new file a top-level `# <Topic>` heading (drop the redundant `## `-level heading that section already had, promote it). Preserve internal formatting (tables, code fences, bold headers) exactly.

For `script-preference.md`: translate "Lógica determinística" to English and merge it with "Script Preference" into one section — they cover the same guideline (extract deterministic logic to scripts) in Portuguese and English respectively; keep the more detailed English wording as the base and fold in anything the Portuguese version says that the English one doesn't (there isn't much — check before dropping).

### Step 2 — Rewrite internal cross-references as cross-file links

Search the moved content for the internal references catalogued below and rewrite each as a markdown link to the target topic file (`[Repo Path Threading](repo-path-threading.md)` style — relative, since all topic files live in the same `docs/agents/architecture/` folder):

- `agent-roster-and-delegation.md`: two "see Repo Path Threading below" mentions → link to `repo-path-threading.md`.
- `repo-path-threading.md`: "see Per-Repo Migrations below" → `per-repo-migrations.md`; "see Cross-Skill References below" → `cross-skill-references.md`.
- `shared-state-and-configuration.md`: two "see Per-Repo Migrations below" mentions → `per-repo-migrations.md`; "see Branch Bootstrap and Merge Conflicts below" → `branch-bootstrap-and-merge-conflicts.md`; "per Repo Path Threading above" → `repo-path-threading.md`.
- `cross-skill-references.md`: "see Architect Delegation above" → `agent-roster-and-delegation.md`; "see Repo Path Threading above" → `repo-path-threading.md`.
- `per-repo-migrations.md`: internal "see X above/below" mentions (Manifest vs. legacy discovery, the `AI_INSTRUCTIONS` hand-off subsection, Dual-pointer version tracking, etc.) all stay as in-file references (`see "..." below` prose, or convert to anchors — either is fine) since the whole Per-Repo Migrations section moves as a single file.

Re-read each new file once done to confirm no dangling "above"/"below" phrasing points at content that actually moved to a different file.

### Step 3 — Turn `docs/agents/architecture.md` into a hub

Replace its content with:
- A short intro (1–2 sentences: what this hub is, that it links out to `docs/agents/architecture/*.md`).
- A table of contents: one row per topic file, linked, with a one-line summary of what it covers (chosen over a bare link-only TOC, since summaries let a reader — human or agent — pick the right file without opening several).

### Step 4 — Update external references

Update the following (grouped by file), each currently pointing at `docs/agents/architecture.md` with a quoted section name — repoint at the matching new topic file. None of these use markdown anchors today, so this is a plain text/link substitution, not anchor surgery.

| File | Current reference | New target |
|---|---|---|
| `AGENTS.md` (~line 16) | "see... 'Per-Repo Migrations' and 'Repo Path Threading' in docs/agents/architecture.md" | Split into two links: `docs/agents/architecture/per-repo-migrations.md` and `docs/agents/architecture/repo-path-threading.md` |
| `AGENTS.md` (~line 35) | Docs table row "Architecture — Source layout, modules, code style, and implementation guidelines." linking `docs/agents/architecture.md` | Keep the link (still valid — it's now the hub); refresh the description to something like "Hub linking to docs/agents/architecture/ — arcanum's internals by topic (source layout, agents, repo path threading, config, migrations, etc.)" |
| `discuss-issue/steps/issue_template.md` (~line 15) | "...docs/agents/architecture.md's 'Issue Tags' section" | `docs/agents/architecture/issue-tags.md` |
| `discuss-issue/steps/discuss_and_save.md` (~line 98) | "...docs/agents/architecture.md's 'Architect Delegation'" | `docs/agents/architecture/agent-roster-and-delegation.md` |
| `docs/agents/tag-mutations.md` (~line 5) | "See [architecture.md](architecture.md) for the narrative version." | `docs/agents/architecture/issue-tags.md` — that's the actual narrative counterpart now |
| `scripts/generate_tags_table.sh` (~line 363) | Generates the exact string above (keeps `tag-mutations.md` in sync) | Update the generated string identically, so a regeneration doesn't revert the link |
| `docs/guides/arcanum-repo-config.md` (~line 47) | "...docs/agents/architecture.md's 'Per-Repo Migrations' section" | `docs/agents/architecture/per-repo-migrations.md` |
| `.claude/agents/architect.md` (~line 47) | Docs table row `architecture.md \| Estrutura das skills e preferência por scripts` | Update description to reflect the hub (e.g. `Hub para docs/agents/architecture/ — arquitetura interna do arcanum, por tópico`) |
| `scripts/generate_tags_table.sh` / `docs/agents/folder-structure.md` (~lines 18, 19, 33) | Three mentions: per-repo migrations, install/release `curl \| bash` flow, skill folder structure "já descrita em architecture.md" | `docs/agents/architecture/per-repo-migrations.md`, `docs/agents/architecture/install-and-release.md`, `docs/agents/architecture/overview-and-layout.md` respectively |
| `docs/guides/arcanum-repo-version.md` (~lines 35, 39) | "...docs/agents/architecture.md's 'Per-Repo Migrations' section" (x2) | `docs/agents/architecture/per-repo-migrations.md` |
| `arcanum/_lib/agent_email.sh` (~line 11) | "docs/agents/architecture.md's 'Repo Path Threading' section" | `docs/agents/architecture/repo-path-threading.md` |
| `arcanum/_lib/commit_template.sh` (~line 13) | "docs/agents/architecture.md's 'Repo Path Threading'" | `docs/agents/architecture/repo-path-threading.md` |
| `arcanum/_lib/safe_branch.sh` (~lines 8, 14) | "docs/agents/architecture.md's" branch-bootstrap concern / "Repo Path Threading" | `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md` and `docs/agents/architecture/repo-path-threading.md` respectively |
| `arcanum/_lib/resolve_and_fetch.sh` (~line 44) | "docs/agents/architecture.md's 'Branch Bootstrap and Merge...'" | `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md` |

Re-run `grep -rln "architecture\.md" --exclude-dir=.git .` after this step and confirm every remaining hit is one of the intentionally-untouched cases below (Out of scope) — no stray unresolved reference to a section that moved.

### Step 5 — Sanity check

- `grep -rn "architecture\.md#"` should still return nothing (no anchors were introduced into external references — the repo's existing convention is quoted section names / whole-file links, and this plan preserves that for the hub-level references while pointing sub-references at the specific new files).
- Confirm `docs/agents/architecture.md` no longer contains any of the moved section headings.
- Confirm each new `docs/agents/architecture/*.md` file reads standalone (no unresolved "above"/"below" pointing outside itself, except the intentionally in-file ones inside `per-repo-migrations.md`).

## Out of scope (deliberately left unchanged)

- `plan-issue/steps/identify_project_folder.md` (~line 9) and `auto-plan-issue/steps/explore_codebase.md` (~line 9): both say "`docs/architecture.md`, `docs/agents/architecture.md`, or similar" as a *generic example* of where a target project's architecture doc might live — not a reference to this repo's own file. Left as-is.
- `init-claude/SKILL.md`, `init-claude/setup_docs_structure.md`, `init-claude/setup_architecture.md`, `init-claude/scripts/setup_docs_structure.sh`: these scaffold a single placeholder `docs/agents/architecture.md` for a *freshly initialized consumer repo*, unrelated to arcanum's own oversized file. A new repo doesn't need a pre-split hub. Left as-is; whether `init-claude` should ever scaffold a topic-folder hub for large target repos is a separate, future decision (not this issue's).

## Files to Change

- `docs/agents/architecture.md` — replaced with hub/index content.
- `docs/agents/architecture/overview-and-layout.md` — new.
- `docs/agents/architecture/install-and-release.md` — new.
- `docs/agents/architecture/script-preference.md` — new.
- `docs/agents/architecture/agent-roster-and-delegation.md` — new.
- `docs/agents/architecture/repo-path-threading.md` — new.
- `docs/agents/architecture/shared-state-and-configuration.md` — new.
- `docs/agents/architecture/branch-bootstrap-and-merge-conflicts.md` — new.
- `docs/agents/architecture/cross-skill-references.md` — new.
- `docs/agents/architecture/issue-tags.md` — new.
- `docs/agents/architecture/lock-system.md` — new.
- `docs/agents/architecture/per-repo-migrations.md` — new.
- `AGENTS.md` — update two references (Script Preference/Repo Path Threading table mention, and the docs table row's description).
- `discuss-issue/steps/issue_template.md` — repoint Issue Tags reference.
- `discuss-issue/steps/discuss_and_save.md` — repoint Architect Delegation reference.
- `docs/agents/tag-mutations.md` — repoint narrative-version link.
- `scripts/generate_tags_table.sh` — update the generated string to match.
- `docs/guides/arcanum-repo-config.md` — repoint Per-Repo Migrations reference.
- `.claude/agents/architect.md` — refresh docs table row description.
- `docs/agents/folder-structure.md` — repoint three references.
- `docs/guides/arcanum-repo-version.md` — repoint two Per-Repo Migrations references.
- `arcanum/_lib/agent_email.sh` — repoint comment.
- `arcanum/_lib/commit_template.sh` — repoint comment.
- `arcanum/_lib/safe_branch.sh` — repoint two comments.
- `arcanum/_lib/resolve_and_fetch.sh` — repoint comment.

## CI Checks

None apply — the only CI job (`.circleci/config.yml`'s `build-and-release`) is filtered to tag pushes only and never runs on this branch/PR. `scripts/check_tags_table.sh` (referenced by that job) checks `docs/agents/tag-mutations.md` is up to date with `scripts/generate_tags_table.sh`'s output; Step 4 above keeps them in sync by construction, so this is safe but worth a local sanity run:
- `scripts/generate_tags_table.sh` (compare output to the committed `docs/agents/tag-mutations.md` after Step 4's edit)

## Notes

- No specialist agent split: this is pure documentation/comment-reference restructuring, not new script logic (`scripter`'s mandate) or a post-PR bash-extraction review (`skill-reviewer`'s mandate) — it fits the architect's own scope ("project documentation... or any task that spans more than one agent's scope").
- The eleven-file boundary list and the hub's "TOC + one-line summary" shape were left open by the issue for this planning stage to decide (per discussion); both are now final per this plan, not open questions for implementation.
- `docs/agents/tag-mutations.md` is a generated file (`scripts/generate_tags_table.sh`, self-healing at every release via `scripts/bump-version.sh`) — its one `architecture.md` reference is edited at the generator-script level (Step 4), not by hand-editing the generated file alone, so a future regeneration doesn't silently revert it.
- Content is moved, not rewritten, except for: (a) translating "Lógica determinística" to English and merging it with "Script Preference", and (b) converting internal same-file "above"/"below" prose into cross-file markdown links where the two ends now live in different files. Everything else should be byte-for-byte identical to the source, to keep this PR mechanically reviewable (per the issue's own reviewability rationale).

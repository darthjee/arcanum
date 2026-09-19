# Skill-Writer Plan: Codacy: markdownlint MD033 cluster — inline HTML in markdown (18 findings, 10 files)

Main plan: [plan.md](plan.md)

## Shared contracts

None — see [plan.md](plan.md).

## Implementation Steps

### Step 1 — Backtick-wrap the bare placeholder in each `SKILL.md`'s `Agent(...)` prompt line

Five files each have one blockquote line of the shape `> Agent(subagent_type: "architect", prompt: "Read steps/run.md ... ARGUMENTS: <raw skill arguments> REPO_PATH: <resolved_path>")`. `<resolved_path>` is already backtick-wrapped in most of these; the flagged placeholder is `<raw skill arguments>` (markdownlint reports its element name as `raw`, since the tag-like regex stops at the first word). Wrap it in backticks: `` `<raw skill arguments>` ``.

`auto-fix-all/SKILL.md` is the exception — its equivalent line (line 34) is longer and has several more bare placeholders in the same sentence (`<id>`, `<n>` ×2, `<agent-name>`, `<description>`), not just one. Backtick-wrap every bare `<...>` placeholder on that line, matching how `` `<agent-name>`  `` etc. would read if written the same way as the other four files' single-placeholder fix.

After editing each file, confirm with `npx markdownlint-cli2 <file>` (this repo's `.markdownlint.json` is picked up automatically) that no MD033 error remains on the edited line — a local run before this fix found more flagged tags per file than the issue's summarized counts, so verify directly rather than trusting the exact per-file count from the issue.

## Files to Change

- `auto-fix-all/SKILL.md` — backtick-wrap all bare placeholders on the `Agent(...)` line (line 34 today)
- `auto-fix-issue/SKILL.md` — backtick-wrap `<raw skill arguments>` on the `Agent(...)` line (line 12 today)
- `auto-new-issue/SKILL.md` — backtick-wrap `<raw skill arguments>` on the `Agent(...)` line (line 12 today)
- `auto-plan-issue/SKILL.md` — backtick-wrap `<raw skill arguments>` on the `Agent(...)` line (line 12 today)
- `auto-rewrite-issue/SKILL.md` — backtick-wrap `<raw skill arguments>` on the `Agent(...)` line (line 12 today)

## Notes

- Do not touch the `<id1> <id2> ...` style placeholders inside YAML front matter (`description:` lines) or inside fenced ` ```bash ` blocks — markdownlint doesn't flag those (front matter and fenced code are already exempt from MD033), so they need no change.

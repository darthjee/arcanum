# Issue: Codacy: markdownlint MD033 cluster — inline HTML in markdown (18 findings, 10 files)

## Description

Codacy's markdownlint flags 18 findings (10 files) for raw inline HTML used inside Markdown content.

**Source:** Codacy quality issues, category BestPractice, severity **Info**, tool markdownlint (`markdownlint_MD033` — no-inline-html).

## Affected files (count in parentheses)

`.github/commit_message_template-2.0.md` (3), `.github/commit_message_template.md` (3), `auto-fix-all/SKILL.md` (1), `auto-fix-issue/SKILL.md` (1), `auto-new-issue/SKILL.md` (1), `auto-plan-issue/SKILL.md` (1), `auto-rewrite-issue/SKILL.md` (1), `docs/agents/architecture/agent-roster-and-delegation.md` (1), `init-claude/templates/commit_message_template-2.0.md` (3), `init-claude/templates/commit_message_template.md` (3).

Confirmed: `.github/commit_message_template.md` and `init-claude/templates/commit_message_template.md` are byte-identical, and likewise for the `-2.0` pair — genuinely duplicated content, not just superficially similar. Also confirmed none of the 18 sites are `<br>`-in-table cases; all are bare placeholder tags such as `<type>`, `<scope>`, `<id>`, `<agent-name>`.

## Expected Behavior

- The bodies of the four commit-message template files (`.github/commit_message_template.md`, `.github/commit_message_template-2.0.md`, `init-claude/templates/commit_message_template.md`, `init-claude/templates/commit_message_template-2.0.md`) are wrapped in a single fenced code block each, since their content is a literal template rather than prose. This resolves the 12 placeholder-tag findings across those 4 files in one change per file.
- The `.github/` and `init-claude/templates/` copies of each template are de-duplicated so there is one source of truth going forward, instead of two hand-synced copies.
- The remaining 6 bare placeholders in prose/blockquote lines (`auto-fix-all/SKILL.md`, `auto-fix-issue/SKILL.md`, `auto-new-issue/SKILL.md`, `auto-plan-issue/SKILL.md`, `auto-rewrite-issue/SKILL.md`, `docs/agents/architecture/agent-roster-and-delegation.md`) are wrapped in inline-code backticks, matching the convention already used for neighboring placeholders in the same lines (e.g. `` `<id>` `` right next to an unwrapped one).
- Re-running markdownlint/Codacy shows zero MD033 findings among these 10 files.

## Solution

1. **Commit-message templates (12 findings, 4 files):** wrap the full body of each of the 4 template files in one fenced code block. Confirmed these files are never parsed programmatically for their content — `arcanum/_lib/commit_template.sh` only checks for their *existence* to pick "new" vs "old" template shape — so reformatting the body is safe.
2. **De-duplication (in scope for this issue):** `.github/commit_message_template.md` / `init-claude/templates/commit_message_template.md` are byte-identical (same for the `-2.0` pair). Make one location the source of truth — e.g. have `init-claude/scripts/setup_templates.sh` or an equivalent mechanism keep arcanum's own `.github/` copies in sync with `init-claude/templates/` — so future edits are made once. The exact mechanism (symlink, generation step, or a drift-checking test) is left to the planning phase.
3. **Prose placeholders (6 findings, 6 files):** in `auto-fix-all/SKILL.md`, `auto-fix-issue/SKILL.md`, `auto-new-issue/SKILL.md`, `auto-plan-issue/SKILL.md`, `auto-rewrite-issue/SKILL.md`, and `docs/agents/architecture/agent-roster-and-delegation.md`, wrap each bare `<placeholder>` in inline-code backticks, consistent with how neighboring placeholders in the same lines/files already appear.

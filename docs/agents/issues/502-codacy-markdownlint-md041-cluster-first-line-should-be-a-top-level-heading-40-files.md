# Issue: Codacy: markdownlint MD041 cluster — first line should be a top-level heading (40 files)

## Description
Codacy's markdownlint flags 40 files where the first line isn't a top-level (`#`) heading — `SKILL.md` files, `.claude/agents/*.md` files, literal templates, redirect stubs, and a few genuinely headingless step/instruction files.

**Source:** Codacy quality issues, category BestPractice, severity **Info**, tool markdownlint (`markdownlint_MD041` — first-line-heading).

## Problem
The 40 files fall into four distinct buckets, each needing a different fix:

1. **~24 `SKILL.md` / `.claude/agents/*.md` files** — use a `name:` frontmatter key instead of `title:`, which markdownlint's default `front_matter_title` regex does not recognize as satisfying MD041.
2. **7 literal template files** (`.github/pull_request_template.md`, `.github/commit_message_template.md`, `.github/commit_message_template-2.0.md`, `init-claude/templates/pull_request_template.md`, `init-claude/templates/commit_message_template.md`, `init-claude/templates/commit_message_template-2.0.md`, `auto-fix-all/templates/reply.tmpl.md`) — their content is substituted verbatim into real commit messages, PR bodies, and GitHub reply comments. Adding a `# Title` line would inject unwanted heading text into that generated output.
3. **`CLAUDE.md` and `.github/copilot-instructions.md`** — deliberate 1-line redirect stubs to `AGENTS.md` (see #498). Already excluded from all Codacy analysis via `.codacy.yml`'s `exclude_paths` (merged a few hours after this issue was filed), so these 2 findings are effectively moot for Codacy, but `.markdownlint.json` has no matching exclusion for local/non-Codacy runs.
4. **7 genuinely headingless files** — `arcanum/migrations/repos/0.13.0/002.instructions.md` and 6 `steps/run.md` files (`auto-fix-issue`, `auto-monitor-issue-pr`, `auto-monitor-pr`, `auto-new-issue`, `auto-plan-issue`, `auto-rewrite-issue`) — these lack a heading unlike their sibling step files (e.g. `discuss-issue/steps/discuss_and_save.md` already starts with `# Discuss and Save Issue`).

## Expected Behavior
- Re-running markdownlint/Codacy shows zero MD041 findings among these 40 files.
- Templates that are substituted verbatim into real output (commit messages, PR bodies, reply comments) are never modified to add a heading — doing so would corrupt that output.
- The frontmatter/redirect/template exclusions are documented inline in `.markdownlint.json`, mirroring the existing precedent in `.codacy.yml` (see #498, #500).

## Solution
1. Extend `.markdownlint.json`'s `front_matter_title` option to also match a `name:` frontmatter key (not just `title:`), resolving MD041 for all `SKILL.md` and `.claude/agents/*.md` files without touching their content.
2. Add the 7 literal template files to `.markdownlint.json` exclusions, with a comment explaining why (verbatim output).
3. Add `CLAUDE.md` and `.github/copilot-instructions.md` to `.markdownlint.json` exclusions, with a comment cross-referencing #498 and its `.codacy.yml` precedent.
4. Add a real top-level `# Title` heading to the remaining 7 genuinely headingless files, matching the heading style already used by sibling files in the same skill.

## Benefits
- Resolves all 40 Codacy MD041 findings without corrupting any literally-substituted template output.
- Establishes a documented, reusable `.markdownlint.json` exclusion/config pattern consistent with the existing `.codacy.yml` precedent.

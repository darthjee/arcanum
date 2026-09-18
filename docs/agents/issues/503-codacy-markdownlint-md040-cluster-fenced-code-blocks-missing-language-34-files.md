# Issue: Codacy: markdownlint MD040 cluster — fenced code blocks missing language (34 files)

## Description

Codacy's markdownlint flags 34 findings across 34 files with fenced code blocks that don't specify a language (e.g. plain ``` instead of ```bash), which disables syntax highlighting. This is one finding per file — confirmed directly against Codacy (`markdownlint_MD040`, 34 results, one per distinct file path).

**Source:** Codacy quality issues, category CodeStyle, severity **Info**, tool markdownlint (`markdownlint_MD040` — fenced-code-language).

### Affected files (1 finding each)

`.claude/agents/skill-reviewer.md`, `AGENTS.md`, `README.md`, `arcanum-split-issue/steps/fetch.md`, `arcanum-split-issue/steps/split.md`, `auto-fix-all/steps/handle_comment.md`, `auto-fix-all/steps/process_one_issue.md`, `discuss-issue/steps/discuss_and_save.md`, `discuss-issue/steps/extract_id_and_name.md`, `docs/agents/architecture/dispatch-permissions.md`, `docs/agents/architecture/overview-and-layout.md`, `docs/guides/arcanum-global-config.md`, `docs/guides/arcanum-repo-config.md`, `enhance-issue/steps/fetch.md`, `init-claude/SKILL.md`, `init-claude/scenario_agents_claude.md`, `init-claude/scenario_agents_copilot.md`, `init-claude/scenario_agents_only.md`, `init-claude/scenario_all_present.md`, `init-claude/scenario_both_no_agents.md`, `init-claude/scenario_claude_only.md`, `init-claude/scenario_copilot_only.md`, `init-claude/scenario_new.md`, `init-claude/setup_agents.md`, `init-claude/setup_arcanum_split_issue.md`, `init-claude/setup_architecture.md`, `init-claude/setup_contributing.md`, `init-claude/setup_docs_structure.md`, `init-claude/setup_folder_structure.md`, `init-claude/setup_issue_enhancement.md`, `init-claude/setup_labels.md`, `init-claude/setup_permissions.md`, `init-claude/setup_templates.md`, `plan-issue/steps/write_and_confirm.md`.

## Expected Behavior

- Every fenced code block in the listed files specifies a language (`bash`, `text`, `json`, etc. as appropriate) or `text` when it's plain output/no syntax.
- Re-running markdownlint/Codacy shows zero MD040 findings among these files.

## Solution

Sweep all 34 listed files adding the appropriate language tag to the flagged fence — mostly ```bash``` for shell snippets and ```text``` for example output/transcripts — matching each block's actual content.

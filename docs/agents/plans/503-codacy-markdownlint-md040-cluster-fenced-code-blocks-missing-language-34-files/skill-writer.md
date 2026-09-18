# skill-writer Plan: Codacy: markdownlint MD040 cluster — fenced code blocks missing language (34 files)

Main plan: [plan.md](plan.md)

## Shared contracts

Change the bare ` ``` ` opening fence at each flagged line to ` ```text `, and nothing else. Every block below was inspected and confirmed to be a message template, ASCII tree, or structured report/log format — not an executable command — so `text` is correct for all of them.

## Implementation Steps

### Step 1 — Add `text` to the flagged opening fence in each of the 27 skill files

For each file below, open it at the given line and change that line's ` ``` ` to ` ```text `. Leave the matching closing fence (plain ` ``` `) as-is — markdownlint only requires the language on the opening fence.

## Files to Change

- `plan-issue/steps/write_and_confirm.md:79` — opening fence for the "Does this approach look correct?" prompt
- `init-claude/setup_architecture.md:21` — opening fence for the "Which folder contains the main application source code?" prompt
- `init-claude/scenario_all_present.md:9` — opening fence for the AGENTS.md/CLAUDE.md/copilot-instructions consolidation message
- `arcanum-split-issue/steps/split.md:19` — opening fence for the sub-issue confirmation prompt
- `init-claude/setup_permissions.md:7` — opening fence for the wait_ci_and_merge.sh permission prompt
- `init-claude/scenario_agents_claude.md:9` — opening fence for the AGENTS.md+CLAUDE.md consolidation message
- `init-claude/setup_agents.md:16` — opening fence for the ".claude/agents/" setup intro message
- `init-claude/setup_contributing.md:20` — opening fence for the "main programming language" prompt
- `init-claude/setup_templates.md:19` — opening fence for the PR/commit template explanation message
- `auto-fix-all/steps/handle_comment.md:62` — opening fence for the `OUTCOME=blocked ...` report format
- `init-claude/scenario_both_no_agents.md:9` — opening fence for the CLAUDE.md/copilot-instructions consolidation message
- `init-claude/setup_issue_enhancement.md:13` — opening fence for the issue-enhancement checklist prompt
- `init-claude/scenario_claude_only.md:9` — opening fence for the CLAUDE.md migration message
- `init-claude/setup_arcanum_split_issue.md:13` — opening fence for the arcanum-split-issue checklist prompt
- `enhance-issue/steps/fetch.md:31` — opening fence for the "What is the GitHub issue number to enhance?" prompt
- `init-claude/scenario_copilot_only.md:9` — opening fence for the copilot-instructions migration message
- `init-claude/SKILL.md:38` — opening fence for the "scenario not yet implemented" message
- `arcanum-split-issue/steps/fetch.md:40` — opening fence for the "What is the GitHub issue number to split?" prompt
- `init-claude/setup_folder_structure.md:47` — opening fence for the "proposed docs/agents/folder-structure.md" prompt
- `init-claude/setup_labels.md:35` — opening fence for the "change the label list, or skip" prompt (indented fence — keep the existing indentation, only insert `text` after the backticks)
- `init-claude/scenario_agents_only.md:9` — opening fence for the AGENTS.md-only message
- `init-claude/scenario_agents_copilot.md:9` — opening fence for the AGENTS.md+copilot-instructions consolidation message
- `init-claude/setup_docs_structure.md:26` — opening fence for the "Fill in architecture.md and flow.md" message
- `discuss-issue/steps/discuss_and_save.md:52` — opening fence for the "Did I comprehend the issue?" prompt
- `init-claude/scenario_new.md:9` — opening fence for the "No configuration files found" message
- `auto-fix-all/steps/process_one_issue.md:5` — opening fence for the `OUTCOME=merged` report format
- `discuss-issue/steps/extract_id_and_name.md:23` — opening fence for the "What is the GitHub issue number to discuss?" prompt

## Notes

- `init-claude/setup_labels.md:35` is nested inside a bullet list, so its fence is indented two spaces (`  ```` `). Preserve the indentation exactly — only add `text` after the triple backtick.
- After edits, spot-check a couple of files by eye (rendered fence should read ` ```text `) rather than relying on grep alone, since a couple of files have more than one fence and the wrong one must not be touched.

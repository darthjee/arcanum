# Plan: Skill finish: spec

Issue: [659-skill-finish-spec.md](../../issues/659-skill-finish-spec.md)

## Overview

Write `docs/agents/specs/skill-finish.md`. It is the forward-looking design for how the eight in-scope issue skills finish:
- a closing report rendered by a shared `arcanum/_lib` script;
- a `/dev/tty` next-step offer for interactive skills;
- a `Next:` line for auto skills;
- outermost-only reporting for nested runs.

This is documentation only. No skill or script changes here. Sub-issues #660–#667 implement the spec, and #668 removes it.

## Context

Parent: #658. The decisions settled during discussion are recorded in the issue file:
- shared `_lib` report script;
- `/dev/tty` offer that always shows the exact next command;
- accepting invokes the next skill inline, and declining leaves the shown command as the manual path;
- auto skills never prompt;
- nested runs hand their data to the caller, and only the outermost skill reports.

Each skill ends today at:
- `discuss-issue/steps/discuss_and_save.md` §8
- `enhance-issue/steps/publish.md` §4
- `plan-issue/steps/write_and_confirm.md` "Offer to open the PR"
- `arcanum-split-issue/steps/push.md`
- `auto-new-issue/steps/commit_and_sync.md`
- `auto-plan-issue/steps/run.md` Step 6
- `auto-fix-issue/steps/open_pr.md` "Report"
- `auto-rewrite-issue/SKILL.md`

Nested callers:
- `auto-fix-all/steps/process_one_issue.md` runs `auto-new-issue`, `auto-plan-issue` and `auto-fix-issue`.
- `discuss-issue/steps/discuss_and_save.md` §8 runs `auto-plan-issue`.

## Implementation Steps

### Step 1 — Write `docs/agents/specs/skill-finish.md`

Follow the shape of `docs/agents/specs/shell-engine-removal.md`. Sections:

- **Status**: Proposed, not implemented. Name the tracking issues: #658, #660–#667 and #668.
- **Goal**: one standard ending for the eight in-scope skills. List the out-of-scope skills.
- **Closing report**:
  - The exact block format: outcome/status line, links (issue, PR, sub-issues), and label changes (before → after), plus an optional `Next:` line.
  - Behavior on each exit path: success, declined, failed.
  - One example rendering.
- **Report script interface**: the name (e.g. `arcanum/_lib/finish_report.sh`), the explicit `repo_path` first argument, flags or args for status, links, labels and next command, and the output format and exit codes.
  - Decide whether it follows the engine shim pattern (`finish_report.sh` → `engine_dispatch.sh` → `finish_report_shell.sh` / native `core/bin/arcanum` command), per `docs/agents/architecture/script-engine.md`.
  - Take `docs/agents/specs/shell-engine-removal.md` into account.
- **Next-step offer (interactive)**:
  - A shared `/dev/tty` script (e.g. `arcanum/_lib/next_step_prompt.sh`) modeled on `arcanum/migrations/run.sh`: `[Y]es` / `[N]o` / `[C]hat`, and an explicit `--repo <path>`.
  - The prompt text always shows the exact next command.
  - Output protocol: e.g. `CHOICE=yes|no|chat` and exit codes, including a `[C]hat` hand-off like the exit-`3` convention in `per-repo-migrations.md`.
  - The skill-side rules: yes means invoke the next skill inline, no means end after the report, chat means return to the conversation.
- **Auto skills**: never prompt. The report ends with `Next: <command>`.
- **Nested runs**:
  - How a skill knows it is nested. Recommend an explicit signal passed by the caller, e.g. a `NESTED` marker in the invocation prompt or an argument, never inferred from the environment.
  - The result data a nested run hands back: status, links and label changes, in `KEY=value` form.
  - The outermost skill merges this data into its own single report.
- **Next-step map**: a table with one row per skill: skill, next command, and whether the offer is interactive or `Next:`-only. Rows for split (multiple sub-issues) and auto-rewrite (multiple issues) list one command per issue.
- **Implementation order and ownership**:
  - `scripter` (and `node`, if the native path is in scope) builds the `_lib` scripts first.
  - Then `skill-writer` applies them in #660–#667.
  - #668 removes the spec and moves lasting rules into `docs/agents/architecture/`.

### Step 2 — Link the spec

Add `skill-finish.md` as an example next to `shell-engine-removal.md` in the `docs/agents/specs/` row of `docs/agents/folder-structure.md`, if that row lists examples. Leave the Specs row in `AGENTS.md` unchanged: it points at the folder, not at individual files.

## Files to Change

- `docs/agents/specs/skill-finish.md`: new spec (Step 1)
- `docs/agents/folder-structure.md`: mention the new spec in the specs row (Step 2)

## CI Checks

- The CircleCI jobs cover `core/` (tests, lint) and release packaging. None of them run on `docs/`-only changes.
- Codacy runs markdownlint on the PR. Keep the new markdown clean, in particular MD060 table formatting, which recent fixes (#649–#651) addressed.

## Notes

- This work is owned by `architect` (project documentation). No specialist dispatch is needed.
- Keep the script interfaces precise: exact names, arguments, output keys and exit codes. #660–#667 are implemented independently and must agree on them.
- Open point for the spec to settle: whether the `_lib` scripts need a native (`core/`) implementation from day one or can start shell-only, given the shell-engine removal plan.

# Issue: Skill finish: spec

## Description
Write `docs/agents/specs/skill-finish.md`, the spec that defines how issue skills finish. Parent: #658. Each per-skill sub-issue (#660–#667) implements against this spec, and #668 removes it afterwards.

## Problem
Issue skills end inconsistently. Each has its own closing output and its own follow-up question, if any. The next pipeline step is easy to miss, and there's no single definition that the per-skill changes can follow.

## Expected Behavior
The spec defines:
- the closing report format: outcome/status, links, label changes;
- the next-step map for each in-scope skill;
- the next-step offer for interactive skills, and its prompt mechanism;
- the `Next:` line for auto skills, which never prompt;
- the shared scripts and their interfaces;
- how nested runs finish.

In scope: `discuss-issue`, `enhance-issue`, `plan-issue`, `arcanum-split-issue`, `auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`, `auto-rewrite-issue`.

## Solution
Decisions the spec must encode:

- **Report rendering: shared `arcanum/_lib` script.** A script such as `arcanum/_lib/finish_report.sh` takes the outcome/status, links (issue, PR, sub-issues) and label changes (before → after). It prints the fixed closing block. It also takes an optional next command, printed as the `Next:` line for auto skills. Skills never hand-format the report. This follows [Script Preference](docs/agents/architecture/script-preference.md).
- **Interactive next-step offer: `/dev/tty` script.** A shared script prompts directly in the terminal, following the `arcanum-migrate` convention in [Per-Repo Migrations](docs/agents/architecture/per-repo-migrations.md): `[Y]es` / `[N]o` / `[C]hat`, with an explicit `--repo <path>`.
  - The prompt always **shows the exact command** of the next step, e.g. `/discuss-issue 123`. The user can decline and run it manually later.
  - The script prints the choice for the skill to act on.
- **On accept: invoke inline.** The skill runs the next skill in the same session, as `plan-issue` → `/auto-fix-issue` does today. On decline, the skill ends after the report, and the command shown is the user's manual path.
- **Auto skills never prompt.** Their report includes `Next: <command>`.
- **Nested runs: the outermost skill reports.** An auto skill run inside another skill skips its own report and `Next:` line, and hands its result data to the caller. Examples: `auto-fix-all` runs `auto-new-issue`/`auto-plan-issue`/`auto-fix-issue`, and `discuss-issue` runs `auto-plan-issue`. Only the top-level skill prints the final report. The spec defines how a skill knows it is nested (e.g. an explicit flag or argument from the caller) and the shape of the data it hands back.
- **Next-step map**: one entry per in-scope skill, naming the next command. The starting proposal comes from the sub-issues:
  - enhance → `/discuss-issue`
  - discuss → plan, then `/auto-fix-issue`
  - plan → `/auto-fix-issue`
  - split → `/enhance-issue` or `/discuss-issue` for each sub-issue
  - auto-new → `/auto-plan-issue`
  - auto-plan → `/auto-fix-issue`
  - auto-fix → `/auto-monitor-issue-pr`
  - auto-rewrite → `/discuss-issue`
- **Ownership**: `scripter` owns the `_lib` scripts, `skill-writer` owns the skill step changes, and `architect` owns the spec itself.

## Benefits
- A consistent, readable end to every issue-skill run
- The next pipeline step is always visible, and one keypress away
- A single deterministic implementation, instead of eight hand-written endings

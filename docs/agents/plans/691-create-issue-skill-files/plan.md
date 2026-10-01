# Plan: Create-issue: skill files

Issue: [691-create-issue-skill-files.md](../../issues/691-create-issue-skill-files.md)

## Overview

Write the `/arcanum-create-issue` skill (`SKILL.md` + `steps/start.md`, `explore.md`, `dialogue.md`, `publish.md`) on top of the native `start.sh`/`publish.sh` shims shipped in #690, modeled on `enhance-issue` (unchanged). Reword the `shipit` rule from "human-only and never mutated by any script" to "never applied without an explicit human choice" in the tag-table generator (and regenerate `tag-mutations.md`) and in `issue-tags.md`. Update the docs that list skills and resolve the spec's open points owned by #691.

## Agents involved

- [skill-writer](skill-writer.md)
- [scripter](scripter.md)
- [architect](architect.md)

## Shared contracts

The contract is [`docs/agents/specs/arcanum-create-issue.md`](../../specs/arcanum-create-issue.md). No new script is created by this issue; the skill only calls existing ones.

### Existing script calls (signatures already shipped, do not change)

All paths below are relative to `arcanum-create-issue/steps/` (the step file's directory).

- `../scripts/start.sh "$REPO_PATH" [--new | --resume <draft>]`
  - exit `0`: `STATUS=new|resumed`, `FILE=<draft path>`
  - exit `1`: `STATUS=error`, `ERROR=<message>` (gh not authenticated / no GitHub origin; no draft created)
  - exit `2`: invalid input (e.g. unknown `--resume` path)
  - exit `4`: `FALLBACK=chat` plus one `DRAFT=<path>\t<timestamp>\t<title or first line>` line per draft, most recent first
- `../scripts/publish.sh "$REPO_PATH" <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`
  - exit `0`: `STATUS=ok`, `ID=<n>`, `URL=<url>`, `LABELS=<comma-separated>`, `EPIC=true|false`, zero or more `WARNING=<note>`; or `STATUS=declined` + `CHOICE=no|chat` (TTY answered No/Chat at prompt 5)
  - exit `1`: `STATUS=failed`, `ERROR=<message>` (draft kept)
  - exit `2`: empty title/body or malformed label (nothing created)
  - exit `4`: `FALLBACK=chat` only. Which prompt is meant is derived from the flags passed: without `--confirmed` → prompt 5; with `--confirmed`, without `--shipit-confirmed`, and `shipit` among the labels → prompt 6.
- `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-create-issue --status success|declined|failed --summary "<one line>" [--issue <ID>]`
  - The applied labels go in the **summary text** (from `LABELS=`), never as `--label-change` (it only accepts canonical pipeline tags, so `Feature`/`Bug`/... would be a usage error).
  - Never `--next`, never `--nested` (interactive, never nested).
- `../../arcanum/_lib/next_step_prompt.sh --repo "$REPO_PATH" --command "<cmd>"` where `<cmd>` is `/arcanum-split-issue <ID>` when `EPIC=true`, otherwise `/discuss-issue <ID>`. Same contract and exit-4 handling as `enhance-issue/steps/publish.md` step 5.

### Next-step rule (documented by architect, implemented by skill-writer)

| Skill | Next command(s) | Delivery |
| --- | --- | --- |
| `arcanum-create-issue` | `/arcanum-split-issue <id>` when `EPIC=true`, otherwise `/discuss-issue <id>` | offer |

### Resolved open points (spec, owned by #691)

- Prompt 5 **Chat** returns to the conversation with the draft kept and the run still open: no closing report yet; the user can keep refining and publish later in the same run.
- More than three drafts: list the three most recent plus `Start a new issue`; older drafts are reachable only through the free-text "Other" answer by typing the path. No paging option.
- Label suggestions stay hardcoded (`Writting` default; `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic`, `shipit` suggested).

### `shipit` rule wording

New sentence, used verbatim by both scripter (generator) and architect (`issue-tags.md`): "`shipit` is never applied without an explicit human choice". `arcanum/_lib/tag_mutate.sh` and the native guard keep refusing `shipit` (unchanged, including their `human-only` error message strings and specs).

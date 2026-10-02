# arcanum-create-issue

`/arcanum-create-issue` turns an idea into a brand-new GitHub issue through an interview. It uses the same checklist dialogue as [`enhance-issue`](../../../enhance-issue/SKILL.md), but it starts from the user's idea instead of an existing issue. It builds a local draft and creates the issue, with its labels, only at the end.

## Overview

The skill has its own steps, modeled on `enhance-issue`. `enhance-issue` itself is not shared or changed.

| Step | Based on | What it does |
| --- | --- | --- |
| Start / resume ([`steps/start.md`](../../../arcanum-create-issue/steps/start.md)) | (new) | Creates a new draft, or resumes one, through `scripts/start.sh`. Nothing is fetched from GitHub. |
| Explore ([`steps/explore.md`](../../../arcanum-create-issue/steps/explore.md)) | `enhance-issue/steps/explore.md` | The same light codebase pass, run on the user's idea. |
| Dialogue ([`steps/dialogue.md`](../../../arcanum-create-issue/steps/dialogue.md)) | `enhance-issue/steps/dialogue.md` | The same checklist loop, from [Issue Enhancement](../issue-enhancement.md), plus two fixed items: **Epic?** and **Labels**. |
| Publish ([`steps/publish.md`](../../../arcanum-create-issue/steps/publish.md)) | `enhance-issue/steps/publish.md` | Creates the issue through `scripts/publish.sh`, then ends with the closing report and the next-step offer. |

- **No git.** The skill never commits, never checks out a branch and never checks for a dirty tree. The draft lives in `.claude/state/`, so there is no safe-branch checkout.
- **No spawning.** The dialogue never calls `spawn_issue.sh`, because there is no parent issue id yet. When the work has independent parts, the skill suggests marking the issue `Epic` and splitting it later with `/arcanum-split-issue`.
- **Finish.** The closing report and the Epic-based next step (`/arcanum-split-issue <id>` when `EPIC=true`, otherwise `/discuss-issue <id>`) are described in [Skill Finish](skill-finish.md).

## Draft file

- **Location**: `.claude/state/create-issue/<timestamp>.md`, which is git-ignored, so a draft is never committed by accident. The name is the UTC creation time (`YYYYMMDD-HHMMSS.md`, with a `-N` suffix if that name is taken), since there is no issue id or title yet.
- **Title**: the draft's first level-1 heading (`# Title`) is the issue title. Everything else is the body. `publish` gets the title as an argument and strips that heading line from the body.
- **Lifecycle**: created at the start of a fresh run and updated during the dialogue. It is deleted **only** after the GitHub issue is created. It is kept when the user abandons the run or the create fails. The next skill (`/discuss-issue` or `/arcanum-split-issue`) reads the issue from GitHub, not from the draft.
- **Resume**: when drafts exist, the run starts by asking whether to resume one or start fresh. Each draft is listed newest first, with its last-modified time, its age and its title (or its first line when it has no heading yet).
- **Cleanup**: none automatic. Stale drafts show up in the resume prompt and can be deleted by hand.

## Native commands

Both commands are native-only (see [Native-only entrypoints](script-engine.md#native-only-entrypoints)). Each is registered in `core/lib/core/commands.js` with `context: 'repo'`, and each has a thin shim in `arcanum-create-issue/scripts/` that calls `engine_dispatch --native-only`. Neither has a `*_shell.sh` twin, and neither is in `migration-status.json`. The code is in `core/lib/commands/arcanum-create-issue/`.

Output is `KEY=value` lines on stdout. Exit codes for both commands:

| Exit | Meaning |
| --- | --- |
| `0` | Success (`STATUS=new`, `STATUS=resumed` or `STATUS=ok`), or `STATUS=declined` from `publish`. |
| `1` | Runtime failure: `STATUS=error` (`start`) or `STATUS=failed` (`publish`), plus `ERROR=<message>`. |
| `2` | Invalid input: bad arguments, an unknown draft, a malformed label, or an empty title or body. `ERROR=<message>`, and nothing is created. |
| `4` | No `/dev/tty`: `FALLBACK=chat`. The skill asks with `AskUserQuestion` and reruns with a flag. |

| Key | Command | Meaning |
| --- | --- | --- |
| `STATUS` | both | `new`, `resumed`, `ok`, `declined`, `error` or `failed` |
| `CHOICE` | publish | `no` or `chat`, with `STATUS=declined` |
| `FILE` | start | The draft path |
| `DRAFT` | start | One existing draft, `<path>\t<timestamp>\t<title or first line>`, on exit `4` |
| `FALLBACK` | both | Always `chat`, on exit `4` |
| `ID`, `URL` | publish | The created issue |
| `LABELS` | publish | The labels actually applied, comma-separated |
| `EPIC` | publish | `true` when `Epic` is among `LABELS` |
| `WARNING` | publish | A non-fatal note; may repeat |
| `ERROR` | both | The failure message |

### `arcanum-create-issue-start`

Shim: `scripts/start.sh <repo_path> [--new | --resume <draft>]`

- **Preflight**: `origin` must be a `github.com` remote and a GitHub token must be available (`gh` is authenticated). On failure: `STATUS=error`, `ERROR=<message>`, exit `1`, and no draft is created.
- **No drafts**: creates a draft and prints `STATUS=new` and `FILE=<path>`.
- **Drafts exist, TTY available**: a `/dev/tty` menu lists them (`[N]ew` or a draft number), then prints `STATUS=new|resumed` and `FILE=<path>`.
- **Drafts exist, no TTY**: exit `4`, `FALLBACK=chat`, and one `DRAFT=` line per draft.
- `--new` creates a fresh draft without asking. `--resume <draft>` resumes that draft without asking. The path may be absolute or repo-relative, but it must be a `*.md` file directly inside the drafts folder; anything else exits `2`.

### `arcanum-create-issue-publish`

Shim: `scripts/publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`

- **Validation**: the draft must be known, the title and the body must not be empty, and every label must be well-formed (not blank, no comma, no newline). Otherwise exit `2`, and nothing is created.
- **Confirmations**: without `--confirmed`, it shows the title, the labels, whether it is an Epic and the body size, then asks `[Y]es / [N]o / [C]hat`. When `shipit` is among the labels and `--shipit-confirmed` is not given, it then asks a separate `shipit` question, which defaults to **No**. Without a TTY, either question exits `4`.
- **Declined**: **No** or **Chat** at the final confirmation creates nothing and keeps the draft. It prints `STATUS=declined` and `CHOICE=no` or `CHOICE=chat`, and exits `0`.
- **Labels**: resolved as in [Label rules](#label-rules) below.
- **Create**: the issue is created **with all its labels in one REST call** (`GithubIssueService.createWithLabels`), so an issue is never left partly labeled. The create is never retried, so a timeout never leaves a duplicate.
- **Success**: deletes the draft, then prints `STATUS=ok`, `ID=<n>`, `URL=<url>`, `LABELS=<comma-separated>` and `EPIC=true|false`, plus any `WARNING=` lines. If the draft cannot be deleted, it is still a success, with `WARNING=draft not deleted: <path>`.
- **Failure**: exit `1`, `STATUS=failed`, `ERROR=<message>`, and the draft is kept. A failed create tells the user to check GitHub before running again, since the issue may have been created anyway.

## Label rules

- **Any label is allowed.** The default and the suggestions are fixed in the skill steps, not read from `init-claude-config.json`:
  - **Default**: `Writting`, pre-selected but removable.
  - **Suggested**: `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic` and `shipit`.
- **Type labels** (`Documentation`, `Feature`, `Refactor`, `Bug`): the AI suggests any combination based on the discussion, and the user confirms or edits them in the **Labels** item.
- **`Epic`** is set through the **Epic?** item, which keeps it in sync with the label list.
- **`shipit`** is opt-in only. The AI never suggests it. It is applied only when the user asks for it and then confirms it at its own prompt. If it is not confirmed, it is dropped, the issue is created without it, and `publish` adds `WARNING=shipit not confirmed; the issue was created without it`. `arcanum/_lib/tag_mutate.sh` still refuses `shipit`; `publish` never goes through it, because the labels are set by the create call itself. See `shipit` in [Issue Tags](issue-tags.md).
- **Matching**: labels are matched case-insensitively against the repo's GitHub labels, using the existing spelling, and duplicates are removed (the first spelling wins).
- **Missing labels** are created before the issue (`Epic` as `fbca04`, any other label as `ededed`), each reported as `WARNING=created label <name>`. For `Epic`, the warning suggests running `/arcanum-migrate`.
- **Removing every label**, `Writting` included, is allowed. The issue is created with no labels, and `EPIC=false`.

## Prompts

| Interaction | Mechanism |
| --- | --- |
| Resume a draft or start a new one | `start.sh` on `/dev/tty`; on exit `4`, `AskUserQuestion`, then a rerun with `--new` or `--resume <draft>` |
| The idea, the checklist and its topics | Open chat, as in `enhance-issue` |
| **Epic?** and **Labels** | One `AskUserQuestion` call from the dialogue. These are draft choices; the final confirmation is what binds them. |
| Final confirmation | `publish.sh` on `/dev/tty`; on exit `4`, `AskUserQuestion`, then a rerun with `--confirmed`. **No** returns to the dialogue. **Chat** returns to the conversation with the run still open. |
| `shipit` confirmation | `publish.sh` on `/dev/tty`, only when `shipit` is among the labels; on exit `4`, `AskUserQuestion` with the safe answer first, then a rerun with `--shipit-confirmed`, or without `shipit` |
| Next step | `arcanum/_lib/next_step_prompt.sh`, see [Skill Finish](skill-finish.md) |
| Abandoning | Free chat ("stop", "drop it"): the draft is kept, and the `declined` report is printed |

`/dev/tty` is not available inside Claude Code sessions, so the `AskUserQuestion` fallback is the usual path. The exact question wording is in [`arcanum-create-issue/steps/*.md`](../../../arcanum-create-issue/steps/).

## Edge cases

| Case | Handling |
| --- | --- |
| A chosen label does not exist on GitHub | Created before the issue, with a `WARNING=created label <name>` line (see [Label rules](#label-rules)). |
| Label case and duplicates | Matched case-insensitively, using the existing spelling. Duplicates are removed. |
| The create times out, but the issue was created | No automatic retry, so no duplicate. The draft is kept, and the error says to check GitHub before running again. |
| The issue is created, but deleting the draft fails | `STATUS=ok` plus `WARNING=draft not deleted: <path>`. Not a failure. |
| Empty title or empty body | `publish.sh` exits `2` and creates nothing. The skill returns to the dialogue. |
| Every label removed | Allowed: no labels, and `EPIC=false`. |
| Stale drafts pile up | No automatic cleanup. The resume prompt lists every draft with its age. |
| `gh` not authenticated, or no GitHub `origin` | `start.sh` fails before the interview (`STATUS=error`, exit `1`). The skill prints the `failed` report, and no draft is created. |

## See also

- [Issue Tags](issue-tags.md): the `epic` and `shipit` paragraphs, including how automation skips Epics.
- [Skill Finish](skill-finish.md): the closing report and the Epic-based next step.
- [Script Engine](script-engine.md): native-only entrypoints and the exit-`4` contract.
- [Per-Repo Migrations](per-repo-migrations.md): how existing repos get the `Epic` label.
- [Issue Enhancement](../issue-enhancement.md): the checklist the dialogue follows.

# Spec: arcanum-create-issue and the Epic label

## Status

Proposed. This spec belongs to epic #687 and is the contract that sub-issues #689–#692 are built against. #689 (the Epic label) has already shipped: its sections below describe what is now in place. The rest is not implemented yet. The spec is temporary: #693 removes it and moves the rules that still apply into [`docs/agents/architecture/`](../architecture.md).

## Goal

1. **Epic label.** A dedicated `Epic` label marks an issue that is meant to be split, not implemented.
2. **Migration.** Existing repos get the `Epic` label and the updated default label config.
3. **`/arcanum-create-issue` skill.** A new, native-only skill that interviews the user (the [`enhance-issue`](../../../enhance-issue/SKILL.md) dialogue pattern) and creates a new GitHub issue with the chosen labels.
4. **Automation skips Epics.** `monitor-issues`, `auto-fix-all` and `push-issue-to-queue` never pick up an `Epic` issue.
5. **Epic and split-issue.** `arcanum-split-issue` no longer copies `Epic` onto sub-issues. #687's own split copied it onto #688–#693, and it had to be removed by hand.

## Scope

This spec defines contracts. The sub-issues follow them:

- **Interview flow**: the steps and their order, what is reused from `enhance-issue`, and where the Epic and label questions come in.
- **Label rules**: the allowed set, the default, and where the list comes from.
- **Native commands**: names, arguments, output keys, exit codes and shim paths. Internal module layout is left to #690.
- **Draft**: location, naming, and when it is deleted.
- **Finish**: the closing report fields and the Epic-based next-step rule.
- **Migration**: the `next/` entries, their scope, what they do, and that they are idempotent.
- **Epic in automation**: per skill, whether it skips or refuses, the message, and whether shell and native both change.
- **Epic in split-issue**: no copying of `Epic` to sub-issues, and how the parent's label is handled after a split.

Out of scope:

- Writing any code, skill files or migrations. That is #689–#692.
- Docker support for the new commands. They stay native-only for now (see [Native-only entrypoints](../architecture/script-engine.md#native-only-entrypoints)).
- Changing `enhance-issue`'s behavior. The only allowed change is moving shared parts into a common place.
- Redesigning the label system in general (descriptions, renames, the misspelling `Writting`).
- How `monitor-issues` treats new `Writting` issues. It only acts on `question`, `created` and `ready_for_work`, so a `Writting` issue is recorded in state and nothing else happens. That stays unchanged.

## Draft file

Implemented in: #690 (commands), #691 (skill files).

- **Location**: `.claude/state/create-issue/<timestamp>.md`. `.claude/state/` is git-ignored, so the draft can never be committed by accident. The name uses a timestamp because there is no issue id or title when the draft is created. The draft survives the session, so a run can be resumed.
- **Title**: the draft's first `#` heading line is the issue title. Everything after it is the body.
- **Lifecycle**:
  - Created at the start of a fresh run and updated as the dialogue goes on.
  - Deleted **only** after the GitHub issue is created successfully. The next skill (`/discuss-issue` or `/arcanum-split-issue`) fetches the issue from GitHub.
  - Kept if the user abandons the run or the GitHub create fails.
- **Resume**: at the start of a run, if drafts exist under `.claude/state/create-issue/`, the user chooses to resume one or start fresh (prompt 1 in [Prompts](#prompts)). Each draft is listed with its timestamp, its age, and its title (or its first line when it has no `#` heading yet).
- **Cleanup**: none automatic. Stale drafts are listed by the resume prompt and can be deleted by hand.

## Skill flow and reuse of enhance-issue

Implemented in: #691.

`/arcanum-create-issue` has **its own steps**, modeled on `enhance-issue`. `enhance-issue` itself is not changed.

| create-issue step | Based on | Differences |
| --- | --- | --- |
| Start / resume | (new) | Replaces [`enhance-issue/steps/fetch.md`](../../../enhance-issue/steps/fetch.md). Creates a new draft, or resumes one, through `scripts/start.sh`. Nothing is fetched from GitHub. |
| Explore | [`enhance-issue/steps/explore.md`](../../../enhance-issue/steps/explore.md) | Same light pass, run on the user's initial idea instead of a fetched issue. |
| Dialogue | [`enhance-issue/steps/dialogue.md`](../../../enhance-issue/steps/dialogue.md) | Same checklist loop. Adds two fixed items: **Epic?** and **Labels**. Never spawns issues. Its abandon path keeps the draft. |
| Publish | [`enhance-issue/steps/publish.md`](../../../enhance-issue/steps/publish.md) | Creates the issue instead of updating one, through `scripts/publish.sh`. Applies the chosen labels, deletes the draft, and picks the next step from `EPIC`. |

Reused as is:

- [`docs/agents/issue-enhancement.md`](../issue-enhancement.md): the source of the checklist.
- [`arcanum/_lib/finish_report.sh`](../../../arcanum/_lib/finish_report.sh) and [`arcanum/_lib/next_step_prompt.sh`](../../../arcanum/_lib/next_step_prompt.sh).
- `checkout_safe_branch.sh` is **not** used: the skill never touches git (see [Edge cases](#edge-cases)).

**No spawning.** The dialogue never calls `spawn_issue.sh`, because there is no parent issue id yet. If the discussion shows the work has independent parts, the skill suggests marking the issue `Epic` and splitting it later with `/arcanum-split-issue`.

**Finish.** Every exit ends with the standard closing report (see [Skill Finish](../architecture/skill-finish.md)):

- `success`: `--issue <ID>`, plus the labels applied. If `shipit` was asked for but not confirmed, the summary says the issue was created without it. Then the next-step offer: `/arcanum-split-issue <ID>` when `EPIC=true`, otherwise `/discuss-issue <ID>`.
- `declined`: the user abandoned the run. The draft is kept and its path is named in the summary. No next-step offer.
- `failed`: the preflight or the create failed. The draft (if any) is kept. No next-step offer.

## Native commands

Implemented in: #690.

Two native-only commands. Each is registered in [`core/lib/core/commands.js`](../../../core/lib/core/commands.js) with `context: 'repo'`, and each has a thin shim in `arcanum-create-issue/scripts/` that calls `engine_dispatch` with `--native-only`, the same way as [`arcanum-check-config/scripts/check_config.sh`](../../../arcanum-check-config/scripts/check_config.sh). Neither has a `*_shell.sh` twin, and neither is listed in `migration-status.json`.

Output is `KEY=value` lines on stdout. Exit codes for both commands:

| Exit | Meaning |
| --- | --- |
| `0` | Success (`STATUS=new`, `STATUS=resumed` or `STATUS=ok`). |
| `1` | Runtime failure (`STATUS=error` or `STATUS=failed`, plus `ERROR=<message>`). |
| `2` | Invalid input (bad arguments, malformed label, empty title or body). Nothing is created. |
| `4` | No `/dev/tty`: `FALLBACK=chat`. The skill asks with `AskUserQuestion` and reruns with a flag. |

### `arcanum-create-issue-start`

Shim: `scripts/start.sh <repo_path> [--new | --resume <draft>]`

- **Preflight**: checks that `gh` is authenticated and that `origin` is a GitHub remote. On failure: `STATUS=error`, `ERROR=<message>`, exit `1`, and no draft is created.
- **No drafts**: creates `<timestamp>.md`, prints `STATUS=new` and `FILE=<path>`.
- **Drafts exist, TTY available**: a `/dev/tty` prompt lists them (`[N]ew` or a draft number to resume), then prints `STATUS=new|resumed` and `FILE=<path>`.
- **Drafts exist, no TTY**: exit `4`, `FALLBACK=chat`, and one `DRAFT=<path>\t<timestamp>\t<title or first line>` line per draft.
- `--new` creates a fresh draft without prompting. `--resume <draft>` resumes that draft without prompting; an unknown path exits `2`.

### `arcanum-create-issue-publish`

Shim: `scripts/publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`

- **Validation**: the title and the body must not be empty, and every label must be well-formed (not empty, no commas, no newlines). Otherwise exit `2` and nothing is created.
- **Labels**: matched case-insensitively against the repo's GitHub labels, using the existing spelling, with duplicates removed. A missing label is created first (see [Edge cases](#edge-cases)) and reported as `WARNING=created label <name>`.
- **Confirmations**: owns prompt 5 (final confirmation) and prompt 6 (`shipit`). Without a TTY, it exits `4` until it gets `--confirmed`, and, when `shipit` is among the labels, `--shipit-confirmed`. If `shipit` is not confirmed, it is dropped from the labels.
- **Create**: the issue is created **with its labels in a single REST call**. `IssueClient.createIssue` ([`core/lib/utils/github/IssueClient.js`](../../../core/lib/utils/github/IssueClient.js)) gains a labels argument, and `GithubIssueService.create` ([`core/lib/services/GithubIssueService.js`](../../../core/lib/services/GithubIssueService.js)) is reused. An issue is never left partly labeled. The draft's `#` heading line is stripped from the body.
- **Success**: deletes the draft, then prints `STATUS=ok`, `ID=<n>`, `URL=<url>`, `LABELS=<comma-separated>` and `EPIC=true|false`, plus any `WARNING=` lines. `EPIC=true` means `Epic` is among the applied labels.
- **Failure**: exit `1`, `STATUS=failed`, `ERROR=<message>`. The draft is kept.

| Key | Command | Meaning |
| --- | --- | --- |
| `STATUS` | both | `new`, `resumed`, `ok`, `error` or `failed` |
| `FILE` | start | The draft path |
| `DRAFT` | start | One existing draft, on exit `4` |
| `FALLBACK` | both | Always `chat`, on exit `4` |
| `ID`, `URL` | publish | The created issue |
| `LABELS` | publish | The labels actually applied, comma-separated |
| `EPIC` | publish | `true` when `Epic` is among `LABELS` |
| `WARNING` | publish | Non-fatal notes; may repeat |
| `ERROR` | both | The failure message, on exit `1` |

## Label rules

Implemented in: #690 (validation and create), #691 (the dialogue).

- **Any label is allowed.** The user can add any label during the interview. Only the default and the suggestions are hardcoded:
  - **Default**: `Writting`. Pre-selected, but can be removed.
  - **Suggested**: `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic` and `shipit`.
- **Type labels** (`Documentation`, `Feature`, `Refactor`, `Bug`): the AI suggests zero or more, in any combination, based on the discussion. The user confirms or edits them in the **Labels** checklist item.
- **`Epic`**: set through the **Epic?** checklist item, which keeps it in sync with the label list.
- **`shipit`**: explicit opt-in only. The AI never suggests it. It is applied only when the user asks for it and confirms it at prompt 6.
- **Removing every label** is allowed. The issue is then created with no labels, and `EPIC=false`.
- **The `shipit` rule is reworded.** "`shipit` is human-only and never mutated by any script" becomes "`shipit` is never applied without an explicit human choice". This changes:
  - [`docs/agents/architecture/issue-tags.md`](../architecture/issue-tags.md), edited by hand.
  - [`docs/agents/tag-mutations.md`](../tag-mutations.md), which is generated: the sentence is changed in [`scripts/generate_tags_table.sh`](../../../scripts/generate_tags_table.sh), and the table is regenerated. Never edit `tag-mutations.md` by hand.

  `arcanum/_lib/tag_mutate.sh` keeps refusing `shipit`. The publish command never goes through it: labels are set by the create call itself.

## Epic as a pipeline tag and split-issue

Implemented in: #689 (shipped).

- **`Epic` is a pipeline tag.** `Epic → epic` is in [`core/lib/utils/issue/Tags.js`](../../../core/lib/utils/issue/Tags.js) and [`arcanum/_lib/tags.sh`](../../../arcanum/_lib/tags.sh) as a **non-actionable** tag. As a result:
  - Label carryover strips it. [`LabelApplicator.js`](../../../core/lib/utils/issue/LabelApplicator.js) (native) and [`spawn_issue_shell.sh`](../../../arcanum/_lib/spawn_issue_shell.sh) (shell) already strip every pipeline tag, so `Epic` is never copied onto sub-issues or spawned issues.
  - `monitor-issues` sees `epic` among an issue's parsed tags, so its Epic check (#692) uses the same `has_tag` helper.
- **The parent after a split keeps `Epic`.** `mark-split` adds `Split` and `Epic` and removes `Planning`, keeping `Epic` if it is already there. A split parent is a tracking issue and must never be implemented. Native and shell changed together, and the tag-mutations table was regenerated.

See the `epic` paragraph in [Issue Tags](../architecture/issue-tags.md).

## Automation skips Epics

Implemented in: #692.

Three checks. Labels can change after an issue is queued, so the check after the pop in `auto-fix-all` is the one that decides.

| Where | Check | Behavior on `Epic` |
| --- | --- | --- |
| `monitor-issues` | `has_tag epic` on the tags it already parsed in the poll (no extra call) | Does not push the issue to the `auto-fix-all` queue, even if it is labeled `Ready for Work`. Logs `Skipping #N: Epic`. |
| `/push-issue-to-queue` | One `has-label` call per id | Refuses that id with `#N is an Epic — split it with /arcanum-split-issue`. The other ids are still pushed. |
| `auto-fix-all`, after each pop | One `has-label` call | Drops the issue from the queue, prints `Skipped #N: Epic (split it with /arcanum-split-issue)`, and continues with the next id. No user interaction and no label changes. |

- `auto-fix-all/scripts/github.sh has-shipit-label` is generalized to `has-label <repo_path> <id> <name>`, exit `0` when the issue has the label (case-insensitive) and `1` when it does not. `has-shipit-label <repo_path> <id>` stays as a thin alias for `has-label <repo_path> <id> shipit`. Shell and native change together.
- `queue.sh push` itself makes no GitHub calls.

## Migration

Implemented in: #689 (shipped).

- **Default**: `Epic:fbca04` is in `DEFAULT_LABEL_PAIRS`, both in [`init-claude/scripts/lib/label_config.sh`](../../../init-claude/scripts/lib/label_config.sh) and in [`core/lib/services/LabelConfig.js`](../../../core/lib/services/LabelConfig.js).
- **Two entries** in [`arcanum/migrations/repos/next/migrations.json`](../../../arcanum/migrations/repos/next/migrations.json), both `type: "script"`, `skippable: true`, with no prompt and safe to re-run. They are modeled on [`arcanum/migrations/repos/0.17.2/001.sh`](../../../arcanum/migrations/repos/0.17.2/001.sh) (`Spawned`).

| id | `applies_to` | What it does |
| --- | --- | --- |
| `001` | `repo` | Creates `Epic:fbca04` on the repo's GitHub labels **only if it is missing**, matching names case-insensitively. An existing `Epic` label is left as is, keeping its own color, and the migration logs `already present`. |
| `002` | `local` | If `.claude/state/init-claude-config.json` exists and has no `Epic` entry, adds `Epic:fbca04` through [`init-claude/scripts/write_label_config.sh`](../../../init-claude/scripts/write_label_config.sh) `add`. An existing entry is left as is. A missing file is skipped. |

- **Why two entries**: `.claude/state/` is git-ignored, so a config update inside a `repo`-scoped entry would only reach the clone that runs it. The `local` entry updates each clone's own config.
- Each entry has its own `NNN.md` description, shown at the `[R]un/[S]kip/[C]hat` prompt. See [Per-Repo Migrations](../architecture/per-repo-migrations.md).

## Prompts

Implemented in: #690 (script prompts), #691 (skill-side fallbacks and dialogue).

| # | Interaction | Mechanism |
| --- | --- | --- |
| 1 | Resume a draft or start a new one | `start.sh`: TTY first; exit `4` → `AskUserQuestion` → rerun with `--new` or `--resume <draft>` |
| 2 | The initial idea | Open chat (free text, not a choice) |
| 3 | Checklist loop and digging into topics | Open dialogue, as in `enhance-issue` |
| 4 | **Epic?** and **Labels** | `AskUserQuestion` from within the dialogue: Epic yes/no, and a multi-select of labels with the suggestions listed. These are draft choices; prompt 5 is what binds them. |
| 5 | **Final confirmation** | `publish.sh` shows the title, the labels, whether it is an Epic, and the body size, then asks `[Y]es / [N]o / [C]hat`. Exit `4` → `AskUserQuestion` → rerun with `--confirmed`. **No** → back to the dialogue. **Chat** → return to the conversation. |
| 6 | **`shipit` confirmation** | `publish.sh`, asked only when `shipit` is among the labels, after prompt 5. Warns that this pre-approves the whole PR lifecycle, including the merge, and defaults to **No**. Exit `4` → `AskUserQuestion` → rerun with `--shipit-confirmed`. If not confirmed, the issue is created **without** `shipit`, and the closing report says so. |
| 7 | Next step | [`arcanum/_lib/next_step_prompt.sh`](../../../arcanum/_lib/next_step_prompt.sh): `/arcanum-split-issue <id>` if `EPIC=true`, otherwise `/discuss-issue <id>`. TTY first, with the `AskUserQuestion` fallback. |
| 8 | Abandoning | Free chat ("stop", "drop it"), as in `enhance-issue`: the draft is kept, the `declined` report is printed, and there is no next-step offer. |

- `/dev/tty` is not available inside Claude Code sessions (#681, #682), so the `AskUserQuestion` fallback is the path users will usually see.
- No free-text yes/no in chat, ever.

### Exact `AskUserQuestion` wording

**Prompt 1 — resume or new.** Asked on exit `4` from `start.sh`, using its `DRAFT=` lines.

- Question: `Unfinished issue drafts were found. Resume one or start a new issue?`
- Header: `Draft`
- Options, one per draft, then the last one:
  - `Resume: <title or first line>` — description `<timestamp> (<age> ago), <path>`. Rerun with `--resume <path>`.
  - `Start a new issue` — description `Leave the existing drafts in place and start a fresh one.` Rerun with `--new`.

`AskUserQuestion` takes at most four options. When there are more than three drafts, list the three most recent, plus `Start a new issue`. An older draft can still be picked through the free-text "Other" answer, by typing its path.

**Prompt 5 — final confirmation.** Asked on exit `4` from `publish.sh` without `--confirmed`.

- Question: `Create this issue on GitHub? Title: "<title>". Labels: <labels, or "none">. Epic: <yes|no>. Body: <N> lines.`
- Header: `Create issue`
- Options:
  - `Yes, create it` — description `Create the issue with these labels and delete the local draft.` Rerun with `--confirmed`.
  - `No, keep editing` — description `Go back to the checklist and keep refining the draft.` Back to the dialogue; nothing is created.
  - `Chat` — description `Return to the conversation without creating anything.` Nothing is created.

**Prompt 6 — `shipit` confirmation.** Asked on exit `4` from `publish.sh` with `--confirmed` but without `--shipit-confirmed`, only when `shipit` is among the labels.

- Question: `Apply shipit? It pre-approves the whole PR lifecycle for this issue: auto-fix-all will merge the PR as soon as CI passes, with no review.`
- Header: `shipit`
- Options, in this order, so the safe choice comes first:
  - `No, create without shipit (Recommended)` — description `The issue is created without the shipit label.` Rerun with `--confirmed` and without `shipit` among the labels.
  - `Yes, apply shipit` — description `The issue is created pre-approved for merge.` Rerun with `--confirmed --shipit-confirmed`.

## Edge cases

Implemented in: #690 (unless noted).

| Case | Handling |
| --- | --- |
| **A chosen label does not exist on GitHub** | `publish.sh` creates it before creating the issue (`Epic` gets `fbca04`; any other label gets a neutral default color) and prints `WARNING=created label <name>`. When the missing label is `Epic`, the warning suggests running `/arcanum-migrate`. |
| **Label case and duplicates** | Matched case-insensitively against the existing GitHub labels, using the existing spelling. Duplicates are removed. |
| **The create call times out, but the issue was actually created** | No automatic retry on create, so no duplicates. On failure the draft is kept, and the error tells the user to check GitHub before running again. |
| **The issue is created, but deleting the draft fails** | `STATUS=ok` plus `WARNING=draft not deleted: <path>`. Not a failure. |
| **Empty title or empty body** | `publish.sh` exits `2` and creates nothing. The skill returns to the dialogue (#691). |
| **Title in the draft** | The draft's first `#` heading line is the title. `publish.sh` gets the title as an argument and strips that line from the body. |
| **Every label removed** (including `Writting`) | Allowed. The issue is created with no labels, and `EPIC=false`. |
| **Stale drafts pile up** | No automatic cleanup. The resume prompt lists every draft with its age, and drafts can be deleted by hand. |
| **Git state** | The skill never commits or checks out anything. The draft lives in `.claude/state/`, so there is no safe-branch checkout and no dirty-tree check (#691). |
| **`gh` not authenticated, or no GitHub `origin`** | `start.sh` checks both before the interview (`STATUS=error`, `ERROR=<message>`, exit `1`). The skill prints the `failed` report and ends, and no draft is created. |

## Testing

Implemented in: #689–#692, each for its own part.

| Sub-issue | Tests |
| --- | --- |
| Epic label (#689) | `LabelConfig_spec.js` and the init-claude label specs include `Epic:fbca04`. `Tags_spec.js` maps `Epic` to `epic` as non-actionable. `LabelApplicator_spec.js` and spawn-issue parity check that `Epic` is not copied. Split-finish parity covers adding `Epic` to the parent. The tag-mutations table is regenerated (`scripts/test_generate_tags_table.sh`). **Migrations**: a `core/spec/bin` Jasmine spec runs `001.sh` and `002.sh` with a stubbed `gh` on `PATH` and a temp repo: label missing (created), label present in any case (left alone), config present or missing, `Epic` already in the config, and re-running (idempotent). |
| Native commands (#690) | Unit specs for `start` and `publish`: new draft, resume, exit `4` with `DRAFT=` lines, the GitHub preflight error, label normalization and dedupe, creating a missing label, a single create call that includes the labels, no retry, the draft deleted only on success, the draft-delete warning, title stripping, and empty title or body (exit `2`). Confirmations: exit `4` without `--confirmed` or `--shipit-confirmed`, and `shipit` dropped when not confirmed. A CLI spec in `core/spec/bin/` covers the shims through `engine_dispatch --native-only`. The `IssueClient` spec covers the new labels argument. |
| Skill files (#691) | `skill-reviewer` pass (no complex inline bash, exit-4 fallbacks handled). A manual end-to-end run against a real repo: one Epic issue and one normal issue, checking the labels and that the next-step offer differs. |
| Automation skips Epics (#692) | `has-label` parity specs, with `has-shipit-label` kept as an alias. `monitor-issues` parity: a `Ready for Work` + `Epic` issue is not queued. `push-issue-to-queue`: an Epic is refused and the other ids are still pushed. `auto-fix-all`: an Epic popped from the queue is skipped. |

**Gates**: the existing ones only. `make core-check` (lint and tests) and jscpd stay clean, and c8 coverage for the new code meets the repo's current threshold.

## Open points

- **Default color for auto-created labels.** "Neutral" is not pinned down. A candidate is `ededed` (GitHub's own grey). To be fixed in #690.
- **Resume list with more than three drafts.** The four-option limit of `AskUserQuestion` means older drafts are reachable only by typing their path. #691 may instead add a "Show older drafts" option that pages through the list.
- **Where `has-label` lives natively.** Whether the native side gets a new `has-label` command with `has-shipit-label` routed to it, or keeps two registry entries sharing one implementation. Left to #692.
- **Label suggestions source.** The suggested labels are hardcoded. Whether they should instead come from the repo's `init-claude-config.json` label list is left open; the default (`Writting`) stays hardcoded either way.
- **Prompt 5 "Chat" vs abandon.** Choosing `Chat` returns to the conversation with the draft kept. Whether that ends the run with a `declined` report or keeps the run open for more dialogue is left to #691.

## See also

- [Issue Tags](../architecture/issue-tags.md): the tag table, `shipit`, `split` and `epic`.
- [Skill Finish](../architecture/skill-finish.md): closing reports and next-step offers.
- [Script Engine](../architecture/script-engine.md): native-only entrypoints and the exit-4 contract.
- [Per-Repo Migrations](../architecture/per-repo-migrations.md): `repo` and `local` migration entries.
- [Issue Enhancement](../issue-enhancement.md): the checklist the dialogue follows.

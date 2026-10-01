# Issue: Create-issue: spec

## Description

Part of #687. Write the spec that every other `Create-issue` sub-issue follows.

The spec is written to `docs/agents/specs/arcanum-create-issue.md`. Every decision it must record was already agreed during enhancement and is listed under Solution.

## Problem

Epic #687 is split into four implementation sub-issues (#689–#692) that touch overlapping areas: labels and tags, the native command, the skill files, and the automation skills. Without one agreed definition, each sub-issue would make its own decisions about the draft file, the label rules, the command contract and how Epics are handled, and the pieces would not fit together. #687's own split also showed a real gap: sub-issues inherited the parent's `Epic` label.

## Expected Behavior

Write `docs/agents/specs/arcanum-create-issue.md`. It defines:

- **Interview flow**: how `/arcanum-create-issue` follows the `enhance-issue` pattern (topic checklist dialogue), and which `enhance-issue` steps and scripts it reuses directly.
- **Extra checks**: whether the issue is an Epic, and which labels to apply. The default is `Writting`. Optional labels are `Documentation`, `Feature`, `Refactor`, `Bug`, `shipit` and `Epic`.
- **Draft handling**: the draft is a local file that is never committed and is deleted after the GitHub issue is created.
- **Native command interface**: the `core/lib` command(s), their arguments and output keys, and the `--native-only` shim (following `/arcanum-check-config`). Prompts are TTY-first with the exit-4 `AskUserQuestion` fallback.
- **Finish**: the standard closing report and next-step offer: `/arcanum-split-issue <id>` for an Epic, `/discuss-issue <id>` otherwise.
- **Epic label and migration**: the `Epic:fbca04` default and the `repo`-scoped migration, modeled on `arcanum/migrations/repos/0.17.2/001` (`Spawned`).
- **Automation skip**: how `monitor-issues`, `auto-fix-all` and `push-issue-to-queue` skip or refuse `Epic` issues.

- **Epic and split-issue**: `arcanum-split-issue` must not copy `Epic` onto sub-issues (#687's own split copied it onto #688–#693, and it had to be removed by hand), and what happens to the parent's `Epic` label after a split.

### Acceptance criteria

- [ ] `docs/agents/specs/arcanum-create-issue.md` exists and records every decision above: scope, draft file, reuse, native command interface, label rules, Epic and split-issue, automation skip, migration, prompts (with the exact `AskUserQuestion` wording for prompts 1, 5 and 6), edge cases and testing
- [ ] Each section names the sub-issue that implements it (#689–#692)
- [ ] Open points are listed explicitly

## Solution

The spec records the following decisions.

### Scope boundaries

The spec defines contracts. The implementation sub-issues follow them:

- **Interview flow**: the steps and their order, what is reused from `enhance-issue`, and where the Epic and label questions come in.
- **Label rules**: the allowed set, the default, and where the list comes from.
- **Native command**: its name, arguments, output keys, exit codes and the shim path. Internal module layout is left to the native command sub-issue.
- **Draft**: location, naming, and when it is deleted.
- **Finish**: the closing report fields and the Epic-based next-step rule.
- **Migration**: the `next/` entry, its scope, what it does, and that it is idempotent. The script itself is written in the Epic label sub-issue.
- **Epic in automation**: per skill, whether it skips or refuses, the message, and whether shell and native both change.
- **Epic in split-issue**: no copying of `Epic` to sub-issues, and how the parent's label is handled after a split.

Out of scope:

- Writing any code, skill files or the migration (sub-issues #689–#692).
- Docker support for the new command. It stays native-only for now.
- Changing `enhance-issue`'s behavior. The only allowed change is moving shared parts into a common place.
- Redesigning the label system in general (descriptions, renames, the misspelling `Writting`).
- How `monitor-issues` treats new `Writting` issues. It only acts on `question`, `created` and `ready_for_work`, so a `Writting` issue is recorded in state and nothing else happens. That stays unchanged.

### Draft file

- **Location**: `.claude/state/create-issue/<timestamp>.md`. `.claude/state/` is git-ignored, so the draft can never be committed by accident. The name uses a timestamp because there is no issue id or title when the draft is created. It survives the session, so a run can be resumed.
- **Lifecycle**:
  - The draft is created at the start of a fresh run and updated as the dialogue goes on.
  - It is deleted **only** after the GitHub issue is created successfully. The next skill (`/discuss-issue` or `/arcanum-split-issue`) fetches the issue from GitHub.
  - If the user abandons the run, or the GitHub create fails, the draft is kept.
- **Resume**: at the start of a run, if drafts exist under `.claude/state/create-issue/`, the user chooses to resume one or start fresh. The prompt is TTY-first, with the exit-4 `FALLBACK=chat` → `AskUserQuestion` fallback. The spec defines how drafts are listed to the user (e.g. timestamp plus first line or title).

### Reusing enhance-issue

`/arcanum-create-issue` has **its own steps**, modeled on `enhance-issue`. `enhance-issue` itself is not changed.

| create-issue step | Based on | Differences |
|---|---|---|
| Start / resume | (new) | Replaces `enhance-issue/steps/fetch.md`. It creates a new draft, or resumes one from `.claude/state/create-issue/`. Nothing is fetched from GitHub. |
| Explore | `enhance-issue/steps/explore.md` | Same light pass, run on the user's initial idea instead of a fetched issue. |
| Dialogue | `enhance-issue/steps/dialogue.md` | Same checklist loop. Adds fixed items: **Epic?** and **Labels**. It never spawns issues (see below), and its abandon path keeps the `.claude/state/` draft. |
| Publish | `enhance-issue/steps/publish.md` | Creates the issue instead of updating one, applies the chosen labels, deletes the draft, and picks the next step based on Epic. |

Reused as is:

- `docs/agents/issue-enhancement.md`: the source of the checklist.
- The shared `arcanum/_lib/` scripts: `finish_report.sh` and `next_step_prompt.sh`. `checkout_safe_branch.sh` is not used, because the skill never touches git (see Edge cases).

**No spawning**: the dialogue never calls `spawn_issue.sh`, because there is no parent issue id yet. If the discussion shows the work has independent parts, the skill suggests marking the issue `Epic` and splitting it later with `/arcanum-split-issue`.

### Native command interface

There are two native-only commands. Each is registered in `core/lib/core/commands.js` with `context: 'repo'`, and each has a thin shim in `arcanum-create-issue/scripts/` that calls `engine_dispatch --native-only`, following `/arcanum-check-config`. Neither has a `*_shell.sh` twin.

#### `arcanum-create-issue-start`

Shim: `scripts/start.sh <repo_path> [--new | --resume <draft>]`

- **No drafts** in `.claude/state/create-issue/`: creates `<timestamp>.md`, then prints `STATUS=new` and `FILE=<path>`.
- **Drafts exist**: shows a `/dev/tty` prompt that lists them (`[N]ew` or a draft number to resume), then prints `STATUS=new|resumed` and `FILE=<path>`.
- **No TTY**: exits `4` and prints `FALLBACK=chat` plus one `DRAFT=<path>\t<timestamp>\t<title or first line>` line per draft. The skill asks with `AskUserQuestion`, then runs it again with `--new` or `--resume <draft>`.

#### `arcanum-create-issue-publish`

Shim: `scripts/publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`

- Owns the final confirmation and the `shipit` confirmation (see Script-driven prompts).

- Checks that every label is well-formed: not empty, and no commas or newlines. A malformed label exits `2`, and nothing is created. Any label name is accepted (see Label rules).
- Creates the issue **with its labels in a single REST call**. `IssueClient.createIssue` is extended to accept labels, and `GithubIssueService.create` is reused. An issue is never left partly labeled.
- On success it deletes the draft and prints `STATUS=ok`, `ID=`, `URL=`, `LABELS=<comma-separated>` and `EPIC=true|false`. The skill uses `EPIC` to choose the next step.
- On failure it exits `1`, prints `STATUS=failed` and `ERROR=<message>`, and keeps the draft.

### Label rules

- **Any label is allowed.** The user can add any label during the interview. Only the default and the suggestions are hardcoded:
  - **Default**: `Writting`. It is pre-selected but can be removed.
  - **Suggested**: `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic` and `shipit`.
- **Type labels** (`Documentation`/`Feature`/`Refactor`/`Bug`): the AI suggests zero or more, in any combination, based on the discussion. The user confirms or edits the selection in the **Labels** checklist item.
- **`Epic`**: set through the **Epic?** checklist item, which keeps it in sync with the label list. `EPIC=true` from the publish command means `Epic` is among the labels.
- **`shipit`**: explicit opt-in only. The AI never suggests it. It is applied only when the user asks for it, and the user confirms it in a separate question. The rule in `docs/agents/tag-mutations.md` and `docs/agents/architecture/issue-tags.md`, "`shipit` is human-only and never mutated by any script", is reworded to "never applied without an explicit human choice".

### Epic and split-issue

- **`Epic` becomes a pipeline tag.** `Epic → epic` is added to `core/lib/utils/issue/Tags.js` and `arcanum/_lib/tags.sh` as a **non-actionable** tag. This has two effects:
  - Label carryover strips it. `LabelApplicator.js` (native) and `spawn_issue_shell.sh` (shell) already strip every pipeline tag, so `Epic` is no longer copied onto sub-issues or spawned issues. This fixes what happened in #687's split, where #688–#693 got `Epic` and it had to be removed by hand.
  - `monitor-issues` gets `epic` in its parsed tags, so its Epic check uses the same `has_tag` helper.
- **The parent after a split.** The parent keeps `Epic`. If the parent doesn't have it, `arcanum-split-issue`'s finish step adds it next to `Planning → Split`: a split parent is a tracking issue and must never be implemented. Native and shell change together, and the tag-mutations table is regenerated.
- **Owner**: the Epic label sub-issue (#689), since it already touches labels.

### Automation skips Epics

There are three checks. Labels can change after an issue is queued, so the check after the pop in `auto-fix-all` is the one that decides.

| Where | Check | Behavior on `Epic` |
|---|---|---|
| `monitor-issues` | `has_tag epic` on the tags it already parsed in the poll (no extra call) | Does not push the issue to the `auto-fix-all` queue, even if it is labeled `Ready for Work`. Logs `Skipping #N: Epic`. |
| `/push-issue-to-queue` | One `has-label` call per id | Refuses that id with `#N is an Epic — split it with /arcanum-split-issue`. The other ids are still pushed. |
| `auto-fix-all`, after each pop | One `has-label` call | Drops the issue from the queue, prints `Skipped #N: Epic (split it with /arcanum-split-issue)`, and continues with the next id. No user interaction and no label changes. |

- `auto-fix-all/scripts/github.sh has-shipit-label` is generalized to `has-label <repo_path> <id> <name>`. `has-shipit-label` stays as a thin alias. Shell and native change together.
- `queue.sh push` itself makes no GitHub calls.

### Migration

- **Default**: add `Epic:fbca04` to `DEFAULT_LABEL_PAIRS`, both in `init-claude/scripts/lib/label_config.sh` and in `core/lib/services/LabelConfig.js`.
- **Two entries** in `arcanum/migrations/repos/next/migrations.json`, both `type: "script"`, `skippable: true`, with no prompt and safe to re-run. They are modeled on `arcanum/migrations/repos/0.17.2/001.sh` (`Spawned`).

| id | `applies_to` | What it does |
|---|---|---|
| `001` | `repo` | Creates `Epic:fbca04` on the repo's GitHub labels **only if it's missing**. Names are matched without regard to case. If an `Epic` label already exists, it is left as is, keeping its own color, and the migration logs `already present`. |
| `002` | `local` | If `.claude/state/init-claude-config.json` exists and has no `Epic` entry, adds `Epic:fbca04` through `init-claude/scripts/write_label_config.sh add`. An existing entry is left as is. If the file is missing, it is skipped. |

- **Why two entries**: `.claude/state/` is git-ignored, so a config update inside a `repo`-scoped entry would only reach the clone that runs it. The `local` entry updates each clone's own config.
- Each entry has its own `NNN.md` description, shown at the `[R]un/[S]kip/[C]hat` prompt.

### Script-driven prompts

| # | Interaction | Mechanism |
|---|---|---|
| 1 | Resume a draft or start a new one | `start.sh`: TTY first; exit `4` → `AskUserQuestion` → rerun with `--new` or `--resume <draft>` |
| 2 | The initial idea | Open chat (free text, not a choice) |
| 3 | Checklist loop and digging into topics | Open dialogue, as in `enhance-issue` |
| 4 | **Epic?** and **Labels** | `AskUserQuestion` from within the dialogue: Epic yes/no, and a multi-select of labels with the suggestions listed. These are draft choices; prompt 5 is what binds them. |
| 5 | **Final confirmation** | `publish.sh` shows the title, the labels, whether it's an Epic, and the body size, then asks `[Y]es / [N]o / [C]hat`. Exit `4` → `AskUserQuestion` → rerun with `--confirmed`. **No** → back to the dialogue. **Chat** → return to the conversation. |
| 6 | **`shipit` confirmation** | `publish.sh`, asked only when `shipit` is among the labels, after prompt 5. It warns that this pre-approves the whole PR lifecycle, including the merge, and defaults to **No**. Exit `4` → `AskUserQuestion` → rerun with `--shipit-confirmed`. If not confirmed, the issue is created **without** `shipit`, and the closing report says so. |
| 7 | Next step | `arcanum/_lib/next_step_prompt.sh`: `/arcanum-split-issue <id>` if `EPIC=true`, otherwise `/discuss-issue <id>`. TTY first, with the `AskUserQuestion` fallback. |
| 8 | Abandoning | Free chat ("stop", "drop it"), as in `enhance-issue`: the draft is kept, the `declined` report is printed, and there is no next-step offer. |

- `/dev/tty` is not available inside Claude Code sessions (#681, #682), so the `AskUserQuestion` fallback is the path users will usually see. The spec gives the exact question and option wording for prompts 1, 5 and 6.
- No free-text yes/no in chat, ever.

### Edge cases

| Case | Handling |
|---|---|
| **A chosen label doesn't exist on GitHub** | `publish.sh` creates it before creating the issue (`Epic` gets `fbca04`; any other label gets a neutral default color) and prints `WARNING=created label <name>`. When the missing label is `Epic`, the warning suggests running `/arcanum-migrate`. |
| **Label case and duplicates** | Labels are matched against the existing GitHub labels without regard to case, and the existing spelling is used. Duplicates are removed. |
| **The create call times out, but the issue was actually created** | No automatic retry on create, so no duplicates. On failure the draft is kept, and the error tells the user to check GitHub before running again. |
| **The issue is created, but deleting the draft fails** | `STATUS=ok` plus `WARNING=draft not deleted: <path>`. Not a failure. |
| **Empty title or empty body** | `publish.sh` exits `2` and creates nothing. The skill returns to the dialogue. |
| **Title in the draft** | The draft's first `# ` line is the title. `publish.sh` gets the title as an argument and strips that line from the body. |
| **Every label removed** (including `Writting`) | Allowed. The issue is created with no labels, and `EPIC=false`. |
| **Stale drafts pile up** | No automatic cleanup. The resume prompt lists every draft with its age, and drafts can be deleted by hand. |
| **Git state** | The skill never commits or checks out anything. The draft lives in `.claude/state/`, so there is no safe-branch checkout and no dirty-tree check. |
| **`gh` not authenticated, or no GitHub `origin`** | `start.sh` checks both before the interview (`STATUS=error`, `ERROR=<message>`, exit `1`). The skill prints the `failed` report and ends, and no draft is created. |

### Testing strategy

| Sub-issue | Tests |
|---|---|
| Epic label (#689) | `LabelConfig_spec.js` and the init-claude label specs include `Epic:fbca04`. `Tags_spec.js` maps `Epic` to `epic` and treats it as non-actionable. `LabelApplicator_spec.js` and spawn-issue parity check that `Epic` is not copied. Split-finish parity covers adding `Epic` to the parent. The tag-mutations table is regenerated (`scripts/test_generate_tags_table.sh`). **Migrations**: a `core/spec/bin` Jasmine spec runs `001.sh` and `002.sh` with a stubbed `gh` on `PATH` and a temp repo. It covers: label missing (created), label present in any case (left alone), config present or missing, `Epic` already in the config, and re-running (idempotent). |
| Native command (#690) | Unit specs for `start` and `publish`: new draft, resume, exit `4` with `DRAFT=` lines, the GitHub preflight error, label normalization and dedupe, creating a missing label, a single create call that includes the labels, no retry, the draft deleted only on success, the draft-delete warning, title stripping, and empty title or body (exit `2`). Confirmations: exit `4` without `--confirmed` or `--shipit-confirmed`, and `shipit` dropped when it is not confirmed. A CLI spec in `core/spec/bin/` covers the shims through `engine_dispatch --native-only`. The `IssueClient` spec covers the new labels argument. |
| Skill files (#691) | `skill-reviewer` pass (no complex inline bash, exit-4 fallbacks handled). A manual end-to-end run against a real repo: one Epic issue and one normal issue, checking the labels and that the next-step offer differs. |
| Automation skips Epics (#692) | `has-label` parity specs, with `has-shipit-label` kept as an alias. `monitor-issues` parity: a `Ready for Work` + `Epic` issue is not queued. `push-issue-to-queue`: an Epic is refused and the other ids are still pushed. `auto-fix-all`: an Epic popped from the queue is skipped. |

**Gates**: the existing ones only. `make core-check` (lint and tests) and jscpd stay clean, and c8 coverage for the new code meets the repo's current threshold.

## Benefits

- Each implementation sub-issue (#689–#692) can be planned and reviewed on its own against one definition.
- The Epic label behaves the same way across creation, splitting and automation.
- The spec is removed in #693 once its lasting rules move into `docs/agents/architecture/`.

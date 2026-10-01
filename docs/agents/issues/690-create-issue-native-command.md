# Create-issue: native command

## Context

Part of epic #687 (new skill `/arcanum-create-issue`). The contract is defined in
[`docs/agents/specs/arcanum-create-issue.md`](../specs/arcanum-create-issue.md) (#688, done).
The `Epic` label (#689) has already shipped.

`/arcanum-create-issue` is native-only: its deterministic logic lives in `core/lib` commands
behind thin `--native-only` shims, with no `*_shell.sh` twin. This issue implements those
commands and shims; the skill files themselves are #691.

Where the original issue text and the spec differ, the spec wins. In particular, labels are
**not** restricted to a fixed allowed set: any well-formed label is accepted (the default
`Writting` and the suggestions are a skill-side concern).

## What needs to be done

### Native commands (`core/lib`, node)

Register two commands in `core/lib/core/commands.js` with `context: 'repo'`, not listed in
`migration-status.json`. Output is `KEY=value` lines; exit codes `0` success, `1` runtime
failure (`STATUS=error|failed` + `ERROR=`), `2` invalid input, `4` no `/dev/tty`
(`FALLBACK=chat`).

- **`arcanum-create-issue-start`** — `[--new | --resume <draft>]`
  - Preflight: `gh` authenticated and `origin` is a GitHub remote; on failure `STATUS=error`,
    exit `1`, no draft created.
  - Drafts live in `.claude/state/create-issue/<timestamp>.md`.
  - No drafts: create one, print `STATUS=new`, `FILE=<path>`.
  - Drafts exist + TTY: `/dev/tty` prompt (`[N]ew` or a draft number), print
    `STATUS=new|resumed`, `FILE=<path>`.
  - Drafts exist, no TTY: exit `4`, `FALLBACK=chat`, one
    `DRAFT=<path>\t<timestamp>\t<title or first line>` line per draft.
  - `--new` / `--resume <draft>` skip the prompt; unknown draft path exits `2`.
- **`arcanum-create-issue-publish`** — `<draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`
  - Validation: non-empty title and body; each label non-empty, no commas, no newlines;
    otherwise exit `2`, nothing created.
  - Labels matched case-insensitively against the repo's GitHub labels (existing spelling
    kept), deduped. Missing labels are created first (`Epic` → `fbca04`, others → `ededed`)
    with `WARNING=created label <name>` (for `Epic`, suggest `/arcanum-migrate`).
  - Prompt 5 (final confirmation, `[Y]es/[N]o/[C]hat`) and prompt 6 (`shipit`, default No)
    are TTY-first; without TTY exit `4` until `--confirmed` (and `--shipit-confirmed` when
    `shipit` is requested). Unconfirmed `shipit` is dropped.
  - Create the issue **with labels in a single REST call**: `IssueClient.createIssue` gains a
    labels argument; `GithubIssueService.create` is reused. The draft's level-1 heading is
    stripped from the body. No automatic retry.
  - Success: delete the draft, print `STATUS=ok`, `ID`, `URL`, `LABELS` (comma-separated),
    `EPIC=true|false`, plus `WARNING=` lines (`WARNING=draft not deleted: <path>` if deletion
    fails — still success).
  - Failure: exit `1`, `STATUS=failed`, `ERROR=<message>` (advising to check GitHub before
    retrying); draft kept.

### Shims (`arcanum-create-issue/scripts/`, scripter)

- `scripts/start.sh <repo_path> [--new | --resume <draft>]`
- `scripts/publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`

Both call `engine_dispatch --native-only`, modeled on
`arcanum-check-config/scripts/check_config.sh`.

### Docs (architect)

Update `docs/agents/` where the new commands affect described architecture (e.g. the
native-only entrypoint list, if one exists). Resolve the spec's open point on the default
color for auto-created labels (`ededed`).

## Acceptance criteria

- [ ] `start` creates/resumes drafts under `.claude/state/create-issue/`, with the preflight
      check, the TTY prompt and the exit-4 `DRAFT=` fallback
- [ ] `publish` creates the issue with the chosen labels in a single create call and prints
      `ID`, `URL`, `LABELS`, `EPIC`
- [ ] Malformed labels, empty title or empty body exit `2` and create nothing
- [ ] Missing labels are created with a `WARNING=`; labels are case-normalized and deduped
- [ ] Confirmation and `shipit` prompts follow the TTY-first / exit-4 `FALLBACK=chat` pattern;
      unconfirmed `shipit` is dropped
- [ ] The draft is deleted only after a successful create
- [ ] Both shims call `engine_dispatch --native-only`; no `*_shell.sh` twin
- [ ] Unit specs, the `IssueClient` labels spec and a `core/spec/bin/` CLI spec for the shims
      pass; lint and jscpd are clean

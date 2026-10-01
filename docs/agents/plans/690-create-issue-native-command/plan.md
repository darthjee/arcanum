# Plan: Create-issue: native command

Issue: [690-create-issue-native-command.md](../../issues/690-create-issue-native-command.md)

## Overview

Implement the two native-only commands behind `/arcanum-create-issue`
(`arcanum-create-issue-start` and `arcanum-create-issue-publish`) as `core/lib` commands, plus
their thin `--native-only` shims in `arcanum-create-issue/scripts/`. The contract is the spec at
[`docs/agents/specs/arcanum-create-issue.md`](../../specs/arcanum-create-issue.md) ("Draft file",
"Native commands", "Label rules", "Prompts", "Edge cases", "Testing"). The skill files
(`SKILL.md`, `steps/*.md`) are out of scope (#691).

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [architect](architect.md)

## Shared contracts

### Command registry (`core/lib/core/commands.js`)

| Command | `context` | Notes |
| --- | --- | --- |
| `arcanum-create-issue-start` | `repo` | `<repo_path>` is the first native argument, consumed by the dispatcher. |
| `arcanum-create-issue-publish` | `repo` | Same. |

Neither is listed in `arcanum/_lib/migration-status.json`; neither has a `*_shell.sh` twin.

### Shims (`arcanum-create-issue/scripts/`)

```text
start.sh   <repo_path> [--new | --resume <draft>]
publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...
```

Each calls, modeled on `arcanum-check-config/scripts/check_config.sh`:

```bash
engine_dispatch "$REPO_PATH" arcanum-create-issue-start   "" --native-only HOME -- "$@"
engine_dispatch "$REPO_PATH" arcanum-create-issue-publish "" --native-only HOME -- "$@"
```

i.e. `<repo_path>` followed by every remaining argument is forwarded unchanged (no
`--prepend-repo-path`). `HOME` is forwarded so `gh`/token resolution works under `env -i`
(add any further variables the native GitHub token resolution needs — node confirms the list,
matching other native GitHub-calling shims). Output and exit code pass through unchanged.

### Exit codes (both commands)

| Exit | Meaning |
| --- | --- |
| `0` | `STATUS=new`, `STATUS=resumed`, `STATUS=ok`, or (publish) `STATUS=declined` |
| `1` | `STATUS=error` (start) / `STATUS=failed` (publish), plus `ERROR=<message>` |
| `2` | Invalid input (bad args, malformed label, empty title/body, unknown `--resume` path). Nothing created. |
| `4` | No `/dev/tty`: `FALLBACK=chat` (+ `DRAFT=` lines for start) |

### Output keys (`KEY=value` lines on stdout)

| Key | Command | Meaning |
| --- | --- | --- |
| `STATUS` | both | `new`, `resumed`, `ok`, `declined`, `error`, `failed` |
| `CHOICE` | publish | `no` or `chat`: the answer at prompt 5 on `/dev/tty`, with `STATUS=declined` (exit `0`, nothing created, draft kept) |
| `FILE` | start | Draft path (`.claude/state/create-issue/<timestamp>.md`) |
| `DRAFT` | start | `<path>\t<timestamp>\t<title or first line>`, one per draft, on exit `4` |
| `FALLBACK` | both | Always `chat`, on exit `4` |
| `ID`, `URL` | publish | The created issue |
| `LABELS` | publish | Applied labels, comma-separated |
| `EPIC` | publish | `true` when `Epic` is among `LABELS` |
| `WARNING` | publish | Non-fatal notes; may repeat (`created label <name>`, `draft not deleted: <path>`) |
| `ERROR` | both | Failure message, on exit `1` |

### Auto-created label color

`Epic` → `fbca04`; any other missing label → `ededed` (resolves the spec's open point).

# Issue: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

## Description
`arcanum/migrations/run.sh`, driven by `/arcanum-migrate`, asks `[A]ll/[N]one/[S]elect/[C]hat` on `/dev/tty`. When the skill runs from a Claude Code session, the script is called through the agent's Bash tool, which may have no controlling terminal. The script then exits `1` with "no interactive terminal (/dev/tty) available…", and no migration is ever offered.

This is the same failure mode as #681 (`next_step_prompt.sh`). #681 is merged and defines the repo-wide "TTY-first with `AskUserQuestion` fallback" convention (exit `4` + `FALLBACK=chat`). This issue applies that convention to `run.sh` / `/arcanum-migrate` without redefining it.

## Problem
- `run.sh` (no subcommand) hard-fails with exit `1` when `/dev/tty` can't be opened. The skill can't tell this apart from a real error (halt, invalid semver, bad `--repo`).
- `run.sh` resets `.claude/state/arcanum-errors.json` **before** probing the TTY, so a no-TTY run still touches state.
- The prompt chain has several levels, each with its own `/dev/tty` read: `run.sh` (`[A]ll/[N]one/[S]elect/[C]hat`), `select_version.sh` (pick a version / `[D]one` / `[C]hat`), `update_per_version.sh` (per-version `[A]ll/[N]one/[S]elect/[C]hat`), and `update_per_file.sh` (per-entry `[R]un/[S]kip/[C]hat`). The non-interactive `apply` subcommands only cover whole-version runs with `--no-confirm`, so the deeper levels have no non-interactive equivalent.

## Expected Behavior
When `/dev/tty` is unavailable, `/arcanum-migrate` still offers the pending migrations and lets the user choose All / None / Select / Chat through `AskUserQuestion`, then applies the choice through the existing non-interactive `apply` subcommands. When a TTY is available, nothing changes. The `check`/`apply` subcommands and the `CHAT_CONTEXT`/`AI_INSTRUCTIONS` hand-off contract keep working as today.

## Solution
### `run.sh` (interactive form only)
- Add the test-only override `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`, same as `next_step_prompt.sh`, and use it for the probe and the read.
- Move the TTY probe **before** `_reset_errors_file`, so a no-TTY run doesn't touch state.
- When there are pending versions and the TTY can't be opened, don't fail. Print the same data `check` prints, prefixed by the fallback marker, and exit `4`:
  ```
  FALLBACK=chat
  CURRENT=<version>
  LOCAL=<version>
  GLOBAL=<version>
  PENDING=<version>   (one per pending version, ascending)
  ```
- "Up to date" stays exit `0`, with or without a TTY (no prompt is needed).
- Exit `1` keeps its meaning: halt, invalid semver, bad `--repo`, usage error, or the TTY closing mid-prompt. It no longer covers "no TTY".
- `check` and `apply` are unchanged.

Updated contract for the interactive form:

| Situation | stdout (last lines) | exit |
|---|---|---|
| Up to date / completed / `[N]one` | as today | `0` |
| Halt, usage error, invalid semver or `--repo`, TTY closed mid-prompt | as today | `1` |
| `[C]hat` or `AI_INSTRUCTIONS` hand-off | `CHAT_CONTEXT=…` / `AI_INSTRUCTIONS=…` | `3` |
| `/dev/tty` unavailable, pending versions exist | `FALLBACK=chat`, `CURRENT=`, `LOCAL=`, `GLOBAL=`, `PENDING=`… | `4` |

### `/arcanum-migrate` skill
- Step 1: reword the warning. The user will be prompted in their terminal if one is available, otherwise in the chat.
- New exit-`4` branch: ask with `AskUserQuestion`, listing the current and pending versions, with the options **All**, **None**, **Select**, **Chat**:
  - **All** → `run.sh apply --all --repo "$REPO_PATH"`.
  - **None** → nothing runs; end.
  - **Select** → a second `AskUserQuestion` listing the pending versions (ascending, up to 4 options; "Other" accepts any version typed) → `run.sh apply --select <version> --repo "$REPO_PATH"`. After it returns `0`, re-run `run.sh check` and, while versions are still pending, ask again with the remaining versions plus **Done**, mirroring `select_version.sh`'s loop.
  - **Chat** → the existing version-level `CHAT_CONTEXT=` branch (empty context: nothing selected yet).
  - A free-text "Other" answer to the first question is treated as Chat, with the text as context. A dismissed or rejected question is treated as None.
  - If `AskUserQuestion` is unavailable (e.g. headless `claude -p`, or the tool is denied): print the pending versions and the manual commands (`run.sh apply --all|--select <version> --repo <path>`) and end.
- Every `apply` result is relayed and branched on exactly as in Step 2 today (including `AI_INSTRUCTIONS` hand-offs, which `apply` already emits).
- Update the exit-`1` wording: it no longer includes "no-TTY".

### Granularity in fallback mode
In fallback mode, selection is **per version**. The per-version `[A]ll/[N]one/[S]elect` and per-entry `[R]un/[S]kip/[C]hat` prompts are not reproduced: `apply --select <version>` runs every pending entry of that version with `--no-confirm`. The user can pick **Chat** before applying to discuss a version or entry first.

### Out of scope
- `select_version.sh`, `update_per_version.sh`, `update_per_file.sh` keep their exit-`1` no-TTY error. In fallback mode they're only reached through `apply` with `--no-confirm`, so they never prompt.
- Per-entry selection without a TTY (would need new non-interactive subcommands).

### Docs
- `docs/agents/architecture/per-repo-migrations.md`: document the exit-`4` row for `run.sh` and the fallback granularity.
- `run.sh` header comment: Form 1 contract.

### Testing
- Spec: `run.sh --repo <fixture>` with `ARCANUM_TTY_DEVICE` pointing to a nonexistent path and pending versions → exit `4`, stdout contains `FALLBACK=chat` and the `CURRENT`/`LOCAL`/`GLOBAL`/`PENDING` lines; the errors file is not reset.
- Spec: same, but up to date → exit `0`, "Up to date" message, no `FALLBACK`.
- Spec: bad `--repo` without a TTY still exits `1` with nothing on stdout.
- No new `skill-reviewer` rule: #681's checklist item (any skill step calling a `/dev/tty`-owning script handles exit `4`) already covers `/arcanum-migrate`.

## Benefits
- `/arcanum-migrate` works in Claude Code sessions without a controlling terminal.
- A missing TTY is distinguishable (exit `4`) from real errors (exit `1`).
- Reuses the #681 convention; no new pattern.

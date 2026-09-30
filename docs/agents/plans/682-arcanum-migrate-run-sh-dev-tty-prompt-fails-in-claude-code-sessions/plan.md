# Plan: arcanum-migrate: run.sh /dev/tty prompt fails in Claude Code sessions

Issue: [682-arcanum-migrate-run-sh-dev-tty-prompt-fails-in-claude-code-sessions.md](../../issues/682-arcanum-migrate-run-sh-dev-tty-prompt-fails-in-claude-code-sessions.md)

## Overview
Apply the #681 "TTY-first with `AskUserQuestion` fallback" convention to `arcanum/migrations/run.sh` and `/arcanum-migrate`. `run.sh`'s interactive form stops failing with exit `1` when `/dev/tty` can't be opened. Instead it exits `4` with `FALLBACK=chat` plus the `check`-style version data. The skill then asks All / None / Select / Chat with `AskUserQuestion` and applies the answer through the existing `apply` subcommands. Selection in fallback mode is per version only. The sub-scripts (`select_version.sh`, `update_per_version.sh`, `update_per_file.sh`) are unchanged.

## Agents involved

- [scripter](scripter.md)
- [skill-writer](skill-writer.md)
- [node](node.md)
- [architect](architect.md)

## Shared contracts

**`run.sh [--repo <path>]` (interactive form, no subcommand) — new exit-`4` path:**

- Test-only env override: `ARCANUM_TTY_DEVICE` (defaults to `/dev/tty`), read once as `TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"`. It is used for both the probe and the read. It is not a user-facing setting.
- Order of operations in `cmd_interactive`:
  1. Resolve the three versions (exit `1` on invalid semver, as today).
  2. Compute pending. If none: print the existing "Up to date (…)." line and exit `0`, with or without a TTY.
  3. Probe `$TTY_DEVICE`. If it can't be opened: print **only** the lines below to stdout (warnings stay on stderr) and exit `4`. The errors file is **not** reset. The human-readable "Current version:/Pending versions:" block is not printed.
     ```
     FALLBACK=chat
     CURRENT=<committed version>
     LOCAL=<local version>
     GLOBAL=<global version>
     PENDING=<version>        (one line per pending version, ascending)
     ```
  4. Otherwise: `_reset_errors_file`, print the human block, prompt, as today.
- `--repo` validation (not a directory → exit `1`, nothing on stdout) still runs before any TTY probe.
- Exit `1` no longer covers "no TTY". It keeps: halt, usage error, invalid semver, bad `--repo`, TTY closed mid-prompt.
- `check` and `apply --all|--none|--select <version>` are unchanged (no TTY use, never exit `4`).

**Skill-side mapping (`arcanum-migrate/SKILL.md`, exit `4`):**

| `AskUserQuestion` answer | Action |
|---|---|
| All | `run.sh apply --all --repo "$REPO_PATH"` |
| None | nothing runs; end |
| Select | second question: pending versions ascending (max 4 options, "Other" = any typed version) → `run.sh apply --select <version> --repo "$REPO_PATH"`; on exit `0`, `run.sh check --repo "$REPO_PATH"`; while `PENDING=` lines remain, ask again with the remaining versions plus **Done** |
| Chat | existing version-level `CHAT_CONTEXT=` branch (empty context) |
| Free-text "Other" on the first question | Chat, with the text as context |
| Dismissed / rejected | None |
| `AskUserQuestion` unavailable | print pending versions and the manual `run.sh apply --all` / `--select <version>` commands (with `--repo`), end |

# Plan: Arcanum migrate is not executing in a script

Issue: [131-arcanum-migrate-is-not-executing-in-a-script.md](../../issues/131-arcanum-migrate-is-not-executing-in-a-script.md)

## Overview

Collapse `arcanum-migrate/SKILL.md`'s current three separate agent-issued Bash calls (`run.sh check` → chat-mediated `[A]ll/[N]one/[S]elect` → `run.sh apply`) into a single call into `run.sh`'s existing bare/interactive form, letting bash own the whole confirmation flow via `/dev/tty` end to end. Add an explicit, optional `--repo <path>` argument threaded through the whole `run.sh` → `select_version.sh`/`update_per_version.sh` → `update_per_file.sh` chain (install location stays self-derived via `BASH_SOURCE`, never made explicit). Add a `[C]hat` option at every prompt level in that chain, propagated via a new exit code `3` (mirroring how halt/`exit 2` already propagates), so a user can still get an LLM-mediated dialogue when they want it without paying the token cost by default. Correct `docs/agents/architecture.md`'s now-stale rationale for why the old split existed, and document the new pattern as the preferred convention going forward.

## Context

Issue #128/PR #129 added `arcanum-migrate` with the stated intent of a single master script, script-to-script chaining, and all user interaction handled by bash. The scripts already chain correctly and already use `/dev/tty` (`run.sh` → `select_version.sh`/`update_per_version.sh` → `update_per_file.sh`), but `arcanum-migrate/SKILL.md` never actually calls the bare/interactive form — it does check/confirm(chat)/apply as three separate calls instead, matching `arcanum-update`'s deliberate pattern (documented in `architecture.md`) of avoiding TTY prompts through an agent-mediated Bash tool call. This issue's discussion confirmed TTY-through-a-tool-call does work reliably, so that rationale is now stale for `arcanum-migrate` specifically (NOT for `arcanum-update`, which is out of scope and keeps its existing split).

Full design detail, rejected alternatives, and edge cases are in the issue file — this plan implements what it settled on.

## Implementation Steps

### Step 1 — `update_per_file.sh`: `[C]hat` option, no-TTY detection, exit code 3

This is the deepest layer in the chain — its contract change (new exit code) is what every caller above must learn to propagate, so implement and get it right here first.

- Add `[C]hat` as a third option alongside the existing `[R]un/[S]kip` prompt (only shown when not `--no-confirm`).
- Before attempting the `/dev/tty` read, verify `/dev/tty` is actually open/readable; if not, fail fast with a clear error to stderr instead of blocking forever.
- On `[C]hat`: print `CHAT_CONTEXT=<version>/<file_basename>` to stdout and exit `3` — do not run the migration, do not advance the recorded version.
- Exit code contract becomes: `0` = success/skip, `2` = halt (non-skippable failure, existing), `3` = chat requested (new). Update the file's header comment to document this.

### Step 2 — `update_per_version.sh`: propagate `[C]hat`, add its own `[C]hat` option

- Add `[C]hat` alongside the existing per-file-list `[A]ll/[N]one/[S]elect` prompt (offered before iterating files, same tty-availability check as Step 1).
  - On `[C]hat` chosen at this level: print `CHAT_CONTEXT=<version>` and exit `3` immediately (no file has been touched yet).
- In the loops that call `update_per_file.sh` (both the `[A]ll` branch and the `[S]elect` branch), check for exit `3` the same way `2` is already checked, and re-propagate immediately (`exit 3`) — do not continue to the next file.
- Update the file's header comment for the new exit code and prompt option.

### Step 3 — `select_version.sh`: propagate `[C]hat`, add its own `[C]hat` option

- Add `[C]hat` (or `[D]one`-equivalent) to the version-selection prompt loop.
  - On `[C]hat` chosen here: print `CHAT_CONTEXT=` (no version yet — nothing has been selected) and exit `3`.
- After calling `update_per_version.sh`, check its exit code for `3` in addition to the existing `2` check, and propagate immediately (`exit 3`) instead of looping back to the prompt.
- Same tty-availability check as Steps 1–2 before its own `read`.

### Step 4 — `run.sh`: `--repo` argument, `[C]hat` propagation, no-TTY fail-fast

- Add an optional `--repo <path>` CLI argument (parsed alongside the existing `check`/`apply` subcommand dispatch). When given, resolve `CONFIG_FILE`/`ERRORS_FILE` relative to it instead of cwd; when omitted, keep today's cwd-relative behavior unchanged (backward compat for direct terminal use — see the issue's Edge Cases/Backward compatibility sections).
- Thread `--repo` through every call this script makes into `update_per_version.sh`/`select_version.sh` (which in turn must thread it into `update_per_file.sh` — extend those two scripts' own signatures to accept and forward an optional repo-path argument, consistently with Steps 1–3).
- In `cmd_interactive`: add `[C]hat` to the `[A]ll/[N]one/[S]elect` prompt (with the same no-TTY fail-fast check as the layers below), and check the exit code of `_run_all`/`select_version.sh` for `3` (in addition to the existing `2` check), propagating it (exit `3`) rather than falling through to `_print_errors`/exit `0`.
- `cmd_check`/`cmd_apply` (the existing non-interactive forms used as the resume path after a chat detour) are unaffected in behavior, just also accept/forward `--repo`.
- Update the file's top-of-file usage/contract comment for `--repo`, the new exit code, and `[C]hat`.

### Step 5 — `arcanum-migrate/SKILL.md`: single call, TTY-modality warning, exit-code branching

Rewrite the skill to:
1. Resolve `REPO_PATH="$(pwd)"` at the top (matching the convention documented in `docs/agents/architecture.md`'s "Repo Path Threading" section).
2. Immediately before the call, tell the user they're about to be prompted directly in their terminal (not the chat box) for `[A]ll/[N]one/[S]elect/[C]hat`.
3. Make exactly one call:
   ```bash
   <path to run.sh, resolved relative to this skill's own folder> --repo "$REPO_PATH"
   ```
4. Relay the full captured stdout/stderr verbatim into the chat transcript once the call returns (per the issue's Output visibility section — this is not optional, even though the human already saw it live in their terminal), then branch on exit code:
   - `0` — completed cleanly (parse `CURRENT`/pending info already in the captured output for an "up to date" vs. "advanced to `<version>`" summary line).
   - `2` — halted; report the relayed error, note it's safely re-runnable (existing convention).
   - `3` — parse `CHAT_CONTEXT` from the captured output, hold a plain chat dialogue about the identified version/file (reading its paired `.md` description when present), and once the user decides, resume via `run.sh apply --all|--none|--select <version> --repo "$REPO_PATH"` (no `AskUserQuestion`, no re-entering the `/dev/tty` prompt).

### Step 6 — Correct `docs/agents/architecture.md`

- In the "Per-Repo Migrations" section (around the existing paragraph describing the runner chain), remove the claim that `run.sh`'s `check`/`apply` split exists so `/arcanum-migrate` can avoid "relying on live TTY relay through a tool call." Replace it with a description of the new behavior: `arcanum-migrate` now drives `run.sh`'s bare/interactive form directly in a single call (TTY-through-a-tool-call confirmed to work), with a `[C]hat` escape hatch (exit code `3`, propagated the same way halt/`2` is) as the bridge back to the still-present `check`/`apply` non-interactive form. Explicitly note `arcanum-update` is unchanged and still uses its own check/chat-confirm/apply split for now — don't let the correction imply otherwise.
- Add a short callout (in this section or "Repo Path Threading") marking `arcanum-migrate`'s pattern — single master script, bash-owned `/dev/tty` interaction with a `[C]hat` escape hatch, explicit optional `--repo` argument — as the **preferred convention** for any future skill that needs user confirmation/selection, referencing it as the concrete example to copy.

### Step 7 — Add checklist item to `docs/agents/issue-enhancement.md`

Add (same mechanism issue #128 used to add "Migration needed?"):

> **Script-driven interaction?** — does this change involve a skill that prompts the user for confirmation/selection, or calls multiple of its own scripts in sequence? If so, prefer a single master script that owns the whole interactive flow via `/dev/tty` (not chat-mediated Y/N), taking the repo path as an explicit argument rather than relying on ambient cwd. See `arcanum-migrate` for the reference implementation.

### Step 8 — Point to the new convention from `AGENTS.md`

Add one bullet to `AGENTS.md`'s "Conventions" section (matching its existing terse style) pointing at `docs/agents/architecture.md`'s "Per-Repo Migrations"/"Repo Path Threading" sections as the reference for skills needing user confirmation/selection — keep it to a one-line pointer, the full explanation lives in `architecture.md`.

## Files to Change

- `arcanum/migrations/update_per_file.sh` — `[C]hat` option, no-TTY fail-fast, exit code `3`.
- `arcanum/migrations/update_per_version.sh` — `[C]hat` option, propagate exit `3`, accept/forward repo-path arg.
- `arcanum/migrations/select_version.sh` — `[C]hat` option, propagate exit `3`, accept/forward repo-path arg.
- `arcanum/migrations/run.sh` — `--repo` argument, `[C]hat` propagation in `cmd_interactive`, no-TTY fail-fast.
- `arcanum-migrate/SKILL.md` — single call, TTY-modality warning, exit-code branching (`0`/`2`/`3`), chat-then-resume flow.
- `docs/agents/architecture.md` — correct the stale "Per-Repo Migrations" rationale; document the new pattern as preferred.
- `docs/agents/issue-enhancement.md` — new "Script-driven interaction?" checklist item.
- `AGENTS.md` — one-line pointer to the new convention.

## Notes

- No migration script is needed for this issue (confirmed in the issue file) — nothing about a consuming repo's on-disk state changes.
- `arcanum-update` is explicitly untouched — converting it to the same pattern is a candidate follow-up issue, not part of this one.
- Locking (`arcanum/_lib/lock.sh`) around `repo_config_set_version` and the errors file must be preserved unchanged throughout Steps 1–4; the repo-path threading must not bypass or duplicate it.
- The `[A]ll`/`[N]one`/`[S]elect` confirmation gate is a blast-radius control, not just UX (per #128) — the no-TTY-and-no-explicit-mode case must fail closed (stop, nothing runs), never silently default to `[A]ll`.
- Related but out of scope: issue #134 (filed during this issue's `discuss-issue` run) covers the same "ambient cwd vs. explicit repo path" root cause for a different set of cross-skill scripts (`checkout_from_main.sh`, `commit_issue.sh`, etc.) — not part of this plan.

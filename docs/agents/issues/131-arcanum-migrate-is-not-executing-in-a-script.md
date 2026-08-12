# Issue: Arcanum migrate is not executing in a script

## Description

Issue #128 (PR #129, commit `daf97ea9`) added the `arcanum-migrate` skill so repos that already installed arcanum can catch up on per-repo structural changes (renamed/moved config files, new folders, new config shapes) shipped by newer arcanum versions. The intent was for the skill to call a single master script, with the scripts themselves calling each other, and for **all** user-facing interaction (answering confirmation/selection prompts) to be handled by bash — not by the agent.

In practice, `arcanum-migrate/SKILL.md` doesn't do that: it issues three separate agent-driven Bash tool calls (`run.sh check`, then a chat-mediated `[A]ll/[N]one/[S]elect` confirmation held in the conversation, then `run.sh apply --all|--select`), even though `arcanum/migrations/run.sh` already has a bare/interactive form that owns the whole check → confirm → apply flow internally via `read -r choice < /dev/tty`.

## Problem

- `arcanum-migrate/SKILL.md` makes three separate Bash tool calls (`run.sh check`, then apply) instead of one, and the `[A]ll/[N]one/[S]elect` confirmation happens as chat dialogue rather than through bash — the opposite of the "single master script, all interaction via bash" intent from #128.
- `run.sh` and the chain below it (`update_per_version.sh`, `update_per_file.sh`, `select_version.sh`) already call each other correctly and already use `/dev/tty`, but rely on ambient cwd (assumed to be the target repo) instead of an explicit repo-path argument — fragile for any future caller whose cwd isn't the target repo.
- `docs/agents/architecture.md` currently documents the chat-mediated split as *deliberate*, specifically to avoid driving `/dev/tty` prompts through an agent-mediated Bash tool call (the same reasoning cited for `arcanum-update`'s identical split). This has been confirmed stale for `arcanum-migrate` — TTY-through-a-tool-call does work reliably — but the doc still claims otherwise, which would mislead anyone reading it after this change.
- There's no escape hatch today for a user who wants the LLM's input (e.g. reading a migration's description, discussing trade-offs) before deciding — the interactive prompt only supports `[A]ll/[N]one/[S]elect`.

## Expected Behavior

- `arcanum-migrate/SKILL.md` makes exactly **one** call into `run.sh`'s bare/interactive form (extended with a `[C]hat` escape hatch), instead of the current check → chat-confirm → apply three-call sequence.
- Bash owns `[A]ll/[N]one/[S]elect` (and the new `[C]hat`) via `/dev/tty` at every level of the chain (`run.sh`, `update_per_version.sh`'s per-file prompt, `update_per_file.sh`'s `[R]un/[S]kip`, `select_version.sh`'s loop) — not chat, by default.
- `run.sh` and the chain below it accept an explicit, **optional** `--repo <path>` argument, threaded through the whole chain, defaulting to cwd so direct terminal use keeps working unmodified. No explicit install-location argument is added — it stays self-derived via `BASH_SOURCE`, which is never ambiguous.
- Choosing `[C]hat` at any level hands control back to the skill (distinct exit code `3` + `CHAT_CONTEXT=<version>[/<file>]`, propagated immediately up the chain the same way the existing halt code `2` already is). The skill then holds a plain chat dialogue and, once resolved, resumes via the existing non-interactive `run.sh apply --all|--none|--select <version>` form — no new execution path needed for the chat case.
- `docs/agents/architecture.md`'s "Per-Repo Migrations" section is corrected to reflect `arcanum-migrate`'s new behavior, without implying `arcanum-update` (left unchanged) also changed.
- `docs/agents/issue-enhancement.md` gains a new "Script-driven interaction?" checklist item so future `enhance-issue` dialogues consider this pattern.
- The skill warns the user, immediately before the blocking call, that they'll be prompted directly in their terminal rather than the chat box.
- The full captured stdout/stderr of the single call is still relayed verbatim into the chat transcript once it returns (not summarized away), plus a short plain-language summary of the final outcome.

## Solution

### Scope boundaries

**In scope:**
- `arcanum-migrate/SKILL.md` — stop doing check → chat-mediated `[A]ll/[N]one/[S]elect` confirmation → apply as three separate agent-issued bash calls. Instead, invoke a single master script and let bash own the interactive prompt end to end, the same way `arcanum/install/installer.sh` and `arcanum/update/updater.sh` already do via `read -r choice < /dev/tty`.
- `arcanum/migrations/run.sh` and the chain below it (`update_per_version.sh`, `update_per_file.sh`, `select_version.sh`) — these already call each other correctly and already use `/dev/tty`, but currently rely on ambient cwd (assumed to be the target repo) instead of an explicit argument. Add an explicit, optional `--repo <path>` argument, threaded through the whole chain.
- Documentation — add guidance (e.g. in `AGENTS.md` or a relevant skill-authoring guide) establishing "single master script, bash-driven `/dev/tty` interaction, explicit repo-path argument" as the **preferred pattern in general** for skills that need user confirmation/selection, so future skills follow it by default.
- `docs/agents/issue-enhancement.md` — add a new checklist item (same mechanism issue #128 used to add "Migration needed?"):

  > **Script-driven interaction?** — does this change involve a skill that prompts the user for confirmation/selection, or calls multiple of its own scripts in sequence? If so, prefer a single master script that owns the whole interactive flow via `/dev/tty` (not chat-mediated Y/N), taking the repo path as an explicit argument rather than relying on ambient cwd. See `arcanum-migrate` for the reference implementation.

  This file change must be committed as part of this issue's PR, same as #128 required for its own checklist addition.

**Out of scope:**
- Retrofitting other existing skills that currently do chat-mediated confirmation (e.g. `auto-fix-all`'s clear_context toggle, `discuss-issue`'s save confirmation) to this pattern — left as a documented convention for new/future work, not a bulk refactor here.
- Converting `arcanum-update` to the same single-master-script pattern — it keeps its existing check/chat-confirm/apply split for now; a candidate follow-up issue, not part of this one.
- The migration file contract itself (`NNN.sh config`/`NNN.sh run`, skippable/halt semantics) — unchanged.
- Adding actual migration content under `arcanum/migrations/repos/0.10.0/` (currently just `.keep`) — unrelated to this issue.

### Edge cases

- **No TTY available.** Handling is a mix of caller-declared mode and self-detection:
  - A caller that already knows its own context (the `arcanum-migrate` skill in an interactive session, or any future automated caller) can declare the behavior explicitly up front, reusing the existing non-interactive path (`apply --all` / `--none` / `--select <version>`) — no prompt is attempted in that case.
  - If no explicit mode is supplied and the script is about to prompt, it must first verify `/dev/tty` is actually open/readable. If it isn't, fail fast with a clear error instead of hanging indefinitely. Not a currently foreseeable scenario for `arcanum-migrate` (always human-triggered today), but the fallback should exist defensively for whatever calls this chain next.
- **Backward compat for direct terminal use.** The new `--repo` argument stays *optional*, defaulting to cwd/`BASH_SOURCE` resolution — a human running `run.sh` bare, standing in the repo, must keep working exactly as documented today.
- **Self-hosted vs. global install layout.** Resolution must work both when arcanum *is* the repo (this repo) and the normal case where arcanum installs elsewhere (default `~/.claude/skills`), distinct from the target repo.
- **Halt/resume across the single master call.** A migration that halts (`exit 2`) partway through freezes the recorded version at the last clean point; re-invoking `/arcanum-migrate` afterward must still resume correctly now that the skill drives one call instead of three.
- **Invalid `--repo` argument.** If a caller passes a bad/garbage path, `run.sh` should validate it and fail with a clear error, rather than silently misbehaving.

### Backward compatibility

- **This reframes a previously deliberate design decision, not a bug fix.** `docs/agents/architecture.md` (the "Per-Repo Migrations" section) currently documents the check → chat-confirm → apply split as intentional, specifically to avoid driving `/dev/tty` prompts through an agent-mediated Bash tool call — citing `arcanum-update`'s identical split as the same reasoning applied elsewhere. TTY-through-a-tool-call has been confirmed to work reliably, so this rationale is stale for `arcanum-migrate` specifically and **must be corrected in `architecture.md` as part of this change**.
- **`arcanum-update` is explicitly not touched by this issue** — it keeps its existing check/chat-confirm/apply split for now, as a separate, still-valid choice. The `architecture.md` correction must describe `arcanum-migrate`'s new behavior without implying `arcanum-update` changed too.
- **`run.sh check` / `run.sh apply --all|--none|--select`** subcommands remain the correct non-interactive path for callers that already know their own mode and stay as-is. Only `arcanum-migrate/SKILL.md`'s *use* of them changes.
- **Direct terminal usage** (`run.sh` bare, no args, standing in the repo) must keep working unmodified.
- **No data/config shape changes.** `.claude/configuration/arcanum-repo-config.json`, `.claude/state/arcanum-errors.json`, and the migration file contract are untouched by this issue.

### Performance & security considerations

- **Performance is not a real concern**, same conclusion as #128 reached for this same script chain: migrations run once per repo, sequentially, bounded by a small number of scripts. Collapsing the skill's 3 agent-issued Bash calls into 1 is a minor efficiency/latency win, not a meaningful performance requirement.
- **Locking must be preserved through the refactor.** `repo_config_set_version` and the error-file writes already go through `arcanum/_lib/lock.sh` and must keep doing so unchanged.
- **The `[A]ll`/`[N]one`/`[S]elect` confirmation gate is a blast-radius control, not just UX** (#128 called this out explicitly for this same chain). Collapsing 3 tool calls into 1 changes *how* the prompt is delivered (chat → `/dev/tty`), not *whether* it happens. The no-TTY-and-no-explicit-mode fail-fast behavior is safety-critical: it must fail closed rather than silently default to `[A]ll` and run unattended.
- **New arguments are plain filesystem paths, not interpreted.** The `--repo` argument must be passed as a quoted script argument (never `eval`'d or interpolated into a shell string).
- **`--repo` validation also has a security angle**, not just a UX one: without validating the passed path, a wrong or malicious value could cause the chain to read/write in an unintended location.

### Alternative solutions

Considered and rejected:
- **Status quo** (keep `arcanum-migrate` matching `arcanum-update`'s check → chat-confirm → apply split) — rejected: it's exactly what this issue objects to, and TTY-through-a-tool-call has been confirmed to work.
- **`AskUserQuestion`-based structured confirmation instead of `/dev/tty`** — more structured than free-form chat, but still agent-mediated (costs tokens) and still ≥2 tool calls, defeating "single master script" and "interaction done by bash."
- **Consolidate check+apply into one call but keep confirmation in chat** — a half-measure: still chat-mediated and still not a single script call.

Chosen approach — **single master script (`run.sh`, bare form) with a `[C]hat` escape hatch, available at every prompt level in the chain**:
- The common case (`[A]ll`/`[N]one`/`[S]elect`) stays fully bash-internal via `/dev/tty`, zero extra tokens, at every level of the chain (`run.sh`, `update_per_version.sh`'s per-file prompt, `update_per_file.sh`'s `[R]un/[S]kip`, `select_version.sh`'s loop).
- Any of those prompts also offers `[C]hat`. Choosing it hands control back to the skill instead of trying to converse in bash.
- **Handoff contract:** a `[C]hat` choice at any level exits with a distinct code (`3` — not `0`=clean, not `2`=halt/failure) that every caller in the chain re-propagates immediately, the same way `exit 2` already propagates today. The exiting layer also prints `CHAT_CONTEXT=<version>[/<file>]` identifying the most specific thing the user asked about.
- **Resuming after chat needs no special state.** Every successful file/version already advances the recorded version idempotently as it runs. After the chat dialogue resolves, the skill simply re-invokes the top-level `run.sh` again.
- This reuses (rather than discards) the script's existing three-form contract: the interactive form is the cheap default entry point, and `run.sh apply --all|--none|--select <version>` remains exactly what the skill calls once a chat-driven decision is reached.

### Migration needed?

No. This issue changes the `arcanum-migrate` skill and the migration tooling itself — it doesn't change any config file shape, folder layout, or other repo-side artifact that an already-installed consuming repo would need to catch up on. Nothing for a consuming repo to migrate.

### Single master-script entry point

- The master script is `arcanum/migrations/run.sh`, **bare/interactive form**, extended with the `[C]hat` escape hatch described above.
- **Only one new explicit argument is needed: the repo path (`--repo <path>`).** It's genuinely ambiguous today (the chain assumes cwd == target repo). It must be threaded through the whole chain, so every relative path currently assumed against cwd resolves against it instead. Stays **optional**, defaulting to cwd.
- **No explicit install-location argument.** `SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"` is never ambiguous the way cwd is — the script always runs from wherever it's physically installed, so this stays self-derived.
- `arcanum-migrate/SKILL.md` resolves `REPO_PATH="$(pwd)"` up front (same pattern already used by other skills, e.g. `enhance-issue`), then makes exactly **one** call instead of today's three:
  ```bash
  <path to run.sh, resolved relative to this skill's own folder> --repo "$REPO_PATH"
  ```
- The skill's job collapses to: make that one call, relay its stdout/stderr live, and branch on the exit code — `0` = completed cleanly (possibly a no-op), `2` = halted (report and point at the relayed error, safely re-runnable), `3` = `[C]hat` requested (read `CHAT_CONTEXT`, hold a dialogue, then re-invoke the same single call to resume).

### Bash-mediated vs chat-mediated interaction

- **Interaction modality switches, and the skill must say so before it happens.** `read -r choice < /dev/tty` drops the user into a raw terminal prompt — a different input surface than the normal chat box. `arcanum-migrate/SKILL.md` must tell the user this is coming, immediately before issuing the single call.
- **The modality only toggles once per `[C]hat` detour, not repeatedly.** After exit `3`, control returns fully to ordinary chat for the dialogue; once resolved, the skill goes back to a plain non-interactive call, not back into another `/dev/tty` prompt.
- **No `AskUserQuestion` anywhere in this flow** — bash owns the choice prompts by default, chat is entered only via an explicit `[C]hat`, and even then it's plain dialogue.

### Output visibility

Two distinct channels, not one:
- **The real terminal** — while `run.sh` is blocked on `/dev/tty`, the user sees the live prompt and types their answer there directly.
- **The chat transcript** — only receives the full captured stdout/stderr once the whole single call *completes*.

The full captured output must still land in the chat transcript verbatim once the single call returns — version/pending list, the chosen prompt, every subsequent migration line, and the final error-file dump `run.sh` already prints. On top of that raw relay, the skill adds a short plain-language summary of the final outcome, as an addition, not a replacement. This also means the `CHAT_CONTEXT`/`PENDING`/`CURRENT` lines needed for the exit-`3` branch are already present in that same captured output — no separate fetch call needed.

## Benefits

- Delivers what #128/PR #129 originally intended: scripts chaining to a single master entry point, with all user interaction handled by bash instead of the agent.
- Fewer agent-issued tool round-trips per `/arcanum-migrate` run (3 → 1), and no token cost for the common `[A]ll/[N]one/[S]elect` case.
- The `[C]hat` escape hatch still gives users access to the LLM's judgment exactly when they actually want it, without paying for it on every run.
- Establishes a documented, reusable "single master script + bash-driven interaction + explicit repo-path argument" convention (via `AGENTS.md`/guide + the new `issue-enhancement.md` checklist item) that future skills can follow by default instead of reinventing chat-mediated confirmation each time.
- Corrects a stale architectural claim in `docs/agents/architecture.md` before it misleads future readers.

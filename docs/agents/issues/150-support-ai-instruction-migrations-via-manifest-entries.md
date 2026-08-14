# Issue: Support AI-instruction migrations via manifest entries

## Description

AI-instructions half of #147. Depends on #149 (closed), which introduced the `migrations.json` manifest format and local/repo scope tracking — this issue builds `type: "instructions"` on top of that same schema rather than introducing a second, breaking schema change.

## Problem

Right now, migrations are purely deterministic scripts. We want migrations that can also hand work to an AI to perform — e.g. changes that need judgment, can't be scripted deterministically, or benefit from asking the user something along the way.

## Solution

### Approach chosen

Walking the existing migration chain (`arcanum/migrations/run.sh` → `update_per_version.sh` → `update_per_file.sh`), extend the existing `[C]hat`/`CHAT_CONTEXT`/exit-`3` hand-off mechanism (today used only when a user explicitly asks to chat about a migration) rather than:

- **Script directly triggers an AI** — not achievable: a bash subprocess run by `update_per_file.sh` has no channel back into the Claude Code session.
- **AI drives the loop, script returns a list of migrations to invoke** — inverts control; would duplicate the halt/skippable/version-advance bookkeeping `update_per_file.sh`/`update_per_version.sh` already own, moving it into AI judgment instead of deterministic code.
- **Separate `scripts/`/`instructions/` folders** — introduces its own open question (run order across two folders) that the manifest already resolves for free.
- **Instructions embedded directly in the existing `.md` file** — conflates two audiences in one file: the human-facing summary shown at the `[R]un/[S]kip/[C]hat` prompt, and AI-facing instructions that shouldn't be dumped to the terminal.

A script signals, the orchestrating skill (`arcanum-migrate`) acts on the instructions, then resumes the script chain — this is the realistic version of "script triggers AI."

### `type: "instructions"` manifest entries

Building on #149's `migrations.json` schema:

```json
{"id": "002", "type": "instructions", "description_file": "002.md", "instructions_file": "002.instructions.md", "skippable": true, "applies_to": "local"}
```

`instructions`-type entries get the same `[R]un/[S]kip/[C]hat` prompt as `script` entries, for UX parity. Two separate `.md` files per instructions entry, not one file doing double duty:
- `<id>.md` — human-facing description, shown at the confirm prompt, exactly like today's paired `.sh`/`.md`.
- `<id>.instructions.md` — AI-facing content, never printed to the terminal, only handed to the AI once `[R]un` is chosen (or under `--no-confirm`).

### Generalized hand-off

Hitting an `instructions` entry is not optional the way `[C]hat` is today — a bash loop cannot execute one itself, so `update_per_file.sh` must hand off on *every* `instructions` entry it reaches (choosing `[R]un`, or under `--no-confirm`), not just when a user asks to chat. It reuses the exact exit-`3` contract already shipped for `[C]hat`, printing `AI_INSTRUCTIONS=<version>/<id>` instead of `CHAT_CONTEXT=<version>/<file>` — a distinct prefix so callers can tell the two hand-off reasons apart from the same exit code.

### Distinguishing the hand-off in `arcanum-migrate`

`arcanum-migrate/SKILL.md`'s existing Step 2 only ever sees `CHAT_CONTEXT` after exit `3` today. It grows a second branch:

- `CHAT_CONTEXT=<version>[/<file>]` (unchanged) — open-ended discussion; nothing runs until the user decides, then resume via `run.sh apply --all|--none|--select <version>`.
- `AI_INSTRUCTIONS=<version>/<id>` (new) — autonomous hand-off. Read the entry's `<id>.instructions.md`, perform the work, mark the ledger entry complete (see below), then resume the chain on its own via `run.sh apply --select <version>` — no extra user confirmation beyond the original `[R]un` choice (or `--no-confirm`) that triggered the hand-off in the first place.

### `[C]hat` on an instructions entry

Since `[R]un` already hands the entry to the AI, `[C]hat` means something narrower here than it does for `script` entries: a conversation about the entry before committing to the literal `<id>.instructions.md` content, with several possible outcomes, all decided in chat, none re-entering the `/dev/tty` prompt:
- the user is satisfied just discussing it — nothing runs, the entry stays pending;
- the user proposes an alternative approach — the AI performs that alternative directly instead of the literal instructions, then marks the ledger entry complete (the entry's intent was satisfied, just not via the literal file) and skips `[R]un`;
- the user wants both — the AI performs the alternative and the original instructions, in whichever order the user asked for, before marking the entry complete.

In every outcome the AI itself decides when the entry is done and marks the ledger accordingly; there's no re-entry into the `/dev/tty` prompt to reconcile back with the script chain's own state.

### Ledger helper script

Ledger reads/writes go through a dedicated helper, `arcanum/migrations/_ledger.sh`, mirroring `_manifest.sh`'s shape and the lock-protected append pattern `update_per_file.sh` already uses for `.claude/state/arcanum-errors.json`:
- `_ledger_is_complete <version> <id>` — exit 0/1, used by the runner on resume to decide which entries to skip.
- `_ledger_mark_complete <version> <id>` — lock-protected append/update.

`arcanum-migrate` calls `_ledger_mark_complete` itself once it finishes an instructions entry's work (whichever outcome above applied). The runner scripts (`update_per_file.sh`/`update_per_version.sh`) only ever hand off, and on resume *read* the ledger to know which entries to skip — they never write to it themselves, since they have no visibility into whether the AI's work actually succeeded.

### Completion ledger + resume-without-replay

Because hand-off becomes the *normal* path through a version's manifest rather than a rare detour, resuming after handling one `instructions` entry can't just replay the whole version from the top the way today's `[C]hat` resume does (relying on script idempotency) — without a completion marker, resuming after entry `002` would hand off to the AI for `002` again on the very next pass (infinite loop). The persistent ledger (`.claude/state/arcanum-migrations-ledger.json`, managed via `_ledger.sh` above) tracks per-entry completion; resume always continues from the first not-yet-completed entry.

Ledger file placement: it's a runtime record of what's happened during migration runs, not configuration — same class as the existing `.claude/state/arcanum-errors.json` (a standalone, non-namespaced flat array with its own lock, deliberately not routed through `repo_config.sh`). The ledger follows that exact pattern rather than being namespaced into either config file.

No backfill/bootstrap entry is needed for the ledger: legacy `0.9.3`/`0.12.0` stay wholesale `repo`-scoped (per #149) and never touch the ledger at all, and `local`-scoped/`instructions` entries only start existing from whichever version first ships this capability — the ledger ships together with the first entries that ever use it, so there's no pre-ledger history to backfill.

### `generate_next.sh` grows into a scaffolding tool

On top of #149's manifest-awareness, the script grows from a pure "print the next id" helper into a small scaffolding tool: given `--type script|instructions`, it appends the new entry to `migrations.json` and creates that type's skeleton files:
- `script` → `<id>.sh` (`config`/`run` skeleton, matching the existing `NNN.sh` shape) + `<id>.md` (empty description template).
- `instructions` → `<id>.md` (empty description template) + `<id>.instructions.md` (empty AI-instructions template).

Both types share a single id sequence (not a separate counter per type) — consistent with the manifest array already being the single source of run order; a per-type counter would reintroduce the ordering ambiguity the manifest was meant to remove.

### Documentation

Mirrors #149's convention of keeping the directly-affected end-user guides in sync with user-visible behavior changes: `docs/guides/arcanum-repo-version.md` and `docs/guides/arcanum-repo-config.md` are updated to document the `type: "instructions"` manifest shape, the two-file (`<id>.md`/`<id>.instructions.md`) split, the `AI_INSTRUCTIONS=<version>/<id>` hand-off signal, the ledger file and its `_ledger.sh` helper, and `arcanum-migrate`'s new autonomous-hand-off and instructions-`[C]hat` branches.

## Benefits

- Lets migrations hand off work that genuinely needs judgment, discussion, or user interaction, instead of forcing every migration to be scriptable.
- Reuses the existing exit-`3` hand-off contract rather than inventing a second control-flow mechanism, keeping `update_per_file.sh`/`update_per_version.sh` the sole owners of halt/skip/version-advance bookkeeping.
- Per-entry ledger tracking means resuming after an instructions hand-off (or a crash mid-version) never re-triggers the AI for already-completed entries, and never wastefully re-runs completed `script` entries either.
- `[C]hat` on an instructions entry gives the user a real say in *how* an entry gets satisfied — discuss it, swap in an alternative approach, or run the original — not just whether it runs.
- `generate_next.sh --type instructions` keeps authoring new instructions entries as fast as authoring `script` ones today.
- Keeps `docs/guides/arcanum-repo-version.md`/`arcanum-repo-config.md` accurate for anyone authoring or debugging migrations going forward.

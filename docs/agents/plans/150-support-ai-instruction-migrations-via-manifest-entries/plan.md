# Plan: Support AI-instruction migrations via manifest entries

Issue: [150-support-ai-instruction-migrations-via-manifest-entries.md](../issues/150-support-ai-instruction-migrations-via-manifest-entries.md)

## Overview

Add a `type: "instructions"` manifest entry, alongside the existing `type: "script"`, to `arcanum/migrations/`'s `migrations.json` schema (shipped by #149). Hitting one unconditionally hands control from the deterministic script chain to the AI, via the existing exit-`3` hand-off mechanism generalized with a new `AI_INSTRUCTIONS=<version>/<id>` signal (parallel to today's `CHAT_CONTEXT=<version>[/<file>]`). `arcanum-migrate/SKILL.md` catches it, performs the entry's `<id>.instructions.md` work (or a chat-negotiated alternative) autonomously, records completion in a new lock-protected ledger, then resumes the chain — the ledger exists specifically because hand-off becomes the *normal* path once instructions entries exist, so resuming can't just replay a version from the top the way today's rare `[C]hat` detour does.

## Context

`arcanum/migrations/` (see `docs/agents/architecture.md`'s "Per-Repo Migrations" section) already implements, as of #149: a `migrations.json` manifest per version folder (`id`/`type`/`file`/`skippable`/`applies_to`, `type` only ever `"script"` today), dual-pointer `repo`/`local` scope tracking, and a runner chain `run.sh` → `select_version.sh` → `update_per_version.sh` → `update_per_file.sh` that already has a `[C]hat`/`CHAT_CONTEXT`/exit-`3` escape hatch, today only reached when a user explicitly types `[C]hat`. This issue builds `type: "instructions"` on that same schema, without touching the `script` type's existing behavior.

Key files already in place: `arcanum/migrations/_manifest.sh` (manifest read + legacy-glob fallback), `update_per_file.sh` (runs/prompts for one entry), `update_per_version.sh` (walks one version's manifest, advances pointers once the whole manifest completes), `run.sh` (top-level entry point), `arcanum-migrate/SKILL.md` (drives `run.sh`, catches `CHAT_CONTEXT`).

## Implementation Steps

### Step 1 — Ledger helper library + CLI

Add `arcanum/migrations/_ledger.sh` (sourced, mirroring `_manifest.sh`'s doc-comment style and the lock-protected append pattern `update_per_file.sh` already uses for `.claude/state/arcanum-errors.json`):
- `_ledger_is_complete <repo_path> <version> <id>` — exit 0/1, no lock needed (read-only).
- `_ledger_mark_complete <repo_path> <version> <id>` — lock-protected append/dedupe (skip if already present) into `.claude/state/arcanum-migrations-ledger.json`, created on first write. Schema: flat array, `[{"version": "<semver>", "id": "<NNN>"}]` — no `skippable`/`message` fields like the errors file, since a ledger entry only ever means "done."

Unlike `.claude/state/arcanum-errors.json`, the ledger is **never reset** — it accumulates permanently. Once a version's pointer advances past it (all its entries satisfied), its ledger rows become dead weight but harmless: `update_per_version.sh`'s existing pointer-based satisfied-check (see Step 4) short-circuits before ever consulting the ledger for an already-pointer-satisfied version.

Also add `arcanum/migrations/ledger.sh` — a thin **executable** CLI wrapper around `_ledger.sh` (`is-complete <repo_path> <version> <id>` / `mark-complete <repo_path> <version> <id>` subcommands), since `arcanum-migrate/SKILL.md` (Step 6) runs as the architect and can only invoke real executables via Bash, not source a library directly.

### Step 2 — Extend `_manifest.sh` for `type: "instructions"`

Update the `migrations.json` schema doc comment and `_manifest_entries`/`_manifest_has_scope` to carry the new type's fields. Today's TSV shape is `<id>\t<type>\t<file>\t<skippable>\t<applies_to>`; extend to 6 columns, `<id>\t<type>\t<primary_file>\t<instructions_file>\t<skippable>\t<applies_to>`, where `primary_file` is `.file` for `type: "script"` and `.description_file` for `type: "instructions"`, and `instructions_file` is `.instructions_file` for `type: "instructions"` (empty string for `type: "script"` and for legacy glob-discovered entries). Update the legacy-glob fallback branch in `_manifest_entries` to emit the same 6-column shape (empty `instructions_file`). `_manifest_has_scope`'s read loop gains the extra column but its logic (checking `applies_to`) is otherwise unchanged.

### Step 3 — `update_per_file.sh`: branch on entry type

Add `--type script|instructions` (default `script`, for backward compatibility with direct/legacy calls) and `--instructions-file <path>`/`--id <id>` (required when `--type instructions`).

- `type: "script"` — entirely unchanged from today's behavior.
- `type: "instructions"` — `<file_path>` is the entry's description `.md` (printed at the confirm prompt, same UX as today's paired `.sh`/`.md`, just given directly instead of derived from a `.sh` path since there is no script file). Never shells out to `<file> config`/`<file> run` — there's nothing to execute. On `[R]un` (or `--no-confirm`): print `AI_INSTRUCTIONS=<version>/<id>` and exit `3` immediately — no attempt to run anything, since a bash script cannot perform the work itself. On `[S]kip`: exit `0`, same as today (no ledger write; relies on the same "skip doesn't block version-advance" semantics `script` entries already have). On `[C]hat`: print `CHAT_CONTEXT=<version>/<id>` (using `<id>`, not a filename, since an instructions entry has two files) and exit `3`.

### Step 4 — `update_per_version.sh`: fold ledger into resume, dispatch per type

Source `_ledger.sh`. Extend the per-entry "satisfied" check (today only comparing `applies_to` against the committed/local pointer) with an additional OR condition: for `type: "instructions"` entries, also satisfied if `_ledger_is_complete "$REPO_PATH" "$VERSION" "$id"`. This is what makes resume-without-replay work: within a still-pending version (pointer hasn't advanced because the manifest hasn't fully completed), a second pass skips entries the ledger already marked done and continues from the first not-yet-completed one, instead of re-triggering the AI hand-off for an already-handled entry.

When building the to-run entry list, carry `instructions_file` alongside the existing per-entry arrays (`ENTRY_ID`, `ENTRY_TYPE`, etc.). When invoking `update_per_file.sh` per to-run entry: for `type: "script"`, call exactly as today; for `type: "instructions"`, pass `--type instructions --instructions-file "${VERSION_DIR}/${ENTRY_INSTRUCTIONS_FILE[$i]}" --id "${ENTRY_ID[$i]}"` with the description file as the positional `<file_path>`. The existing `rc == 3` propagation (already present for `[C]hat`) needs no change — it already stops the loop and re-propagates immediately, which is exactly right for the new unconditional `AI_INSTRUCTIONS` hand-off too. `_advance_pointers` and the rest of the halt/skip bookkeeping are untouched.

### Step 5 — `generate_next.sh` becomes a scaffolding tool

Add `--type script|instructions` (required). Both types share the existing single id sequence (highest existing `id` across all entries, any type, + 1 — unchanged computation). On top of printing/returning the id:
- `--type script` → append `{"id": "<id>", "type": "script", "file": "<id>.sh", "skippable": <default>, "applies_to": "<default>"}` to `migrations.json`, create `<id>.sh` (existing `config`/`run` skeleton shape) and `<id>.md` (empty description template).
- `--type instructions` → append `{"id": "<id>", "type": "instructions", "description_file": "<id>.md", "instructions_file": "<id>.instructions.md", "skippable": <default>, "applies_to": "<default>"}`, create `<id>.md` (empty description template) and `<id>.instructions.md` (empty AI-instructions template).

Decide a sensible default for `skippable`/`applies_to` in the scaffolded entry (e.g. `skippable: true`, `applies_to: "local"`) — left as a placeholder for the author to adjust, same spirit as today's script skeleton being a stub to fill in.

### Step 6 — `arcanum-migrate/SKILL.md`: new hand-off branches

Its existing "Step 2 — Chat detour, then resume" only ever parses `CHAT_CONTEXT` after exit `3`. Split into two branches based on which variable is present in the relayed stdout:

- **`AI_INSTRUCTIONS=<version>/<id>`** (new) — autonomous hand-off, no user confirmation beyond the `[R]un`/`--no-confirm` choice that already triggered it: read `arcanum/migrations/repos/<version>/<id>.instructions.md`, perform the work, call `arcanum/migrations/ledger.sh mark-complete "$REPO_PATH" <version> <id>`, then resume via `run.sh apply --select <version> --repo "$REPO_PATH"` — no further prompting.
- **`CHAT_CONTEXT=<version>/<id>` for an instructions entry** (distinguished from a bare `CHAT_CONTEXT=<version>` or a `script` entry's `CHAT_CONTEXT=<version>/<file>`, both unchanged) — hold a plain chat dialogue with three possible outcomes: (a) the user is satisfied just discussing it — nothing runs, resume without marking the ledger, entry stays pending; (b) the user proposes an alternative — perform that alternative, then `ledger.sh mark-complete`, then resume; (c) the user wants both the alternative and the original instructions — perform both, in the order asked, then `ledger.sh mark-complete`, then resume. Resume in (b)/(c) the same way as the `AI_INSTRUCTIONS` branch (`run.sh apply --select <version> --repo "$REPO_PATH"`).

### Step 7 — Documentation

- `docs/agents/architecture.md`'s "Per-Repo Migrations" section: document `type: "instructions"`, the two-file (`<id>.md`/`<id>.instructions.md`) split, the generalized `AI_INSTRUCTIONS=<version>/<id>` signal alongside the existing `CHAT_CONTEXT`, and the ledger file + `ledger.sh` CLI (placement rationale: same class as `arcanum-errors.json`, not routed through `repo_config.sh`).
- `docs/guides/arcanum-repo-version.md`: extend to mention the ledger's role in per-entry resume for `instructions` entries, distinct from (and additional to) the two version pointers already documented there.
- `docs/guides/arcanum-repo-config.md`: check whether it needs a note pointing at the ledger's *different* placement pattern (it deliberately isn't part of the config-file pair this guide documents) — likely a one-line cross-reference at most, possibly no change if the existing "per-repo migrations use this pair of files" section already scopes itself to the two version pointers only.

## Files to Change

- `arcanum/migrations/_ledger.sh` — new: sourced ledger read/write helpers, lock-protected.
- `arcanum/migrations/ledger.sh` — new: executable CLI wrapper (`is-complete`/`mark-complete`) for the skill layer.
- `arcanum/migrations/_manifest.sh` — extend `_manifest_entries`/`_manifest_has_scope` + schema doc comment for `type: "instructions"`.
- `arcanum/migrations/update_per_file.sh` — `--type`/`--instructions-file`/`--id` args; instructions-type branch (no `config`/`run` shelling out; unconditional `AI_INSTRUCTIONS=<version>/<id>` hand-off on `[R]un`/`--no-confirm`; `CHAT_CONTEXT=<version>/<id>` on `[C]hat`).
- `arcanum/migrations/update_per_version.sh` — source `_ledger.sh`; ledger-aware satisfied-check for `instructions` entries; per-type dispatch to `update_per_file.sh`.
- `arcanum/migrations/generate_next.sh` — `--type script|instructions` scaffolding (manifest append + skeleton files), replacing pure "print next id."
- `arcanum-migrate/SKILL.md` — new `AI_INSTRUCTIONS` branch (autonomous perform-then-resume) and instructions-specific `[C]hat` branch (discuss / alternative / both), both marking the ledger via `ledger.sh mark-complete` before resuming when the entry's intent was satisfied.
- `docs/agents/architecture.md` — "Per-Repo Migrations" section updates described in Step 7.
- `docs/guides/arcanum-repo-version.md` — ledger/resume documentation described in Step 7.
- `docs/guides/arcanum-repo-config.md` — possible one-line cross-reference, per Step 7.

## Notes

- No automated test suite covers `arcanum/migrations/` (bash-only project, no CI job runs these scripts — `.circleci/config.yml` only builds/releases on tag push). Verification is manual: exercise `run.sh --repo <tmp-repo>` end to end against a scratch `migrations.json` containing a `type: "instructions"` entry, covering `[R]un`, `[S]kip`, `[C]hat` (all three chat outcomes), `--no-confirm`, and a simulated interrupted-then-resumed run (killing the process after one instructions entry's hand-off, then resuming) to confirm the ledger actually prevents replay.
- `scripts/bump-version.sh` (rolls `repos/next/` into a new version folder on release) needs no change — it already moves `migrations.json` and its sibling files generically, with no per-file-kind logic to extend for `.instructions.md`.
- `init-claude/scripts/stamp_arcanum_version.sh` needs no change — the ledger deliberately has no backfill/bootstrap requirement (see the issue's "No backfill/bootstrap entry is needed for the ledger" rationale).
- Open question worth a quick sanity check during implementation: whether `run.sh apply --select <version>` (used to resume after both hand-off branches) needs any change at all to support resuming mid-manifest — based on the current code, it shouldn't (it just re-invokes `update_per_version.sh` for that version, which now re-derives the correct to-run list via the ledger-aware satisfied-check from Step 4), but worth confirming empirically during the manual verification pass above.

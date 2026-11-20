# Issue: Per-repo migration: add docs/agents/specs.md to existing repos

## Description

Add a per-repo migration under `arcanum/migrations/repos/next/` so repositories that installed
arcanum before the `/init-claude` specs scaffold catch up: they get `docs/agents/specs.md` and
`docs/agents/specs/.gitkeep`.

Part of Epic #931. Builds on #932 (merged), which added the canonical templates this migration
copies from: `init-claude/templates/specs.md` and
`init-claude/templates/agents-documentation-section.md`.

### Context

The migration must produce exactly what `/init-claude` produces, so it copies from the same
`init-claude/templates/specs.md` (resolved relative to its own script directory, as
`arcanum/migrations/repos/0.14.0/001.sh` does for the commit-message template) instead of embedding
its own copy.

## Problem

Repositories that installed arcanum before #932 have no `docs/agents/specs.md`, no `docs/agents/specs/` directory, and no pointer to the specs index in their `AGENTS.md`. `/init-claude` is never re-run destructively on an existing repository, so nothing brings them up to the state newly initialized repositories get.

## Expected Behavior

### Acceptance criteria

- A repo without `docs/agents/specs.md` ends up with one byte-identical to
  `init-claude/templates/specs.md`, plus `docs/agents/specs/.gitkeep` when the directory was
  missing or empty.
- A repo with an existing `docs/agents/specs.md` keeps it unchanged.
- Re-running the migration changes nothing.
- After the `instructions` entry, the repo's `AGENTS.md` Documentation section links the specs
  index, with no duplicate row or subsection.

### Edge cases

#### `script` entry

The `specs.md` and `specs/.gitkeep` checks are independent and mirror
`init-claude/scripts/setup_docs_structure_shell.sh`:

- `docs/agents/` does not exist → still create `docs/agents/specs.md` (arcanum skills assume
  `docs/agents/` exists anyway).
- `docs/agents/specs.md` exists (any kind of path — file, directory or symlink, checked with `-e`)
  → left untouched with an "Already present, left untouched" line; `specs/.gitkeep` is still
  handled on its own.
- `docs/agents/specs.md` exists but `docs/agents/specs/` is missing → `specs.md` untouched,
  `specs/.gitkeep` created.
- `docs/agents/specs` exists as a file → skip `.gitkeep` with a warning on stderr, never
  overwrite; the script still exits `0` (the rest of the entry succeeded, matching
  `/init-claude`), so the entry is recorded as done.
- `docs/agents/specs/` already contains files → no `.gitkeep`, no invented index rows. Hidden
  entries (e.g. `.DS_Store`) count as content (`ls -A`).

#### `instructions` entry

- Only one of the two pieces (the `Specs` row or the `### Specs` subsection) is present → add only
  the missing one.
- The Documentation section is shaped differently from the template (a bullet list instead of a
  table, or prose already linking `docs/agents/specs.md`) → follow the existing format rather than
  forcing a table row in; an existing link to `docs/agents/specs.md` counts as the row being
  present.
- `AGENTS.md` exists but has no `## Documentation` section → the `instructions` entry asks the
  user where (or whether) to add the specs index rather than guessing, mirroring
  `arcanum/migrations/repos/0.13.0/002.instructions.md`'s "restructured beyond recognition" rule.

#### Both

- Running on a repo already fully up to date (e.g. arcanum itself) → both entries are no-ops.

## Solution

### Migration entries

Two entries in `arcanum/migrations/repos/next/migrations.json` (scaffolded with
`arcanum/migrations/generate_next.sh`), both `applies_to: "repo"` (they change committed files) and
`skippable: true`:

| Entry | Type | Does |
|---|---|---|
| `NNN` | `script` | Copies `init-claude/templates/specs.md` → `docs/agents/specs.md` when missing; creates `docs/agents/specs/.gitkeep` when the directory is missing or empty. An existing `specs.md` (populated or incomplete) is left untouched with an "Already present, left untouched" line. Idempotent. |
| `NNN+1` | `instructions` | Adds the specs index to the target repo's `AGENTS.md` `## Documentation` section: the `Specs` table row and the `### Specs (docs/agents/specs/)` subsection, using the canonical text from `init-claude/templates/agents-documentation-section.md`. Skips whatever is already present; does nothing when `AGENTS.md` is missing. |

The `AGENTS.md` change is AI-driven (`instructions`) rather than a script because `AGENTS.md` is
user-edited prose: inserting a row mid-table and a subsection in the right place is fragile to do
mechanically, while the AI can place it sensibly or recognize it is already covered.

### What needs to be done

- [ ] Add the `script` entry (`NNN.sh` + `NNN.md`) as described above.
- [ ] Add the `instructions` entry (`NNN+1.md` + `NNN+1.instructions.md`) as described above.
- [ ] Specs for the `script` entry in a new `core/spec/bin/migrationsSpecsIndex_spec.js`
      (Jasmine, alongside the existing `core/spec/bin/migrations*_spec.js`), naming each
      migration file by its full `arcanum/migrations/repos/next/NNN...` literal per
      [Per-Repo Migrations](docs/agents/architecture/per-repo-migrations.md) conventions. Cover
      every acceptance criterion and `script`-entry edge case above (fresh repo, existing
      `specs.md`, `specs` as a file, non-empty and hidden-only `specs/`, re-run idempotency).

### Migration

- Ships under `arcanum/migrations/repos/next/`: #932's `/init-claude` change is not yet released
  (merged after the 2.4.0 bump), so this migration rolls into the same version as the change it
  belongs to.
- Ids stay `NNN` / `NNN+1` here; the real ids come from `arcanum/migrations/generate_next.sh` at
  implementation time (currently `001` / `002`, since `next/migrations.json` is `[]`, unless
  another migration lands first).
- Specs follow the [Per-Repo Migrations](docs/agents/architecture/per-repo-migrations.md)
  reference conventions: each migration file is named by its full
  `arcanum/migrations/repos/next/NNN...` literal, and `migrations.json` is derived from the
  script's path, never written as a `repos/next/migrations.json` literal. No doc references the
  new entries.

### Backward compatibility

Both entries are additive, idempotent and skippable; nothing existing changes.

- **`/init-claude` re-run on an older repo:** its Step 16 re-stamps the version pointers, so both
  entries are treated as satisfied without running. For `specs.md` / `specs/.gitkeep` there is no
  gap (the re-run creates them itself, #932). For the `AGENTS.md` specs index, `/init-claude` only
  warns naming what to add — accepted as-is; closing it would mean changing the runner's
  satisfied-check or Step 16, out of scope here.
- **`applies_to: "repo"` for both entries:** they change committed files and the repo pointer is
  committed, so once one contributor runs and commits the migration, other clones see it as
  satisfied — no duplicate work.
- **Repos that never adopted `docs/agents/`:** the script still creates `docs/agents/specs.md`;
  such repos opt out by skipping the entry (`[S]kip`), since it is `skippable: true`.

### Alternatives considered

- **Script-driven `AGENTS.md` edit** — rejected: `AGENTS.md` is user-edited prose; inserting a
  table row and a subsection mechanically is fragile (see the `instructions` entry rationale above).
- **Reusing `init-claude/scripts/setup_docs_structure_shell.sh` from the `script` entry** —
  rejected: it also scaffolds the rest of `docs/agents/` and emits `AGENTS.md` warnings, beyond
  this migration's purpose.
- **A single `instructions` entry that also writes `specs.md`** — rejected: the byte-identical
  guarantee needs a deterministic `cp` from the template; an AI-written file could drift.
- **Embedding `specs.md` content in the migration** (inline heredoc or a frozen copy next to
  `NNN.sh`) — rejected: breaks Epic #931's single canonical source. Consequence accepted: the
  migration reads `init-claude/templates/specs.md` live, so a repo migrating later gets the
  template as it is at that time rather than a snapshot — intended, since the template is the
  current authority (same as `arcanum/migrations/repos/0.14.0/001.sh`).

### Scope boundaries

- The `script` entry is a standalone script touching only `docs/agents/specs.md` and
  `docs/agents/specs/`. It does **not** call `init-claude/scripts/setup_docs_structure_shell.sh`,
  which would also scaffold the rest of `docs/agents/` and emit `AGENTS.md` warnings beyond this
  migration's purpose.

### Out of scope

- Repairing an existing but incomplete `specs.md`.
- Generating index rows for pre-existing spec files.
- Changing `/init-claude` (#932).
- A native (Node.js) counterpart: per-repo migrations are shell-only; nothing in `core/lib` runs
  `arcanum/migrations/repos`.
- Specs for the `instructions` entry (AI-driven; nothing deterministic to test).
- Documentation updates: no architecture doc changes, and no doc references the new
  `next/NNN` files.

## Benefits

- Existing and newly initialized repositories converge on the same byte-identical `specs.md`, from a single canonical template.
- Agents in migrated repositories discover the specs index through `AGENTS.md`.

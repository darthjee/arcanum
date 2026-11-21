# Scripter Plan: Split specs awareness: Specs concern in the split checklist and a per-repo migration to add it

Main plan: [plan.md](plan.md)

## Shared contracts

- Append the Specs bullet from [plan.md](plan.md#shared-contracts) verbatim as the last bullet of the shell seed.
- Produce the `003` manifest entry exactly as specified, and quote the bullet in `003.instructions.md` inside a fenced `markdown` block, as the only line starting with `- **Specs** —`. The node drift-guard spec relies on this.

## Implementation Steps

### Step 1 — Add the Specs bullet to the shell seed

In `init-claude/scripts/setup_docs_structure_shell.sh`, append the Specs bullet to the `docs/agents/arcanum-split-issue.md` `_create_file` content, after `**Responsible agents**`. Escape the backticks (`\``) as the surrounding content does. The output must stay byte-identical to the native engine once node applies the same change; the parity spec checks this.

### Step 2 — Add the `next/003` instructions migration

Run `arcanum/migrations/generate_next.sh --type instructions` (it must print `003`), then:

- In `arcanum/migrations/repos/next/migrations.json`, set `003`'s `applies_to` to `"repo"`.
- Write `arcanum/migrations/repos/next/003.md`, modelled on `002.md`, with the title "Migration 003 (next) — add the Specs concern to the split checklist". Say that it appends the Specs concern to `docs/agents/arcanum-split-issue.md` when no similar concern is present, never rewords existing items, does nothing when the file is absent, and is safe to skip or re-run.
- Write `arcanum/migrations/repos/next/003.instructions.md`, modelled on `002.instructions.md`, with these numbered steps:
  1. If `docs/agents/arcanum-split-issue.md` does not exist, make no change and mark complete.
  2. Read the file. If it already has a concern about specs, or about designs agreed before splitting (any wording), make no change.
  3. If it has no recognisable concern list, ask the user where, or whether, to add the concern rather than guessing.
  4. Otherwise, append the bullet (quoted in a fenced `markdown` block) as the last item of the concern list. If the existing bullets use a different shape, express the same concern in that shape.
  5. Never reword, reorder or remove existing items.

## Files to Change

- `init-claude/scripts/setup_docs_structure_shell.sh`: new seed bullet.
- `arcanum/migrations/repos/next/migrations.json`: new `003` entry.
- `arcanum/migrations/repos/next/003.md`: new migration description.
- `arcanum/migrations/repos/next/003.instructions.md`: new AI instructions.

## CI Checks

- Repo root: markdown lint on the new `.md` files (`.markdownlint.json`).
- `core`: `make core-test` (CI job runs `yarn test` in `core/`), which runs the parity spec covering the shell seed.

## Notes

- Use the real id printed by `generate_next.sh`. If it is not `003`, tell node and skill-writer, because the specs and docs name the file by literal path.

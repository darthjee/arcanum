# Scripter Plan: Create-issue: skill files

Main plan: [plan.md](plan.md)

## Shared contracts

New `shipit` sentence: "`shipit` is never applied without an explicit human choice". Do **not** change `arcanum/_lib/tag_mutate.sh`, the native `IssueTagger.js`/`TagMutationService.js` guards, or their error-message strings (`Error: shipit is human-only; scripts must not add or remove it`) — they keep refusing `shipit`.

## Implementation Steps

### Step 1 — Reword the shipit sentence in the tag-table generator

In `scripts/generate_tags_table.sh` (around line 386), replace "`shipit` is out of scope — it is human-only and never mutated by any script." with wording built on the new rule, e.g. "`shipit` is out of scope — it is never applied without an explicit human choice, and no tag-mutation script ever adds or removes it (`/arcanum-create-issue` sets it only at creation, after an explicit confirmation)." Keep the rest of the paragraph unchanged.

### Step 2 — Regenerate the table

Run `scripts/generate_tags_table.sh` to regenerate `docs/agents/tag-mutations.md` (never edit it by hand). Then run `scripts/check_tags_table.sh` and `scripts/test_generate_tags_table.sh` (if present) to confirm the table is up to date and the generator tests pass. If a regenerated row changes for reasons unrelated to this sentence, keep it (the table must match the generator) but mention it in the commit message.

## Files to Change

- `scripts/generate_tags_table.sh` — reworded `shipit` sentence
- `docs/agents/tag-mutations.md` — regenerated output only

## CI Checks

- `scripts/check_tags_table.sh` (CI step "Check docs/agents/tag-mutations.md is up to date")
- `shellcheck scripts/generate_tags_table.sh`

## Notes

- `tag-mutations.md` lives under `docs/agents/` (architect's scope) but is generated; committing the regenerated output is part of this step.

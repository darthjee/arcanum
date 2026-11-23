# Migration

Hub: [specs.md](specs.md)

## Approach

**Rationale:**

- Consumer repositories carry their own split-question template, and merging text into it is fragile.
- So the question and its branching live in the versioned skill, and the repository template only overrides it or opts out.
- An unmigrated repository still gets the question, because the skill asks by default and the config key's default lives in the config registry. No repository file has to be written for the flow to work.

## No migration for the flow itself

The pending specs migrations in `arcanum/migrations/repos/next/` are reshaped instead:

- **`next/003.instructions.md` is amended in place.** It is unreleased. Its Specs bullet, and the matching `/init-claude` seed (`init-claude/setup_arcanum_split_issue.md`), describe the repository checklist as an override or opt-out of the skill's built-in three-flow question.
- **`next/001.sh`** copies `init-claude/templates/specs.md` byte for byte, so the amended specs contract reaches new consumers through it.
- **Repositories that already have `docs/agents/specs.md`.** `next/001` leaves those untouched, so they get one idempotent instructions migration under `next/`, created with `arcanum/migrations/generate_next.sh --type instructions`. It appends the lifecycle sections without rewriting the rest, and it is a no-op when the file came from `next/001`.

Also:

- No config key is written into `.claude/configuration/arcanum-repo-config.json`.
- There is no backfill: an issue without a pointer stays without one.

## Release

A minor bump (2.5.0), with no breaking change, because Flow C stays the default and keeps today's behaviour.

## Timing constraint

- The contract-template change and the checklist-seed change must land before the 2.5.0 bump.
- If either slips, `next/001` and `next/003` will already have shipped with the old text. Each must then be replaced by a follow-up migration in the next version, not edited.

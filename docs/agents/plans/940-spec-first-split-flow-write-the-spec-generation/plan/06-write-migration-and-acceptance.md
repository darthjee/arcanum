# Write migration.md and acceptance.md

Use the same part conventions as step 03. Both parts are `drop` in the fold map, but they are still written as normative prose.

## `migration.md` (migration plan, 2.5.0 timing)

- **Rationale:**
  - Consumer repos carry their own split-question template, and merging text into it is fragile.
  - So the question and its branching live in the versioned skill, and the repo template only overrides it or opts out.
  - An unmigrated repo still gets the question, because the skill asks by default and the config key's default lives in the config registry.
- **No migration for the flow itself.** The pending specs migrations in `arcanum/migrations/repos/next/` (#932/#933/#935) are reshaped instead:
  - **`next/003.instructions.md`, amended in place.** It is unreleased. Its Specs bullet, and the `/init-claude` seed (`init-claude/setup_arcanum_split_issue.md`), describe the repo checklist as an override or opt-out of the skill's built-in three-flow question.
  - **`next/001.sh`.** It copies `init-claude/templates/specs.md` byte for byte, so the amended contract reaches new consumers through it.
  - **Repos that already have `docs/agents/specs.md`.** `next/001` leaves those untouched, so they get one idempotent instructions migration under `next/`, created with `arcanum/migrations/generate_next.sh --type instructions`. It appends the lifecycle sections without rewriting the rest, and it is a no-op when the file came from `next/001`.
- **No config key** is written into `.claude/configuration/arcanum-repo-config.json`.
- **No backfill:** an issue without a pointer stays without one.
- **Release:** a minor bump (2.5.0), with no breaking change, because Flow C stays the default.
- **Timing constraint:**
  - The contract-template change and the checklist-seed change must land before the 2.5.0 bump.
  - If either slips, `next/001`/`next/003` will already have shipped with the old text. Each must then be replaced by a follow-up migration in the next version, not edited.
  - Write this in terms of *what* must land (the template and the checklist seed), not #938's implementation item numbers, which are build history.

## `acceptance.md` (epic acceptance criteria and risks)

- **Acceptance criteria:** #938's epic-level criteria as a bullet list:
  - Flow C output is unchanged.
  - Flow A produces the four ordered issue types, all carrying the same hub pointer.
  - A valid pointer makes `plan-issue` read the hub first.
  - The "generation has not run" verdict blocks automation with an explicit reason.
  - A deleted spec yields the deletion commit and the restore option.
  - A dropped pointer is re-inserted, and a changed pointer fails without the override.
  - A completed fold leaves no spec files, an updated index, provenance, and closed issues untouched.
  - An unmigrated repo still gets the question.
- **Risks**, each with its mitigation. Name the mitigating mechanism (guard, ordering, precedence rule, idempotent fold, skill-owned flow logic), not implementation item numbers:
  - silent pointer loss
  - ordering gaps (the highest risk)
  - spec/implementation drift in Flow B
  - fold content loss
  - migration churn

## Files to Change
- `docs/agents/specs/spec-first-split-flow/migration.md` (new): migration plan and timing constraint.
- `docs/agents/specs/spec-first-split-flow/acceptance.md` (new): acceptance criteria and risks.

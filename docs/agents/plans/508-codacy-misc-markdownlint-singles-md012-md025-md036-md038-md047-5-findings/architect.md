# architect Plan: Codacy: misc markdownlint singles — MD012/MD025/MD036/MD038/MD047 (5 findings)

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces the new filename `init-claude/setup_specialist_dispatch_permissions.md` (created by `skill-writer`, see [plan.md](plan.md)) referenced in `docs/agents/architecture/dispatch-permissions.md` — this file's own step 4 must use that exact name.
- `init-claude/setup_permissions.md`'s existing references elsewhere (`docs/agents/architecture/issue-tags.md`) stay unchanged — verified during exploration that paragraph is scoped to the `shipit`-merge procedure only, not the one being split out.

## Steps

- [01 — Fix MD012 in README.md](architect/01-fix-md012-readme.md)
- [02 — Fix MD038 in script-engine.md](architect/02-fix-md038-script-engine.md)
- [03 — Fix MD047 in ISSUE_TEMPLATE.md](architect/03-fix-md047-issue-template.md)
- [04 — Update dispatch-permissions.md references to the split filename](architect/04-update-dispatch-permissions-refs.md)

## Notes

- These 4 fixes have no dependency on each other; step 04 depends only on `skill-writer` having settled on the new filename (already fixed by this plan's shared contract, not by `skill-writer`'s actual commit landing first).

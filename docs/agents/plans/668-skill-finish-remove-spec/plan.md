# Plan: Skill finish: remove spec

Issue: [668-skill-finish-remove-spec.md](../../issues/668-skill-finish-remove-spec.md)

## Overview

Retire `docs/agents/specs/skill-finish.md` now that #660–#667 have implemented the standard skill finish. The lasting rules move into a new architecture topic, `docs/agents/architecture/skill-finish.md`, linked from `docs/agents/architecture.md`. Every live reference to the spec is retargeted to the new topic. So are the references to the deleted `docs/agents/plans/660-skill-finish-discuss-issue/plan.md`, which already point to nothing. The change touches documentation and comments only, with no behavior change.

## Agents involved

- [architect](architect.md)
- [skill-writer](skill-writer.md)
- [scripter](scripter.md)
- [node](node.md)

## Shared contracts

- **New doc path:** `docs/agents/architecture/skill-finish.md`, title `# Skill Finish`.
- **Required section heading:** `## Nested runs` (anchor `#nested-runs`), which `auto-fix-all/steps/process_one_issue.md` links to. The architect must keep this exact heading.
- **Retarget rule for code/script comments:** replace every `docs/agents/specs/skill-finish.md` mention with `docs/agents/architecture/skill-finish.md`. Drop every `docs/agents/plans/660-skill-finish-discuss-issue/plan.md` mention (the file no longer exists), or replace it with the architecture doc when the comment points there for the "shared contracts" or "design". Keep the other references (`script-engine.md` etc.) unchanged.
- **Done check (all agents):** `grep -rn 'specs/skill-finish\|plans/660-skill-finish' . --exclude-dir=.git` prints nothing outside `docs/agents/issues/` and `docs/agents/plans/`.

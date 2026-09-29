# Issue: Skill finish: remove spec

## Description
Parent: #658

All `Skill finish: <skill>` sub-issues of #658 (#660–#667) are now closed, so the standard skill finish (closing report + next-step offer/`Next:` line + nested-run handling) is implemented. `docs/agents/specs/skill-finish.md` is a forward-looking spec and must now be retired, with its lasting rules moved into `docs/agents/architecture/`.

## Problem
- `docs/agents/specs/` is for designs not yet implemented, but `skill-finish.md` now describes shipped behavior — and its "Status: Proposed. Nothing in this spec is implemented yet" is false.
- Live files still point at the spec:
  - `auto-fix-all/steps/process_one_issue.md` (3 links, to the "Nested runs" section)
  - `arcanum/_lib/finish_report.sh`, `arcanum/_lib/finish_report_shell.sh`, `arcanum/_lib/next_step_prompt.sh` (header comments)
  - `core/lib/commands/shared/FinishReport.js`, `core/spec/bin/finishReportParity_spec.js` (comments)
  - `docs/agents/folder-structure.md` (uses `skill-finish.md` as an example of a spec)

## Expected Behavior
- A new `docs/agents/architecture/skill-finish.md` ("Skill Finish") documents the implemented behavior, verified against the actual scripts and skill steps (not copied blindly from the spec), covering:
  - which skills are in scope (interactive vs. auto) and which are out of scope;
  - the closing report format, line rules, and exit paths (success / declined / failed);
  - the `finish_report.sh` interface, output/exit codes, and its shim → engine dispatch (shell + native `finish-report`);
  - the `next_step_prompt.sh` `/dev/tty` `[Y]es/[N]o/[C]hat` protocol and skill-side rules;
  - the `Next:` line rule for auto skills;
  - nested runs: explicit `NESTED=true`, the `FINISH_*` result block, `--merge` rules, and the `auto-fix-all` exception;
  - the next-step map.
- Spec-only content (the "Status" section and the "Implementation order and ownership" section) is dropped.
- `docs/agents/architecture.md` gets a row linking the new topic.
- `docs/agents/specs/skill-finish.md` is deleted.
- Every reference listed above is retargeted to `docs/agents/architecture/skill-finish.md` (the `process_one_issue.md` links point at its nested-runs section); `folder-structure.md` drops `skill-finish.md` from its spec examples.

## Solution
- `architect`: write the architecture topic, add the `architecture.md` row, delete the spec, update `folder-structure.md`.
- `skill-writer`: retarget the three links in `auto-fix-all/steps/process_one_issue.md`.
- `scripter`: retarget the header comments in the three `arcanum/_lib/` scripts.
- `node`: retarget the comments in `FinishReport.js` and `finishReportParity_spec.js`.
- No behavior changes — documentation and comments only.

### Acceptance criteria
- [ ] `docs/agents/specs/skill-finish.md` is gone and `grep -rn 'specs/skill-finish' .` finds nothing outside `docs/agents/issues/` and `docs/agents/plans/`
- [ ] `docs/agents/architecture/skill-finish.md` exists, matches the implemented scripts/skills, and is linked from `docs/agents/architecture.md`

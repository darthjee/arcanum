# skill-writer Plan: Migrate resolve-plan-paths entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- `resolve_plan_paths.sh`'s new signature (built by scripter): `resolve_plan_paths.sh <repo_path> <issues_folder> <plans_folder> <id>`. Every call site below must pass `$REPO_PATH` (or the skill's equivalent already-resolved variable) as the new leading arg, ahead of the existing `docs/agents/issues docs/agents/plans <id>` arguments.

## Implementation Steps

### Step 1 — Update call sites to pass $REPO_PATH

Update the example invocations/prose in these 4 files so each call to `resolve_plan_paths.sh` prepends `"$REPO_PATH"` as the new leading argument:

- `plan-issue/steps/file_definition.md` — `../auto-plan-issue/scripts/resolve_plan_paths.sh docs/agents/issues docs/agents/plans <id>` → add `"$REPO_PATH"` leading arg (this skill runs inline as architect, so `$REPO_PATH` is already resolved per its own `SKILL.md`)
- `auto-plan-issue/steps/run.md` — same call, same fix; this is also the file `auto-fix-all/steps/process_one_issue.md` references as "re-run it here" for `<issue_file>`/`<plan_dir>`, so its corrected form propagates by reference
- `auto-fix-issue/steps/run.md` — same call, same fix
- `auto-fix-all/steps/process_one_issue.md` — two occurrences, both referencing the `auto-plan-issue` call by description rather than a literal command; update the prose to mention the new leading `$REPO_PATH` arg

## Files to Change

- `plan-issue/steps/file_definition.md` — add `"$REPO_PATH"` leading arg to the example command
- `auto-plan-issue/steps/run.md` — add `"$REPO_PATH"` leading arg to the example command
- `auto-fix-issue/steps/run.md` — add `"$REPO_PATH"` leading arg to the example command
- `auto-fix-all/steps/process_one_issue.md` — update both prose references to the new leading arg

## Notes

- No script files change here — both per-skill wrapper scripts (`auto-plan-issue/scripts/resolve_plan_paths.sh`, `auto-fix-issue/scripts/resolve_plan_paths.sh`) already forward `"$@"` unchanged (see scripter.md's Notes).

# Architect Plan: Skill finish: remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- You produce `docs/agents/architecture/skill-finish.md` with a `## Nested runs` heading (anchor `#nested-runs`). The `skill-writer` links to that anchor, and the `scripter` and `node` comments point to the file.

## Implementation Steps

### Step 1 — Write the "Skill Finish" architecture topic

Create `docs/agents/architecture/skill-finish.md` as a standalone topic that describes **what is implemented**. Use `docs/agents/specs/skill-finish.md` as the source, but check each rule against the real code before carrying it over:

- `arcanum/_lib/finish_report.sh` (engine-dispatch shim) and `arcanum/_lib/finish_report_shell.sh` (their header comments are the most accurate contract);
- `core/lib/commands/shared/FinishReport.js` (native `finish-report`);
- `arcanum/_lib/next_step_prompt.sh`;
- the finishing steps of the in-scope skills (e.g. `discuss-issue/steps/discuss_and_save.md`, `plan-issue/steps/write_and_confirm.md`, `auto-fix-issue/steps/run.md`, `auto-rewrite-issue/steps/run.md`, `arcanum-split-issue/steps/push.md`, `enhance-issue/steps/publish.md`) and the nested caller `auto-fix-all/steps/process_one_issue.md`.

Keep these sections: scope (interactive vs. auto, out-of-scope skills), closing report format + line rules + exit paths, `finish_report.sh` interface + output/exit codes + engine note, next-step offer (`next_step_prompt.sh` prompt, output protocol, skill-side rules), auto skills (`Next:` lines), `## Nested runs` (explicit `NESTED=true`, `FINISH_*` block, `--merge` rules, `auto-fix-all` exception), next-step map, and "See also".

Drop the spec-only sections: "Status" and "Implementation order and ownership". Rewrite "will"/"is added" phrasing into present tense. Where the implementation adds details the spec lacked, document them. Examples:
- `ssh.github.com` maps to `github.com` for web URLs;
- a repeated single-value flag keeps its last value;
- unknown lines in a `--merge` block are ignored;
- the origin is read only when an Issue/PR URL is printed.

If the `arcanum-split-issue-finish` entrypoint (see `arcanum/_lib/migration-status.json` and `core/spec/bin/arcanumSplitIssueFinishParity_spec.js`) is part of how that skill finishes, mention it in the relevant row.

Fix the relative links for the new location. Siblings are now `script-engine.md`, `per-repo-migrations.md`, etc., in the same folder. `shell-engine-removal.md` becomes `../specs/shell-engine-removal.md`.

### Step 2 — Index, folder-structure, and spec deletion

- Add a "Skill Finish" row to the table in `docs/agents/architecture.md` (after "Dispatch Permissions" or in a fitting place). Suggested "Covers": the uniform closing report (`finish_report.sh`), the `/dev/tty` next-step offer for interactive skills, `Next:` lines for auto skills, and silent nested runs.
- In `docs/agents/folder-structure.md`, remove `skill-finish.md` from the `docs/agents/specs/` example list (keep `shell-engine-removal.md`).
- Delete `docs/agents/specs/skill-finish.md` (`git rm`).

## Files to Change

- `docs/agents/architecture/skill-finish.md`: new topic (Step 1).
- `docs/agents/architecture.md`: add the index row.
- `docs/agents/folder-structure.md`: drop the `skill-finish.md` example.
- `docs/agents/specs/skill-finish.md`: delete.

## Notes

- Don't just copy the spec: check it against the implementation. The implementation wins wherever the two differ.
- Links from `docs/agents/issues/` and `docs/agents/plans/` are historical and stay as they are.

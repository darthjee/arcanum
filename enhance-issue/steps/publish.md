# Publish Back to GitHub

Once the user is satisfied with the issue overall (the end of the [dialogue.md](dialogue.md) loop), push the current state of the local draft to the live GitHub issue and clean up — nothing from this skill is committed to the repo; only the live issue changes.

## 1. Update the issue and swap tags

```bash
../scripts/github.sh update "$REPO_PATH" <id> "<Title>" <issue_file_path>
../scripts/github.sh mark-created "$REPO_PATH" <id>
```

> Resolve `../scripts/github.sh` relative to this file's directory. `$REPO_PATH` (resolved once at the top of [SKILL.md](../SKILL.md)) is a required leading argument — the script resolves the GitHub domain and repository from it explicitly, rather than from ambient `git remote get-url origin`. `mark-created` adds the `Created` label and removes `Idea`/`Writting`, if present — best-effort, it never blocks this step.

## 2. Delete the local draft

Delete `FILE` (the local `docs/agents/issues/<id>-...md` draft) — unlike `discuss-issue`, this skill never commits its local file; it's transient working material only, and the live GitHub issue body is now the source of truth.

## 3. Confirm

Tell the user the issue has been updated on GitHub and is now tagged `Created`, ready to enter the `discuss-issue` → `plan-issue`/`auto-plan-issue` → `auto-fix-issue` pipeline.

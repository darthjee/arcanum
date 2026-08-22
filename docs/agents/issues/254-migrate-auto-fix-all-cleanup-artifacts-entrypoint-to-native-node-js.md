Sub-issue of #252 (batch overview). Part of the `auto-fix-all` family.

## Source script

`auto-fix-all/scripts/cleanup_artifacts.sh`

Removes planning artifacts (issue file + plan dir) once a PR is approved: `git rm`s the issue file and plan dir if tracked, commits if anything was staged (chore/docs, agent "architect"), no-ops silently otherwise.

## Migration

Follow `docs/agents/architecture/script-engine.md`:

1. Read `auto-fix-all/scripts/cleanup_artifacts.sh` for its exact output/exit-code contract.
2. Create `core/lib/AutoFixAllCleanupArtifacts.js` (zero runtime deps, built-in Node APIs only).
3. Register in `core/bin/arcanum`'s `COMMANDS` map: `'auto-fix-all-cleanup-artifacts': { module: 'AutoFixAllCleanupArtifacts.js', method: 'run' }`.
4. Add `"auto-fix-all-cleanup-artifacts": true` to `arcanum/_lib/migration-status.json`.
5. Write native unit tests in `core/spec/AutoFixAllCleanupArtifacts_spec.js`.
6. Write a parity test (shell vs. native, identical stdout/exit code).
7. Verify `arcanum/_lib/engine_dispatch.sh` routes correctly for `engine.mode=native` and `engine.mode=shell`.

## External dependencies

- `git rm` / `git commit` (no GitHub API calls).
- Sources `arcanum/_lib/push.sh` (not yet migrated), used only for its `push_current_branch` helper (`git push -u origin <branch>:<branch>`) — re-derive that logic natively rather than shelling out to the bash helper.
- The commit message itself is hardcoded inline in the script (`chore(docs): remove planning artifacts (issue #<id>)` plus two fixed `Co-Authored-By` trailers), not sourced from a shared template — unlike `auto-plan-issue/scripts/commit_plan.sh`, it does not use `arcanum/_lib/commit_template.sh` or `agent_email.sh`. Replicate the hardcoded format as-is.

## Dependencies on other sub-issues

None — no in-batch script calls this one or is called by it.

## Context

Part of the migration batch tracked in #232 (following #192, #193, #227, #233, #234, #235, #236). Migrates `arcanum/_lib/spawn_issue.sh` to native Node.js. This is the last sub-issue in the batch — it depends on #237 (migrating `github_issue.sh`'s `info`/`create` sub-commands) being merged first.

## Target script

`arcanum/_lib/spawn_issue.sh` — creates a brand-new GitHub issue on demand from a scratch body file, with a label set safely derived (allow-list) from a parent issue, tags it `Spawned`, and links it back to the parent (comment cross-reference, optionally a native GitHub sub-issue relationship).

**Usage:** `spawn_issue.sh <repo_path> <parent_id> <title> <body_file> [--as-subissue]`

**Operation order** (create → labels → linking → cleanup; everything after create is best-effort):
1. **Create** — calls `github_issue.sh create <repo_path> <title> <body_file>`, wrapped in a retry loop (max-retry-count/error-sleep-time read from `.claude/state/arcanum-config.json`'s `plan-issues` section, default 5 retries / 5s sleep). Exhausted retries → `STATUS=failed`, exit 1 (nothing to clean up — `create` only writes its scratch file on success).
2. **Labels** — fetches `<parent_id>`'s current labels, strips any that map to a canonical pipeline tag (`tags.sh`'s `_tag_for_label`), keeps the rest, always adds `Spawned`. Applied via `gh issue edit --add-label`. If the parent lookup fails, falls back to applying just `Spawned`.
3. **Linking** — always posts a comment on the parent (`Spawned issue #<new_id>: <title>`) and on the new issue (`Spawned from #<parent_id>`). With `--as-subissue`, additionally runs the `addSubIssue` GraphQL mutation, with a "created but not linked; link it manually on GitHub" warning fallback on failure.
4. **Cleanup** — removes the scratch file `create` wrote under `docs/agents/issues/`. Failure here prints a *loud* stderr warning but still exits 0 (the issue itself was created successfully).

**Output contract:**
- Success: `STATUS=ok`, `ID=<new_id>`, `URL=<url>`, exit 0.
- Failure (create exhausts retry budget): `STATUS=failed`, exit 1.

## Dependencies

- **Depends on #237**: this native implementation must call `core/bin/arcanum github-issue-create <repo_path> <title> <file>` (the routing key landed by #237/PR #248 — a single hyphenated command, not `github-issue create`) or `GithubIssue.js`'s `create` method directly, instead of shelling out to `github_issue.sh create`. Do not start this sub-issue until #237 is merged (currently open as PR #248).
- `gh` CLI for label edits and the GraphQL sub-issue mutation (no native replacement in scope here — shell out to `gh`, matching how other migrated entrypoints that still need `gh` behave, if any precedent exists by the time this lands)
- `arcanum-config.json` read for retry tuning — `RepoConfig.js` currently only reads `git.safe_branch`; extend it or add a sibling reader for the `plan-issues` section's `max-retry-count`/`error-sleep-time` keys
- Label-stripping equivalent to `tags.sh`'s `_tag_for_label` — `core/lib/Tags.js` only exposes the aggregate `extractTags` (label list → tag list); reuse it per-label (e.g. treat a label as a pipeline tag when `Tags.extractTags([label])` is non-empty) rather than re-deriving the label→tag table a third time

## Migration contract

Following the pattern from #227/PR #228:
- Native implementation at `core/lib/SpawnIssue.js`, routed via `core/bin/arcanum spawn-issue <repo_path> <parent_id> <title> <body_file> [--as-subissue]`
- Byte-identical output/exit-code to `spawn_issue.sh` (same `STATUS=`/`ID=`/`URL=` lines, same retry behavior, same best-effort posture for labels/linking/cleanup, same exit codes)
- Parity test at `core/spec/lib/SpawnIssue_spec.js` — runs shell vs native with identical inputs (GitHub API mocked/stubbed), asserts identical stdout + exit code
- Unit tests: retry exhaustion, parent label lookup failure fallback, `--as-subissue` GraphQL failure fallback, scratch-file cleanup failure (loud warning, still exit 0)
- Flip `spawn-issue` from `false` to `true` in `arcanum/_lib/migration-status.json`
- Regenerate `docs/agents/architecture/entrypoint-migration-status.md` via `scripts/generate_entrypoint_migration_status.sh`
- Zero runtime npm dependencies — only built-in Node APIs

## References

- Parent: #232
- Migration design: docs/agents/architecture/script-engine.md
- Previous migrations: #192, #193, #227, #233, #234, #235, #236
- Depends on: #237 (must be merged first — currently open as PR #248)

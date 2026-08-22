# Shell/native parity test

Add `core/spec/bin/spawnIssueParity_spec.js`, following `resolvePlanPathsParity_spec.js`/`resolveAndFetchParity_spec.js`'s established shape: run `arcanum/_lib/spawn_issue_shell.sh` (invoked directly, NOT through the `arcanum/_lib/spawn_issue.sh` engine_dispatch shim, to avoid circularity) against `core/bin/arcanum spawn-issue`, asserting byte-identical stdout and exit code.

Per those same specs' precedent, real `gh`/GitHub-API calls are out of scope for this parity test (repo-wide "no real network calls in specs" rule, and `gh` itself isn't stubbed for either side here) — scope this test to the offline-reachable, deterministic failure paths only:

- Missing/invalid `repo_path` (both scripts fail identically before touching the network).
- Missing `body_file` (`Error: file not found: <file>` — confirm whether this surfaces identically on stdout/exit code on both sides, or is shell-shim-only per the `Usage:`-guard precedent in `resolve_plan_paths.sh`'s plan; match whichever the actual `spawn_issue.sh`/`SpawnIssue.js` split lands on).
- Missing/invalid `--as-subissue`-adjacent argument parsing (extra/unrecognized 5th arg vs. the literal flag) — both sides' usage/error text and exit code.

The success path (`STATUS=ok`), the retry loop, label handling, and linking are already covered by `SpawnIssue_spec.js` (step 04, fully fake-injected) and by `spawn_issue.sh`'s own pre-existing shell behavior (unchanged) — do not attempt to reproduce them here against a live/mocked GitHub API.

## Files to Change
- `core/spec/bin/spawnIssueParity_spec.js` — new, scoped to the offline-reachable failure paths described above.

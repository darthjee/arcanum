# Parity test

Write `core/spec/bin/discussIssueRenderIssueParity_spec.js` — shell vs. native, per `docs/agents/architecture/script-engine.md`'s required parity test for every migrated entrypoint. Follow the single-file, `context: 'repo'` pattern used by `core/spec/bin/autoFixIssueCreateBranchParity_spec.js` (a fixture git repo, `execFile`-driven runs of both the shell script and `core/bin/arcanum`, asserting identical stdout and exit code) rather than the multi-file-per-scenario shape used by larger parity suites (e.g. `arcanumSplitIssueCreateSubIssueFileParity/`) — this entrypoint's surface is small enough for one file.

Run `discuss-issue/scripts/render_issue_shell.sh` directly (NOT through `discuss-issue/scripts/render_issue.sh`'s `engine_dispatch.sh` shim — that would make the test circular) against `core/bin/arcanum discuss-issue-render-issue`, using a fixture repo (for the native side's `repoPath`/template resolution) with the real `discuss-issue/templates/issue.tmpl.md` present at `<fixture>/discuss-issue/templates/issue.tmpl.md`.

Cover, asserting byte-identical stdout and exit code on both sides:
- All sections present.
- Every section omitted (title only).
- Missing `outputFile`/`title` (the usage-error path) — assert both sides exit non-zero with empty stdout (stderr text need not match).
- For the success cases, additionally assert the two written output files are byte-identical to each other (not just that stdout/exit code match) — this is the entrypoint's actual observable side effect, so parity on the file content matters as much as parity on stdout/exit code.

## Files to Change

- `core/spec/bin/discussIssueRenderIssueParity_spec.js` — new parity spec.

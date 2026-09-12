# Create the engine_dispatch shim

Replace `discuss-issue/scripts/render_issue.sh` with a thin `engine_dispatch.sh`-based shim, following `discuss-issue/scripts/confirm.sh`'s shape:

- Source `arcanum/_lib/engine_dispatch.sh`.
- Derive `REPO_PATH` from the ambient git checkout (`git rev-parse --show-toplevel`, falling back to `pwd`) — this entrypoint's callers pass an already-resolved absolute `output_file`, never a `repo_path`, so the shim must not require one on its own CLI surface. Keep the existing usage: `render_issue.sh <output_file> <title> [description] [problem] [expected_behavior] [solution] [benefits]` unchanged for every caller.
- Call `engine_dispatch "$REPO_PATH" discuss-issue-render-issue "${SCRIPT_DIR}/render_issue_shell.sh" -- "$@"` — the native path receives `$REPO_PATH` as its leading argument (per `context: 'repo'`) followed by the same `<output_file> <title> ...` arguments the shell path already receives via `"$@"`.
- No env vars need forwarding to the native path's allowlist — like `confirm.sh`, this entrypoint does no git/GitHub network I/O beyond reading the static template and writing the output file (both already covered by `repoPath`/positional args, not env vars).
- Preserve `render_issue.sh`'s missing-argument behavior: `render_issue_shell.sh` (shell mode) already guards this itself, and `DiscussIssueRenderIssue.js` (native mode) throws its own `Error` for the same case (per [plan.md](../plan.md)) — the shim itself needs no separate validation block, mirroring `confirm.sh`'s "no extra guard beyond what each implementation already does" convention.

Manually verify both routing paths after writing the shim (no automated test needed here beyond `node`'s parity spec, which exercises the native/shell implementations directly rather than through this shim):
- With `engine.mode=shell` (the default, migration-status flag not yet set) — confirm `render_issue.sh` still runs `render_issue_shell.sh` and produces the same output file as before this change.
- With `engine.mode=native` and the migration-status flag set (after step 3) — confirm `render_issue.sh` routes to `core/bin/arcanum discuss-issue-render-issue` and produces byte-identical output.

## Files to Change

- `discuss-issue/scripts/render_issue.sh` — replaced with the thin `engine_dispatch.sh` shim.

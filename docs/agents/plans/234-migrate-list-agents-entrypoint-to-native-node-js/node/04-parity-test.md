# Parity test: shell vs. native

Add `core/spec/bin/listAgentsParity_spec.js`, following `checkoutSafeBranchParity_spec.js`'s pattern exactly: run `arcanum/_lib/list_agents_shell.sh <repo_path> [agents_dir]` directly (never through the `list_agents.sh` `engine_dispatch` shim, to avoid circularity) and `core/bin/arcanum list-agents <repo_path> [agents_dir]` against identical fixture directories, asserting byte-identical stdout and exit code.

Fixture cases to cover, each run through both sides:
- A `.claude/agents/` directory with several real-shaped `*.md` files (reuse a minimal version of this repo's own `.claude/agents/*.md` shapes, per the issue's own suggestion, or a purpose-built temp-dir fixture — prefer a temp-dir fixture so the test doesn't depend on this repo's own agent roster staying stable).
- A missing `agents_dir`.
- An `agents_dir` with no `*.md` files.
- An invalid `repo_path` (missing directory, and a directory that isn't a git repo) — assert both stdout/exit-code and that both sides' stderr carry the same `RepoPath`/`repo_path_enter` error message, same as `checkoutSafeBranchParity_spec.js`'s missing/non-git cases.

Depends on Step 1 (`core/lib/ListAgents.js`) and Step 2 (router wiring) being in place; does not depend on `scripter`'s shim split (Step 1 of `scripter.md`) except for the `list_agents_shell.sh` filename it invokes directly — coordinate the exact filename with `scripter` before writing this test.

## Files to Change

- `core/spec/bin/listAgentsParity_spec.js` — new parity test file described above.

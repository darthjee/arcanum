# Plan: Migrate discuss-issue-render-issue entrypoint to native Node.js

Issue: [448-migrate-discuss-issue-render-issue-entrypoint-to-native-node-js.md](../issues/448-migrate-discuss-issue-render-issue-entrypoint-to-native-node-js.md)

## Overview

Migrate `discuss-issue/scripts/render_issue.sh` to a native Node.js command, `discuss-issue-render-issue`, per `docs/agents/architecture/script-engine.md`. The `node` agent builds the native command (`core/lib/commands/discuss-issue/DiscussIssueRenderIssue.js`), registers it, and covers it with unit + parity tests. The `scripter` agent extracts the current shell logic into `render_issue_shell.sh` and replaces `render_issue.sh` with a thin `engine_dispatch.sh` shim, and updates the migration-status map.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

- **Command name**: `discuss-issue-render-issue`.
- **Registry entry** (`core/lib/core/commands.js`): `{ module: 'commands/discuss-issue/DiscussIssueRenderIssue.js', method: 'run', context: 'repo' }`.
- **Leading `repoPath` argument**: unlike most `context: 'repo'` entries, none of `render_issue.sh`'s existing callers pass a repo path — they call `render_issue.sh "$REPO_PATH/$FILE" "<title>" ...` with an already-absolute `output_file`. Because `context: 'repo'` dispatch always requires a leading `repoPath` positional (stripped by the Dispatcher before reaching `run`), the **shim** (scripter's responsibility) must derive `REPO_PATH` itself from the ambient git checkout — the same convention `discuss-issue/scripts/confirm.sh` already uses (`git rev-parse --show-toplevel`) — and pass it as the hidden leading argument to `engine_dispatch`/`core/bin/arcanum`. Callers of `render_issue.sh` are unaffected; its own CLI surface (`render_issue.sh <output_file> <title> ...`) does not change.
- **Native method signature**: `run(outputFile, title, description = '', problem = '', expectedBehavior = '', solution = '', benefits = '')` (after the Dispatcher strips `repoPath`). `outputFile` and `title` are required (non-empty); the rest default to `''`, meaning "omit this section."
- **Template resolution**: the native command reads the template from `path.join(repoPath, 'discuss-issue', 'templates', 'issue.tmpl.md')` — the same file, resolved relative to the repo root the way the shell script resolves it relative to its own script location (`$SCRIPT_DIR/../templates/issue.tmpl.md`). Never hardcode an absolute path or bake the template contents into the JS module.
- **Placeholder substitution**: replace `%%TITLE%%`, `%%DESCRIPTION%%`, `%%PROBLEM%%`, `%%EXPECTED_BEHAVIOR%%`, `%%SOLUTION%%`, `%%BENEFITS%%` — each appears exactly once in the template, so a single (non-global) replace per placeholder is sufficient and mirrors the shell script's `${content/pattern/replacement}` (single-occurrence) semantics.
- **Blank-line collapsing**: after substitution, trim leading/trailing blank lines and collapse any run of 3+ consecutive newlines down to exactly one blank line (2 newlines) — equivalent to the shell script's `perl -0777 -pe 's/\A\n+//; s/\n+\z/\n/; s/\n{3,}/\n\n/g'`. This is the behavior most likely to silently diverge if re-derived from memory instead of read directly from `render_issue.sh`.
- **Output/exit-code contract** (stdout + exit code only — stderr text is never required to match byte-for-byte, per `docs/agents/architecture/script-engine.md`):
  - Success: writes the rendered content to `outputFile`, resolves with no return value (nothing written to stdout), exit code 0.
  - Missing/empty `outputFile` or `title`: throws a plain `Error` (uncaught by any `DispatchFailure` special-casing) — `core/bin/arcanum`'s top-level `.catch` writes `arcanum: <message>` to stderr and sets exit code 1, with nothing on stdout. This already matches the shell script's contract (empty stdout, exit 1) without needing `DispatchFailure`.
- **Shim replacement**: `discuss-issue/scripts/render_issue.sh` becomes a thin `engine_dispatch.sh`-based shim (scripter), routing to either `render_issue_shell.sh` or `core/bin/arcanum discuss-issue-render-issue` per `engine.mode` / `arcanum/_lib/migration-status.json`'s `discuss-issue-render-issue` key (node adds the registry entry and tests; scripter flips the migration-status flag and wires the shim — both sides must agree on the exact command-name string `discuss-issue-render-issue`).

## CI Checks

- `core`: `yarn test` (CircleCI job `test`) and `yarn lint` (CircleCI job `checks`) — both run from `core/` per `.circleci/config.yml`.

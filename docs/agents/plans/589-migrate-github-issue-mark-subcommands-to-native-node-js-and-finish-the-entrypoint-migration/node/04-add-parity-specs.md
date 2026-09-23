# Add shell-vs-native parity and engine_dispatch routing specs

Add one parity spec per command under `core/spec/bin/`. The layout can be a `githubIssueMarkParity/` folder with one file per command, or six `githubIssueMark<Name>Parity_spec.js` files; pick whichever the sibling folders (`autoFixAllGithubParity/`) suggest. Pull the repeated setup into a shared example in `core/spec/support/sharedExamples/` rather than duplicating it six times, because Codacy flags clone groups (see #553/#554). A single shared example parameterized by `{ name, add, removes }` from `MARK_TRANSITIONS` can drive all six.

Setup: use `setupParityTest` (`core/spec/support/factories/githubParitySetup.js`) for the fake `gh` binary and fake fetch. The shell side runs `arcanum/_lib/github_issue_shell.sh mark-<name> <repo> <id>` directly, bypassing the shim so the test isn't circular, the same as `githubIssueUpdateParity_spec.js`. The native side runs `core/bin/arcanum github-issue-mark-<name> <repo> <id>`. Assert byte-identical stdout, **stderr** and exit code. stderr matters here, because the `Error:` + `Warning:` pairs are part of the contract.

Cases per command:
- **added / removed**: labels contain every `removes` tag and not the `add` tag (`FAKE_GH_ISSUE_LABELS` / `FAKE_FETCH_ISSUE_LABELS` set to their GitHub label names, e.g. `Idea`, `Writting`). Expect one `Added …` line, then one `Removed …` line per remove, exit 0.
- **nothing to do**: the labels already contain the `add` tag and none of the removes. Expect `already present` / `not present` lines, exit 0.
- **fetch failure**: `FAKE_GH_ISSUE_VIEW_FAIL` / `FAKE_FETCH_ISSUE_VIEW_FAIL`. Expect an `Error: could not fetch issue …` + `Warning: …` pair per tag, empty stdout, exit 0.
- **update failure**: `FAKE_GH_ISSUE_EDIT_FAIL` / `FAKE_FETCH_ISSUE_EDIT_FAIL`, with labels that force the mutations. Expect an `Error: could not update issue …` + `Warning: …` pair per mutated tag, exit 0.
- **missing origin**: a git repo with no `origin` remote. Expect `_load_origin`'s error and exit 1 on both sides.

Engine-dispatch routing: add a routing spec that exercises the real `arcanum/_lib/github_issue.sh` shim in `engine.mode=shell` and in `engine.mode=native`, using the existing `itRoutesEngineDispatch` shared example (`core/spec/support/sharedExamples/engineDispatchRouting.js`) as `autoFixAllWaitCiParity/engine_dispatch_spec.js` does. As that spec explains, `env -i` strips the fake-fetch env vars in native mode, so choose a scenario that fails before any API call, such as the missing-origin case. Also cover the shim-level checks through `github_issue.sh`: a missing `<id>` gives `Usage: … mark-<name> <repo_path> <id>` and exit 1, and an unknown subcommand gives the new usage block and exit 1.

## Files to Change
- `core/spec/bin/githubIssueMarkParity/*_spec.js` (or six `githubIssueMark<Name>Parity_spec.js` files) — new parity specs.
- `core/spec/bin/githubIssueMarkParity/engine_dispatch_spec.js` — new routing and shim-usage spec.
- `core/spec/support/sharedExamples/githubIssueMarkParitySharedExamples.js` — new shared example parameterized by transition.

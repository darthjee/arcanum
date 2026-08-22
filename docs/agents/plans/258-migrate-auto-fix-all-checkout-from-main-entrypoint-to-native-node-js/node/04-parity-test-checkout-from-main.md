# Parity test (shell vs. native)

`core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js`, following `arcanumSplitIssueFinishParity_spec.js`'s shape: run `auto-fix-all/scripts/checkout_from_main_shell.sh <repo_path> <id>` directly (not through the `checkout_from_main.sh` engine_dispatch shim — that would be circular) and `core/bin/arcanum auto-fix-all-checkout-from-main <repo_path> <id>` against two freshly-built, identically-seeded `createGitFixtureRepo()` fixtures for each case, asserting byte-identical stdout and exit code for both:

- Fresh branch, `origin/main` present.
- Existing local branch, clean merge.
- Remote-only branch (no local ref).
- Conflict — assert both exit `2` with the same `BRANCH=.../STATUS=conflict/...` stdout, including the same conflicted-path line(s).
- A missing-arg usage-error case — both exit `1` with matching stderr (this one doesn't need a real fixture repo).

This is the test that actually proves node/01's `DispatchFailure` generalization reaches the real process exit code (`core/bin/arcanum`'s own `process.exitCode`), not just the thrown object in isolation — no separate exit-code-2 coverage is needed elsewhere.

## Files to Change

- `core/spec/bin/autoFixAllCheckoutFromMainParity_spec.js` — new parity spec, per the cases above.

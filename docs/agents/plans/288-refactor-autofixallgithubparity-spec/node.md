# node Plan: Refactor autoFixAllGithubParity_spec

Main plan: [plan.md](plan.md)

## Steps

- [01 — Extract runCommand/git/runBoth and path constants](node/01-extract-run-command-helpers.md)
- [02 — Extract seedEnv](node/02-extract-seed-env.md)
- [03 — Create the setupParityTest factory](node/03-create-github-parity-setup-factory.md)
- [04 — Extract engine_dispatch fixtures](node/04-extract-engine-dispatch-fixtures.md)
- [05 — Split the spec into per-subcommand files](node/05-split-spec-into-subcommand-files.md)

## CI Checks

- `core`: `yarn test` (CI job: `test`) — `c8 jasmine`; the existing `bin/**/*_spec.js` glob in `core/spec/support/jasmine.json` already covers the new subdirectory, no config change needed.
- `core`: `yarn lint` (CI job: `checks`) — eslint over the new/moved files.

## Notes

- Zero behavior change is the acceptance bar: same 13 test cases (11 parity across 7 subcommands + 2 `engine_dispatch` routing tests), same assertions, byte-identical shell/native stdout and exit codes.
- `cleanup_branch_spec.js` cannot use `expectParity` directly — git SHAs differ between the two independent fixture repos (different commit timestamps → different SHAs), so it predicts each side's expected stdout from its own repo's SHAs. This logic stays inline in that one split file.
- `engine_dispatch_spec.js` tests routing, not parity — it uses `runCommand`/`buildDispatchFixtures`/`ENGINE_DISPATCH_SCRIPT` only, never `setupParityTest`/`expectParity`.
- `core/spec/bin/autoFixAllQueueParity_spec.js` (479 lines) meets the same 400+ line convention but is out of scope here — tracked separately as #289, which should reuse the helpers this plan creates rather than duplicating them.
- This establishes a repo-wide convention (recorded in the issue): specs with 400+ lines AND multiple contexts/methods under test should be split into a `<name>/` subdirectory of per-context files.

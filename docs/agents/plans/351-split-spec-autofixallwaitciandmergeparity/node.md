# Node Plan: Split spec AutoFixAllWaitCiAndMergeParity

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Extract suite-specific helpers into a setup module

Create `core/spec/support/factories/autoFixAllWaitCiAndMergeParitySetup.js`, matching the
`Setup` suffix naming `core/spec/support/factories/autoFixAllWaitCiParitySetup.js` (issue
#350 / PR #370) already established. It exports only what's genuinely specific to this suite
— everything generic (`runCommand`, `REPO_ROOT`, `NATIVE_BIN`, `FAKE_FETCH_PRELOAD`, `git`,
`seedOriginUrl`) already lives in `core/spec/support/utils/runCommand.js` and must be imported
from there directly, not redeclared:

- `SHELL_SCRIPT` — `path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge_shell.sh')`.
- `SHIM_SCRIPT` — `path.join(REPO_ROOT, 'auto-fix-all', 'scripts', 'wait_ci_and_merge.sh')`
  (only `engine_dispatch_spec.js` needs this one).
- `seedGithubLikeRepo(repo)` — same shape as #350's version (calls `seedOriginUrl` from the
  shared utils module), but keeps this suite's own `FAKE_GITHUB_URL` constant
  (`'https://github.com/darthjee/arcanum-wait-ci-and-merge-fixture.git'`), copied verbatim
  from the current monolith (lines ~74, ~106-108).
- `seedLocalState(repo, config)` — writes `.claude/state/arcanum-config.json` under
  `repo.repoPath`, copied verbatim from the current monolith (lines ~127-132). No equivalent
  exists in #350's setup module — this one isn't extended from anywhere.

Behavior must be copied verbatim (including doc comments where useful) — no logic changes.

### Step 2 — Split the monolith into 3 files and delete it

Create `core/spec/bin/autoFixAllWaitCiAndMergeParity/` with 3 new files, each importing
generic helpers from `../../support/utils/runCommand.js` and suite-specific ones from
`../../support/factories/autoFixAllWaitCiAndMergeParitySetup.js` (relative depth matches
`core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js`'s own imports):

- `preconditions_spec.js` — the `describe` blocks `a missing required argument`, `a
  present-but-non-directory repo_path`, `a non-git repo_path` (current monolith lines
  ~135-203), moved verbatim.
- `ci_outcomes_spec.js` — the `describe` blocks `CI passes and the merge succeeds` (lines
  ~204-257) and `CI fails` (lines ~258-326), moved verbatim into one file (matches #350's
  merged `ci_outcomes_spec.js` shape rather than keeping two separate files).
- `engine_dispatch_spec.js` — the `describe` block `engine_dispatch routing (via the real
  wait_ci_and_merge.sh shim)` (lines ~327-366), moved verbatim. This is the only file that
  needs `SHIM_SCRIPT`.

Every `it` must move unchanged — no assertions added, removed, or altered. Each new file's
top-level `describe` name stays `'auto-fix-all-wait-ci-and-merge parity (shell vs. native)'`
plus a suffix identifying its slice (e.g. `— preconditions`, `— CI outcomes`, `— engine_dispatch
routing`), matching the `autoFixAllWaitCiParity/*_spec.js` files' own naming convention (see
`preconditions_spec.js`'s `describe('auto-fix-all-wait-ci parity (shell vs. native) —
preconditions', ...)`).

Delete `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` once its content has been fully
distributed.

## Files to Change

- `core/spec/support/factories/autoFixAllWaitCiAndMergeParitySetup.js` — new file (Step 1):
  `SHELL_SCRIPT`, `SHIM_SCRIPT`, `seedGithubLikeRepo`, `seedLocalState`.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/preconditions_spec.js` — new file (Step 2):
  the 3 precondition/validation describes.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/ci_outcomes_spec.js` — new file (Step 2):
  the "CI passes and the merge succeeds" and "CI fails" describes.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/engine_dispatch_spec.js` — new file (Step 2):
  the engine_dispatch shim routing describe.
- `core/spec/bin/autoFixAllWaitCiAndMergeParity_spec.js` — deleted (Step 2).

## CI Checks

- `core`: `yarn test` (CI job: `test`) — total spec count must be unchanged; every `it` moves,
  none is dropped or duplicated.
- `core`: `yarn lint` (CI job: `checks`) — must stay clean on the new files and the new setup
  module.

## Notes

- No change to `wait_ci_and_merge_shell.sh`, `wait_ci_and_merge.sh`, or any native
  `auto-fix-all-wait-ci-and-merge` implementation — out of scope per the issue.
- Reconciled against issue #350 (PR #370), which shipped first: the 3-file split and the
  `*ParitySetup.js` naming/placement convention are copied from that precedent rather than
  invented fresh, so the two sibling suites read consistently.

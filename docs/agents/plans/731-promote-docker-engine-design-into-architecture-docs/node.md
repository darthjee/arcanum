# Node Plan: Promote docker engine design into architecture docs

Main plan: [plan.md](plan.md)

## Shared contracts

You **consume** `docs/agents/architecture/docker-engine.md` and the anchor mapping table in [plan.md](plan.md#target-doc-and-anchor-mapping). Start after the architect has written that file. Comments only: no behaviour change.

## Implementation Steps

### Step 1 — Repoint core/ comments

Replace every `docs/agents/specs/docker*` reference in `core/bin/` and `core/spec/` comments, per the mapping table. Known today: `core/bin/arcanum`, `core/spec/bin/arcanum_spec.js`, `core/spec/bin/arcanumCreateIssue_spec.js`, `core/spec/bin/arcanumCheckConfig_spec.js`, `core/spec/bin/initClaudeSetNextStepAuto_spec.js`, `core/spec/bin/engineDispatchDocker_spec.js`, `core/spec/support/utils/fakeDockerBin.js`, `core/spec/support/utils/dockerParity.js` and `core/spec/support/factories/engineDispatchDockerSetup.js`. The batch PRs add parity cases under `core/spec/docker/` and routing cases, so re-run `grep -rn "specs/docker" core/bin core/lib core/spec` and fix every hit. If a spec asserts on text containing the old path (e.g. a message), change the assertion and its source together.

## Files to Change
- `core/bin/arcanum` — comment.
- `core/spec/**` files listed above, plus any the re-grep finds — comments.

## CI Checks
- `core`: `make core-check` (CI jobs: `test` → `yarn test`, `lint` → `yarn lint`).

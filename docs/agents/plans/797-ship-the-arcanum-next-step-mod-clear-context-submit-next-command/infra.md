# Infra Plan: Ship the arcanum-next-step mod (clear context + submit next command)

Main plan: [plan.md](plan.md)

## Shared contracts

Produces `make mod-check` as in [plan.md](plan.md#shared-contracts): for
`arcanum-next-step`, `claude plugin validate`, `tsc -p`, `claude plugin test`,
failing on the first failure.

## Implementation Steps

### Step 1 — `make mod-check`

Add a `MOD_DIRS := arcanum-next-step` variable and a `mod-check` target running the
three commands for each mod dir on the host (the Claude Code CLI and `tsc` must be on
`PATH`; `tsc` via `npx --yes -p typescript tsc` with a pinned version if not
installed). Add it to `.PHONY` and document it in the header comment.

### Step 2 — CircleCI `mod-checks` job

Add a `mod-checks` job to the `test` workflow (`darthjee/circleci_node` image):
install the Claude Code CLI (`npm i -g @anthropic-ai/claude-code`, pinned) and run
the same three commands. **Verify** which of them work headless without a credential
(and whether `tsc` has its engine-generated types there); keep only those in the job
and state in the PR that `make mod-check` is the full gate for the rest.

## Files to Change

- `Makefile` — `mod-check` target.
- `.circleci/config.yml` — `mod-checks` job in the `test` workflow.

## Notes

- `.circleci/` joins `infra`'s scope with #775; if that has not landed, the
  architect makes Step 2's change.

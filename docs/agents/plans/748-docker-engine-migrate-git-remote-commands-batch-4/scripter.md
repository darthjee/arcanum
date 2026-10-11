# Scripter Plan: Docker engine: migrate git remote commands (batch 4)

Main plan: [plan.md](plan.md)

## Shared contracts

You must produce the `--needs` (and any `--path-arg`) declarations in the table of [plan.md](plan.md#shared-contracts), and the final `"docker"` statuses for the 10 commands. `node` relies on both for its routing specs.

## Steps

- [01 — Declare docker needs in batch-4 shims](scripter/01-declare-needs.md)
- [02 — Flip statuses and regenerate the status table](scripter/02-flip-statuses.md)
- [03 — Tick the checklist rows and update the docker spec status](scripter/03-tick-checklist.md)

## CI Checks

- `arcanum/`, skill `scripts/`: shellcheck and the bash spec suite, as run by the repo's `make` / CI jobs (see `.circleci/config.yml`).

## Notes

- Step 01 must land before node's routing work. Steps 02 and 03 come after node's parity cases exist.
- `auto-fix-all/scripts/github.sh` dispatches several subcommands; only `cleanup-branch` is batch 4. Leave the batch-3 subcommands' declarations untouched.

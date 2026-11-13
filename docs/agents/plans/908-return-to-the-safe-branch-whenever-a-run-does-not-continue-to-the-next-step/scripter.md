# Scripter Plan: Return to the safe branch whenever a run does not continue to the next step

Main plan: [plan.md](plan.md)

## Shared contracts

Implement the `auto_next.sh <repo_path> <id>` flow and stdout forms from [plan.md](plan.md#shared-contracts) in the shell twin, byte for byte with the native twin:

- Push always happens once HEAD is `issue-<id>`, before the chain decision is printed.
- Mark-ready: `"${SCRIPT_DIR}/../../arcanum/_lib/github_issue.sh" mark-ready "$REPO_PATH" "$ID" >&2`. `READY=true` on exit 0, else `READY=false`.
- Release (only on `REASON=config`): `"${SCRIPT_DIR}/../../arcanum/_lib/checkout_safe_branch.sh" "$REPO_PATH" >&2`. `RELEASED=true` on exit 0, else `RELEASED=false`.

## Implementation Steps

### Step 1 — Extend `auto_next_shell.sh`

Reorder the flow per the contract: branch check → prompt → push (always) → mark-ready → `CHAIN=yes [CLEAR=true] READY=` or release + `CHAIN=no REASON=config READY= RELEASED=`. Every sub-call's stdout goes to stderr, so stdout stays key=value only. Never `exit` non-zero after the prompt step. Update the header comment (flow + output table).

### Step 2 — Forward `gh` credentials in the shim

`auto_next.sh` runs `engine_dispatch` with an env allowlist (native path uses `env -i`). Add `GH_TOKEN GH_HOST GH_ENTERPRISE_TOKEN` to the allowlist, so the in-process mark-ready can authenticate `gh` on the host (`HOME` is already forwarded for gh's config dir). Update the shim's header comment ("Env forwarded to the native path").

## Files to Change

- `auto-plan-issue/scripts/auto_next_shell.sh` — new flow, header contract.
- `auto-plan-issue/scripts/auto_next.sh` — allowlist + header comment.

## CI Checks

- repo root: shell lint/checks as run by the `checks` CircleCI job.
- `core/`: `make core-test` (CI job `test`). The parity spec runs this shell twin.

## Notes

- `checkout_safe_branch.sh` hard-fails on a dirty tracked tree. Capture its exit code (`|| released=false`) under `set -e`.
- `github_issue.sh mark-ready` is best-effort and exits 0 even on per-tag failures, so `READY=false` only reflects a hard failure (usage/dispatch).

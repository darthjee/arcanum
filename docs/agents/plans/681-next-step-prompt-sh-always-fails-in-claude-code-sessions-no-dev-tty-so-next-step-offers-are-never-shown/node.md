# Node Plan: next_step_prompt.sh always fails in Claude Code sessions (no /dev/tty), so next-step offers are never shown

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on the `next_step_prompt.sh` output/exit contract and the `ARCANUM_TTY_DEVICE` test-only override from [plan.md](plan.md#shared-contracts), as produced by `scripter`.

## Implementation Steps

### Step 1 — Add a jasmine spec for the no-TTY contract
Create `core/spec/bin/nextStepPromptShell_spec.js`, following the style of the existing `core/spec/bin/*_spec.js` files (`execFile` via `promisify`, `REPO_ROOT` from `import.meta.url`, `createTempDir`/`removeTempDir` from `../support/utils/tempDir.js`, JSDoc on helpers). It runs `arcanum/_lib/next_step_prompt.sh` directly with `env: { ...process.env, ARCANUM_TTY_DEVICE: <path inside the temp dir that doesn't exist> }` and `--repo <temp dir>`.

Cases:
- One `--command` → exit `4`, stdout exactly `FALLBACK=chat\nCOMMAND=/auto-fix-issue 1\n`.
- Several `--command`s → exit `4`, one `COMMAND=` line per command in the given order.
- Missing `--repo` → exit `1`, empty stdout.
- Missing `--command` → exit `1`, empty stdout.
- Empty `--command ""` → exit `1`, empty stdout.
- `--repo` pointing to a path that isn't a directory → exit `1`, empty stdout.

All usage-error cases also set the non-existent `ARCANUM_TTY_DEVICE`, which proves argument validation runs before the TTY probe.

## Files to Change
- `core/spec/bin/nextStepPromptShell_spec.js` — new spec pinning the exit-`4` fallback and the exit-`1` usage errors.

## CI Checks
- `core`: `yarn test` (CI job running "Run tests with coverage")
- `core`: `yarn lint` (CI job running "Lint")

## Notes
- This isn't a parity spec: there is no native counterpart. Name and header comment should make that clear.
- Don't test the interactive TTY paths (`CHOICE=yes/no/chat`). Driving a real TTY from jasmine is out of scope for this issue.

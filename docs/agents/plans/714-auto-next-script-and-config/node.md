# Node Plan: Auto-next: script and config

Main plan: [plan.md](plan.md)

## Shared contracts

You consume the CLI behavior in [plan.md § Shared contracts](plan.md#shared-contracts) and pin it in specs. Use the tier file paths and the `{"next_step": {"auto": {"<skill>": true}}}` shape listed there.

## Implementation Steps

### Step 1 — Make the spec helper config-aware

In `core/spec/bin/nextStepPromptShell_spec.js`:

- Extend `runPrompt` to accept extra env, and always set `CLAUDE_CONFIG_DIR` (and `HOME`) to a temp folder, so the real user's global config never leaks into the run.
- Add small helpers that write the local state, repo config and global config files under the temp repo / temp config dir (create parent folders as needed).
- Update the header comment: the spec now also pins the #714 auto-next flags.

### Step 2 — Add specs for `--auto-key` and `--no-prompt`

All runs keep `ARCANUM_TTY_DEVICE` pointed at a missing path, so a probe would show up as exit 4.

- `--auto-key` with the key `true` in repo config: exit 0, stdout exactly `CHOICE=yes\nAUTO=true\n`, stderr contains `auto-continuing: <first cmd> (next_step.auto.<skill>=true)`; with several `--command`, the notice names only the first.
- Key resolved from each tier alone (local, repo, global) → enabled.
- Precedence: local `false` beats repo `true` → not enabled (exit 4 fallback); repo `true` beats global `false` → enabled.
- Key absent, `false`, `null`, or the string `"true"` → unchanged behavior: exit 4 with the `FALLBACK=chat` output, no `AUTO=` line, no notice.
- Key enabled for another skill only → not enabled.
- `--no-prompt` without `--auto-key` → exit 0, stdout `CHOICE=no\n`.
- `--no-prompt` with `--auto-key` and key not enabled → `CHOICE=no`, exit 0; with key enabled → same output as `--auto-key` alone.
- Usage errors exit 1 with empty stdout: `--auto-key` with no value, `--auto-key ""`, and an unknown flag combined with an enabled key (validation before config read).

## Files to Change

- `core/spec/bin/nextStepPromptShell_spec.js` — config-aware helper and the new cases.

## CI Checks

- `core/`: `make core-test` (CI job: `test`)
- `core/`: `make core-lint` (CI job: `checks`)

## Notes

- The interactive TTY paths stay out of scope, as today.

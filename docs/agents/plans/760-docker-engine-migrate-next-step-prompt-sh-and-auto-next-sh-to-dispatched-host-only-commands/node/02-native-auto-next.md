# Native auto-plan-issue-auto-next

Add `core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js`, a native port of `auto-plan-issue/scripts/auto_next.sh`. Register it as `auto-plan-issue-auto-next` (method `run`, context `'repo'`, `validateRepoPath: false`).

Behavior must match the bash:

- **Usage**: a missing `<repo_path>` or `<id>`, or a `<repo_path>` that isn't a directory, exits 1 with the same stderr messages and empty stdout.
- **Branch check**: HEAD's abbreviated name must be `issue-<id>`. Anything else, including a git failure on a non-repo dir, prints `CHAIN=no` / `REASON=branch` and exits 0 without a config read.
- **Config check**: call `NextStepPrompt`'s exported logic **in-process** with `--repo <repo_path> --command "/loop /auto-resolve-issue <id>" --auto-key auto-plan-issue --no-prompt`. Pass its stderr notice through unchanged. If it fails, print `Error: next_step_prompt.sh failed for auto key 'auto-plan-issue'` to stderr and exit 1. If it answers `CHOICE` ≠ `yes`, print `CHAIN=no` / `REASON=config`.
- **Push**: run `git -C <repo_path> push` through the repo's existing git helper or exec wrapper, with git's output sent to stderr. On failure print `CHAIN=no` / `REASON=push`, on success `CHAIN=yes`. Exit 0 either way.

Add a unit spec under `core/spec/lib/commands/auto-plan-issue/`.

## Files to Change
- `core/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext.js` — new native command.
- `core/lib/core/commands.js` — register `auto-plan-issue-auto-next`.
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueAutoNext_spec.js` — new unit spec.

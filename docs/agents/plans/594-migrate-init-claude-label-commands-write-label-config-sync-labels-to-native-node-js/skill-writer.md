# Skill-writer Plan: Migrate init-claude label commands (write-label-config, sync-labels) to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

- The CLI surface of `scripts/sync_labels.sh "$REPO_PATH" [<config_path>]` and `scripts/write_label_config.sh <replace|remove|add> <config_path> ...` does not change, and neither do the prompt or the STATUS lines. No call site in the skill needs to change.

## Implementation Steps

### Step 1 — Fix the stale default-label count

`init-claude/setup_labels.md` still says `label_config_ensure_defaults` populates "the standard 9 labels"; there are now 22 (`DEFAULT_LABEL_PAIRS` in `init-claude/scripts/lib/label_config.sh`). Reword it so it doesn't hardcode a number that drifts, for example "the standard default labels (see `DEFAULT_LABEL_PAIRS`)". Apply the same fix to the "standard 10 labels" mention in `docs/agents/architecture/shared-state-and-configuration.md`.

## Files to Change
- `init-claude/setup_labels.md` — label-count wording
- `docs/agents/architecture/shared-state-and-configuration.md` — label-count wording

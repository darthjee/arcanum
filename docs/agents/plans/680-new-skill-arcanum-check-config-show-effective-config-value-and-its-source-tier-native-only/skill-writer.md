# Skill-writer Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You can rely on C3: `arcanum-check-config/scripts/check_config.sh <repo_path> <key>` prints the C1 JSON to stdout and exits 0, or prints usage to stderr and exits non-zero (missing key, or `engine.mode=docker`). See [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Write `arcanum-check-config/SKILL.md`
Create `arcanum-check-config/SKILL.md` with frontmatter:
- `name: arcanum-check-config`;
- a `description` covering what it does (shows each config tier's value for a key, and the final resolved value and its source tier) plus `Usage: /arcanum-check-config <namespace.key[.sub...]>`.

Body, mirroring `toggle-clear-context/SKILL.md`'s minimal shape:
1. Resolve `REPO_PATH="$(pwd)"`.
2. Run `scripts/check_config.sh "$REPO_PATH" "<skill args>"`, resolved relative to the skill folder.
3. On exit 0, relay the JSON verbatim in a fenced `json` block, followed by one plain sentence naming `final.source`, or saying no tier sets the key. On non-zero, relay stderr and stop.

No user interaction, no `/dev/tty` prompt, no closing `finish_report.sh`. It's a read-only, single-shot query.

## Files to Change
- `arcanum-check-config/SKILL.md` — new skill.

## Notes
- Keep all logic in the script and command. The SKILL.md only calls the script and relays its output (the skill-reviewer checks this).

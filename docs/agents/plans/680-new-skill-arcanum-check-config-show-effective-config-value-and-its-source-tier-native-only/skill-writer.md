# Skill-writer Plan: New skill /arcanum-check-config: show effective config value and its source tier (native-only)

Main plan: [plan.md](plan.md)

## Shared contracts

You can rely on C3: `arcanum-check-config/scripts/check_config.sh <repo_path> <key>` prints the C1 JSON on stdout and exits `0`, or prints an error on stderr and exits non-zero (missing/malformed key, or `engine.mode=docker`). See [plan.md](plan.md#shared-contracts).

## Implementation Steps

### Step 1 — Write `arcanum-check-config/SKILL.md`
Create `arcanum-check-config/SKILL.md` with frontmatter:
- `name: arcanum-check-config`;
- a `description` saying it shows what each arcanum config tier (local state → repo config → global config) holds for a key, plus the final resolved value and which tier it came from, ending with `Usage: /arcanum-check-config <namespace.key[.sub...]>` (e.g. `/arcanum-check-config git.authors`).

Body, mirroring `toggle-clear-context/SKILL.md`'s minimal shape:
1. Resolve `REPO_PATH="$(pwd)"`.
2. Run `scripts/check_config.sh "$REPO_PATH" "<key argument>"`, resolved relative to the `arcanum-check-config` skill folder. If no argument was given, still call the script with an empty key and let it print the usage error.
3. On exit `0`, relay the JSON verbatim in a fenced `json` block, followed by one plain sentence: the final value comes from `<final.source>`, or no tier sets the key. On non-zero, relay stderr and stop.

No user interaction, no `/dev/tty` prompt, no `finish_report.sh` closing report (the skill is out of scope for [Skill Finish](../../architecture/skill-finish.md): a read-only, single-shot query).

## Files to Change
- `arcanum-check-config/SKILL.md` — new skill.

## Notes
- All logic stays in the script and native command; `SKILL.md` only calls the script and relays its output (the `skill-reviewer` checks this).

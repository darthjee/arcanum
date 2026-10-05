# Scripter Plan: Auto-next: init-claude, migrations, remove spec

Main plan: [plan.md](plan.md)

## Shared contracts

- **Dotted keys**: `repo_config_write` and `global_config_write` treat `<key>` as a dot-separated path, written with `setpath(($k | split(".")); $v)` under `.[$ns]`. Flat keys are unchanged.
- **Keys**: `enhance-issue`, `discuss-issue` and `auto-plan-issue`, in this order, under namespace `next_step` as key `auto.<skill>`, with JSON `true`/`false`. Skipping writes nothing.
- **Migrations** `next/001` (`local`), `next/002` (`repo`) and `next/003` (`global`): `type: script`, `skippable: true`. `config` prints `{"skippable": true}`. With no TTY, `run` writes nothing and exits `0`. Each key is prompted with `[Y]es/[N]o/[S]kip`. `002` prints the commit warning first. Every migration explains up front that an explicit `false` shadows lower tiers.

## Implementation Steps

### Step 1 — Dotted-key support in the shell writers

In `arcanum/_lib/repo_config.sh` (`repo_config_write`) and `arcanum/_lib/global_config.sh` (`global_config_write`), replace `.[$ns] = ((.[$ns] // {}) | .[$k] = $v)` with a path-based write: `.[$ns] = ((.[$ns] // {}) | setpath(($k | split(".")); $v))`. A flat key produces the same result as before. Update both functions' header comments to say a dotted key is a nested path, mirroring the readers' comments. Search for callers that pass a key containing a literal dot and expect it kept flat. No such caller is expected: the readers already resolve dots as paths, so a literal dotted key could never be read back.

### Step 2 — The three migrations

Scaffold them with `arcanum/migrations/generate_next.sh --type script` three times, so the ids (`001`–`003`) and `next/migrations.json` entries come out right. Then set `applies_to` to `local`, `repo` and `global` respectively, with `skippable: true`.

Model each `NNN.sh` on `arcanum/migrations/repos/0.16.1/001.sh`, `002.sh` and `003.sh` (`git.merge_body_mode`): the `config`/`run` subcommands, the `/dev/tty` probe that silently does nothing, and sourcing `repo_config.sh` or `global_config.sh`. `run` does the following:

- Explains what auto-next does: a `true` key skips that skill's next-step offer and runs the offered command as a chained run.
- Explains that an explicit `false` shadows a `true` in a lower-precedence tier.
- `002` only: prints the "committed and visible to all contributors" warning.
- Loops over the three skills, describing the offer each one skips:
  - `enhance-issue` skips `/discuss-issue <id>`, and never applies to an Epic;
  - `discuss-issue` skips `/auto-plan-issue <id>`;
  - `auto-plan-issue` skips `/loop /auto-resolve-issue <id>` once a plan exists.
- Prompts `[Y]es/[N]o/[S]kip: ` for each key, reading from `/dev/tty`. `Y` writes `true` and `N` writes `false`, through `repo_config_write <file> "" next_step "auto.<skill>" true|false` for `001`/`002` or `global_config_write "" next_step "auto.<skill>" true|false` for `003`. Any other answer writes nothing.

Keep the per-skill loop in one function per script rather than repeating three `case` blocks.

Write each `NNN.md` in the style of `0.16.1/001.md`–`003.md`: what it sets, in which tier, what each answer does, the no-TTY behavior, and that it is safe to re-run.

## Files to Change

- `arcanum/_lib/repo_config.sh`: dotted keys in `repo_config_write`.
- `arcanum/_lib/global_config.sh`: dotted keys in `global_config_write`.
- `arcanum/migrations/repos/next/migrations.json`: three entries.
- `arcanum/migrations/repos/next/001.sh`, `001.md`: the local-tier migration.
- `arcanum/migrations/repos/next/002.sh`, `002.md`: the repo-tier migration.
- `arcanum/migrations/repos/next/003.sh`, `003.md`: the global-tier migration.

## Notes

- Migrations stay plain shell and have no native counterpart (see `core/lib/commands/shared/PermissionGrant.js`'s note on `arcanum/migrations/repos`).
- Run `shellcheck` on the new and changed scripts.

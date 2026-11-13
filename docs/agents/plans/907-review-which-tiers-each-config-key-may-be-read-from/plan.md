# Plan: Review which tiers each config key may be read from

Issue: [907-review-which-tiers-each-config-key-may-be-read-from.md](../../issues/907-review-which-tiers-each-config-key-may-be-read-from.md)

## Overview

Widen the tiers of five keys in `shared/lib/config/keys.json` and register the global `migrations.version` pointer. Reads already follow the registry (#902, #903, #905), so the behavior change is a data edit. The rest of the work is updating the specs that pinned the old tiers, adding two warn-only migrations (global and local scope) so users learn which values start taking effect, and updating the docs.

## Agents involved

- [shared](shared.md): the `keys.json` edit and the shared specs.
- [client](client.md): the CLI specs that pin tier suffixes and default write tiers.
- [scripter](scripter.md): the two warn-only migrations under `arcanum/migrations/repos/next/`.
- [node](node.md): the contract spec for those migrations under `core/spec/bin/`.

## Shared contracts

### New `keys.json` tiers

| Key | `tiers` | `default_tier` | Effective default write tier |
| --- | --- | --- | --- |
| `git.safe_branch` | `["global", "local"]` | none | local (rule 3) |
| `auto-fix-all.clear_context` | `["global", "local"]` | none | local |
| `auto-fix-all.finish_on_empty_queue` | `["global", "local"]` | none | local |
| `monitor-issues.clear_context` | `["global", "local"]` | none | local |
| `auto-fix-all.ignored_check_patterns` | `["repo", "local"]` | `"repo"` (new) | repo |
| `migrations.version` | `["global", "local"]` | none | n/a (`read_only: true`, unchanged) |
| `version` | `["repo"]` (unchanged) | none | n/a |

Precedence is unchanged (local → repo → global). The repo tier stays **disallowed** for `git.safe_branch` and the three workflow keys, so specs that use "`git.safe_branch` set in the repo tier" as the example of an ignored value stay valid.

### Migrations under `arcanum/migrations/repos/next/`

`migrations.json` gains two entries after the existing `001`:

```json
{"id": "002", "type": "script", "file": "002.sh", "skippable": true, "applies_to": "global"},
{"id": "003", "type": "script", "file": "003.sh", "skippable": true, "applies_to": "local"}
```

- `002.sh run`: reads the global config file (`_global_config_file` / `global_config_read` from `arcanum/_lib/global_config.sh`, i.e. `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`). For each of `git.safe_branch`, `auto-fix-all.clear_context`, `auto-fix-all.finish_on_empty_queue`, `monitor-issues.clear_context` that is present and not `null`, prints one line to **stderr**:
  `Warning: <key> = <json value> in <file> now takes effect (arcanum reads it from the global tier). Remove it with: arcanum config unset <key> --tier global`
  No matching key, a missing file or an unresolvable global location: prints nothing and exits 0. A malformed file: one warning line that it could not be read, exit 0. It never writes any file.
- `003.sh run`: same, for `auto-fix-all.ignored_check_patterns` in `.claude/state/arcanum-config.json` (cwd = target repo), with "now overrides the repo value" and `--tier local`.
- `config` subcommand: prints `{"skippable": true}` for both, as `001.sh` does.
- Each has a `<id>.md` summary.

The exact wording above is the contract the node spec asserts on. Before fixing the text, check that `arcanum config unset <key> --tier <tier>` is the real CLI syntax (`cli/lib/commands/config/unset.js`). If it isn't, scripter uses the real syntax and node asserts on it.

## Coordinator follow-up (architect)

After the specialists land, update the docs:

- `docs/agents/architecture/config-keys.md`: the Settings rows for the six keys (Tiers, Default tier, Notes such as "A value in the repo or global file is ignored"), and the sentence "Only `git.email` and `git.agents.<agent>` set `default_tier`" (now also `auto-fix-all.ignored_check_patterns`).
- `docs/guides/arcanum-global-config.md`, the "`migrations.version` pointer" section: it is now registered for the global tier, still read-only, and the runner still reads each pointer from its own file (no local → global fallback).
- `docs/guides/arcanum-repo-config.md` if it states the old tiers of `ignored_check_patterns` / `git.safe_branch`.
- `docs/agents/architecture/per-repo-migrations.md` does not need a change. The new migrations are ordinary entries.
- Release note text (for the GitHub release): values in the newly allowed tiers now take effect, and the migrations list them.

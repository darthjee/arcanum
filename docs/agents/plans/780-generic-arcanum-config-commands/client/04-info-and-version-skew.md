# info and version skew
Implement `info` and the version-skew logic that `set`/`unset` reuse.

- Skew (index spec "Version skew"): compare each tier file's version pointer with the embedded `MIGRATION_VERSIONS` and `CLI_VERSION`. A tier that is ahead of the CLI gets a warning on reads and refuses writes with exit `5` unless `--force` is passed. A tier that is behind gets a warning only when its scope has migrations pending past its pointer. Make `MIGRATION_VERSIONS`/`CLI_VERSION` injectable so that specs can drive every case.
- `info` (index spec "`arcanum config info`"): the resolved `CLAUDE_CONFIG_DIR` and its source (flag, env or default), the repo root, each tier file with its version pointer and skew status, and the CLI and Node versions. It always exits `0` except on usage errors, and missing targets are reported rather than failing. Add a `--json` shape.

## Files to Change
- `cli/lib/skew.js` (new) — per-tier skew status from a pointer, the scope and the embedded lists.
- `cli/lib/commands/config/info.js` — the `info` command.
- `cli/spec/lib/skew_spec.js`, `cli/spec/lib/commands/config/info_spec.js` (new) — ahead, behind with and without pending migrations, missing pointer, plus the `info` human and JSON output.

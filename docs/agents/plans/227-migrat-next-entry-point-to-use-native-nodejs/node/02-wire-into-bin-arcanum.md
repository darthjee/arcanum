# Wire into core/bin/arcanum

Route the `resolve-id-and-file` command (see [plan.md](../plan.md)'s Shared contracts) in `core/bin/arcanum` to Step 01's module, following the same `COMMANDS` registry entry shape already used for `resolve-and-fetch`/`dispatch-fixture`/`dispatch-fixture-crash`. Arguments arrive exactly as `engine_dispatch.sh` forwards them: `<repo_path> <issues_folder> <arg_string>`.

## Files to Change

- `core/bin/arcanum` — add the `resolve-id-and-file` entry to `COMMANDS`.

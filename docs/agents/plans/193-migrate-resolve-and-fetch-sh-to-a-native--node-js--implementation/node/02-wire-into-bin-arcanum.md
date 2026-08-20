# Wire into core/bin/arcanum

Route the `resolve-and-fetch` command (see [plan.md](../plan.md)'s Shared contracts) in `core/bin/arcanum` to Step 01's module, following whatever routing convention `core/bin/arcanum` already uses for `dispatch-fixture`/`dispatch-fixture-crash`. Arguments arrive exactly as `engine_dispatch.sh` forwards them: `<repo_path> <issues_folder> <arg_string>`.

## Files to Change

- `core/bin/arcanum` — add the `resolve-and-fetch` routing case.

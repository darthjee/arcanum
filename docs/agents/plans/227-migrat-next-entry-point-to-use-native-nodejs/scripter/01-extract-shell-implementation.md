# Extract the shell implementation

Move the current logic of `arcanum/_lib/resolve_id_and_file.sh` (the `repo_path_enter` call, `title_to_snake_case`/`find_existing_file`/`build_file`/`title_from_filename` helpers, argument parsing, and the Scenario A/B/C `case` block) verbatim into a new `arcanum/_lib/resolve_id_and_file_shell.sh`, unchanged in behavior — this becomes the fallback implementation `engine_dispatch.sh` runs when native isn't available or isn't configured.

This step lands before Step 02 — Step 02 reduces `resolve_id_and_file.sh` itself into a dispatch shim that calls into this file.

## Files to Change

- `arcanum/_lib/resolve_id_and_file_shell.sh` (new) — receives the full current implementation.

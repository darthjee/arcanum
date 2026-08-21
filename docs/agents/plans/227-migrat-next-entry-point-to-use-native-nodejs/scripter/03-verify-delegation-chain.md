# Verify the delegation chain

Manually confirm the end-to-end call chain still works after Step 02, in both `engine.mode=shell` (default) and, once `node`'s work lands, `engine.mode=native`:

- `discuss-issue/scripts/resolve_id_and_file.sh` → `arcanum/_lib/resolve_id_and_file.sh` (the shim) → `resolve_id_and_file_shell.sh` or `core/bin/arcanum resolve-id-and-file`, per `engine.mode`.
- `auto-new-issue/scripts/resolve_id_and_file.sh` → same chain.
- `auto-new-issue/steps/run.md`'s documented invocation (`scripts/resolve_id_and_file.sh "$REPO_PATH" docs/agents/issues "<skill_args>"`) still resolves and produces the same output shape it always has.

No skill `.md` file changes are expected — the migration is fully transparent behind the shim — but re-read `discuss-issue/steps/extract_id_and_name.md` and `auto-new-issue/steps/run.md` to confirm neither documents shell-specific behavior that would now be inaccurate.

## Files to Change

- None expected. If verification surfaces a doc that needs updating, note it here and fix it as part of this step.

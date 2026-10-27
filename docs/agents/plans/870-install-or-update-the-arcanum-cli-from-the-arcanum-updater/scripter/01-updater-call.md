# Client step in updater.sh

Make the client step the last step of `arcanum/update/updater.sh`, right after `echo "arcanum updated to ${VERSION} at ${TARGET}" >&2`:

```bash
# Client step (docs/agents/specs/cli-install/update.md): installs or
# updates arcanum-cli@$VERSION from the installed tree, so the script
# outlives cleanup. Never fails the update: only the opt-in exit 4
# (ARCANUM_CLI_PROMPT=chat, set by /arcanum-update) is propagated, with
# its FALLBACK=chat stdout lines; any other status is ignored.
cli_status=0
"${TARGET}/arcanum/_lib/install_cli.sh" "$VERSION" || cli_status=$?
if [[ "$cli_status" -eq 4 ]]; then
  exit 4
fi
```

- Do **not** clear `ARCANUM_CLI_PROMPT`, unlike the installer.
- Do not pass `--no-confirm`.
- The `Already on ${VERSION}.` early exit stays before the lock and is unchanged, so a no-op update never runs the step.
- Update the header comment:
  - The script now ends with the client step.
  - Exit codes: `0` (updated, or already on the version), `1` (aborted target, missing install, lock held), `4` (opt-in chat fallback from the client step, with the arcanum update already complete).

## Files to Change

- `arcanum/update/updater.sh`: add the client-step call and update the header comment.

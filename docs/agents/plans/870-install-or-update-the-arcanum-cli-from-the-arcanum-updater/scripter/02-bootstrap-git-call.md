# Client step in the bootstrap.sh git path

In `arcanum/update/bootstrap.sh`, inside the existing `if [[ "$METHOD" == "git" ]]; then ... fi` block, replace the trailing `echo "arcanum updated to ..."; exit 0` with this:

```bash
  echo "arcanum updated to ${VERSION} at ${TARGET}" >&2

  # Client step (docs/agents/specs/cli-install/update.md), run from the
  # checked-out tree so every later update uses the new copy. Skipped
  # silently when this version predates the script. Only the opt-in exit
  # 4 is propagated. Keep this inside the `if` block: `git checkout` just
  # rewrote this file on disk, and bash has already parsed the whole
  # compound command, so code here is safe. A top-level command after
  # the block would be read from the new file at an arbitrary offset.
  CLI_SCRIPT="${TARGET}/arcanum/_lib/install_cli.sh"
  if [[ -f "$CLI_SCRIPT" ]]; then
    cli_status=0
    bash "$CLI_SCRIPT" "$VERSION" || cli_status=$?
    if [[ "$cli_status" -eq 4 ]]; then
      exit 4
    fi
  fi
  exit 0
```

- Use `-f` with `bash "$CLI_SCRIPT"`, or else `-x` with a direct call, so an executable bit lost in the checkout cannot matter. Pick one and keep it consistent with the test stub.
- `Already on ${VERSION}.`, the dirty-tree refusal and the `[y/N]` confirmation are unchanged.
- The zip branch is unchanged: it execs `updater.sh`, which owns the step there.
- Update the `Env vars:` header comment:
  - `ARCANUM_SKIP_CLI`: any non-empty value skips the arcanum-cli client step.
  - `ARCANUM_CLI_PROMPT`: set to `chat` by `/arcanum-update` only. With no TTY, the client step exits `4` with `FALLBACK=chat` instead of skipping.
- In the same header comment, note that this script and `updater.sh` exit `4` in that case.

## Files to Change

- `arcanum/update/bootstrap.sh`: add the git-path client step and update the header comment.

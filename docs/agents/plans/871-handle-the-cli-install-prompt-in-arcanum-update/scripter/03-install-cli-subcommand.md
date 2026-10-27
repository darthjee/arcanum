# Add the install-cli subcommand

Add a plain `install-cli)` branch to the `case` in `arcanum-update/scripts/run_update.sh`:

```bash
  install-cli)
    if [[ $# -ne 2 ]]; then
      echo "Usage: $0 install-cli <version>" >&2
      exit 1
    fi
    exec "${TARGET_PATH}/arcanum/_lib/install_cli.sh" "$2" --no-confirm
    ;;
```

(`exec` or a plain call — either way the exit code is `install_cli.sh`'s.) It is deliberately **not** a migrated entrypoint: no `engine_dispatch`, no `_shell.sh` twin, no native command and no `migration-status.json` entry, the same as `install_cli.sh` itself, which is plain bash by design and must use the host's `npm` (see its header and `docs/agents/architecture/script-engine.md`). Version validation stays in `install_cli.sh`.

Update the `*)` usage lines and the header comment (`Usage:` block plus a paragraph for `install-cli`: resumes only the client step after the `/arcanum-update` chat answer, with the pre-answer `--no-confirm`; exit `0` for every outcome, `1` usage).

Add a standalone test script `arcanum-update/scripts/test_run_update_install_cli.sh`, in the style of `arcanum/update/test_updater.sh` (`fail`, temp dir, `trap` cleanup, prints `ok`). Build a fake install tree in a temp dir containing a copy of the real `run_update.sh` at `arcanum-update/scripts/run_update.sh` and a stub `arcanum/_lib/install_cli.sh` that records `$0` and its arguments to a log and exits `${STUB_RC:-0}`. The `engine_dispatch.sh` source line needs `arcanum/_lib/engine_dispatch.sh` (and what it sources) to exist; copy the real `arcanum/_lib/engine_dispatch.sh`, `engine_dispatch_docker.sh` and `config_chain.sh` (and anything else they source) into the fake tree. Cases:

1. `install-cli 1.2.3` → stub called once from the fake tree's `arcanum/_lib/`, with args `1.2.3 --no-confirm`, exit `0`.
2. `STUB_RC=1` → exit `1` passes through.
3. `install-cli` with no version → usage on stderr, exit `1`, stub not called.
4. `install-cli 1.2.3 extra` → usage, exit `1`, stub not called.

## Files to Change
- `arcanum-update/scripts/run_update.sh` — `install-cli` branch, usage lines, header comment.
- `arcanum-update/scripts/test_run_update_install_cli.sh` — new standalone test script.

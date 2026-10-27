# 03 — Docs touch-ups

1. **`arcanum/install/bootstrap.sh`** header: add `ARCANUM_SKIP_CLI` to the env-var list ("Set (any non-empty value) to skip the arcanum-cli client step the installer runs last"), and note that `ARCANUM_ASSUME_YES` does not answer the client prompt.
2. **`docs/agents/specs/cli-install.md`** Status: the installer caller now exists (#869), and `arcanum self-update` exists (#867); the updater, `/arcanum-update` and the migration are still pending.
3. **`docs/agents/specs/cli-install/install.md`** Testing strategy: installer-level tests (client step after `arcanum.json`, `ARCANUM_SKIP_CLI`, `ARCANUM_ASSUME_YES`, exit-code isolation) live in `arcanum/install/test_installer.sh`; the per-outcome tests stay in `arcanum/_lib/test_install_cli.sh`. Note the installer clears `ARCANUM_CLI_PROMPT`, so it never exits `4`. If implementation shows any other spec statement is wrong, fix it here too.

The README, the user guide and the architecture docs are out of scope (#873, #874).

## Files to Change

- `arcanum/install/bootstrap.sh` — header comment only.
- `docs/agents/specs/cli-install.md` — Status line.
- `docs/agents/specs/cli-install/install.md` — Testing strategy (and Decisions, if a note on `ARCANUM_CLI_PROMPT` fits there better).

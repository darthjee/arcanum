# Spec and architecture doc touch-ups

Bring the docs in line with the decisions in the issue:

- `docs/agents/specs/cli-install/already-installed.md`:
  - Flow step 3 → "No TTY, no `--no-confirm` and no `ARCANUM_CLI_PROMPT=chat`: skip with a warning." Add that with `--no-confirm` the script never opens `/dev/tty`.
  - Outcomes table: put the final wording of each line (from the issue's Wording section and what step 03 implements).
  - Testing strategy: "bats tests" → "standalone shell tests (`arcanum/_lib/test_install_cli.sh`)"; mention that CI coverage is #882.
  - Replace "for example `arcanum/_lib/install_cli.sh`" with the actual name.
- `docs/agents/specs/cli-install/install.md`:
  - Flow step 5.2: same `--no-confirm` wording as above.
  - Outcomes table: final wording, including the prompt text.
  - Testing strategy: same "bats" fix.
- `docs/agents/specs/cli-install/update.md`: replace "for example `arcanum/_lib/install_cli.sh`" with the actual name where it appears.
- `docs/agents/specs/cli-install.md`: Open points → "None."; Status stays "Proposed" except a line noting the shared script exists (#868) while the callers are pending.
- `docs/agents/architecture/script-engine.md`, Scope boundaries: add a bullet that `arcanum/_lib/install_cli.sh` (and its test) is deliberately plain bash outside engine dispatch — it runs from `installer.sh`/`bootstrap.sh` outside any configured repo, must use the host's `npm`, and must work when Node is missing — so it has no native twin, no `migration-status.json` entry, and is not removed by [Shell Engine Removal](../specs/shell-engine-removal.md).

## Files to Change

- `docs/agents/specs/cli-install/already-installed.md` — Flow step 3, Outcomes wording, Testing strategy, script name.
- `docs/agents/specs/cli-install/install.md` — Flow step 5.2, Outcomes wording, Testing strategy.
- `docs/agents/specs/cli-install/update.md` — script name.
- `docs/agents/specs/cli-install.md` — Open points, Status note.
- `docs/agents/architecture/script-engine.md` — the plain-bash exception.

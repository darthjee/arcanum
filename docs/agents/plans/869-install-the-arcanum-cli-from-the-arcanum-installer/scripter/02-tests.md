# 02 — Add test_installer.sh

Create `arcanum/install/test_installer.sh`, a standalone script in the style of `arcanum/_lib/test_install_cli.sh` (header comment, `set -uo pipefail`, `fail`, temp dir with `trap cleanup EXIT`, `run`/`assert_*` helpers, exit `0` on success). Make it executable.

## Harness

- **Fake release tree** in the temp dir: copy the real `arcanum/install/installer.sh` and `arcanum/_lib/install_cli.sh` into `<tmp>/release/arcanum/install/` and `<tmp>/release/arcanum/_lib/`, and write a small `<tmp>/release/MANIFEST`. Run `<tmp>/release/arcanum/install/installer.sh`, so `RELEASE_ROOT` is the fake tree (never the repo).
- **Clean env** per run via `env -i`: `HOME=<tmp>/home` (the default target is `$HOME/.claude/skills`), `PATH=<stub bin>:/usr/bin:/bin` plus the directory of `jq`, `REPO=darthjee/arcanum`, `VERSION=2.3.0`, `ARCANUM_TTY_DEVICE=<tty file>`, `ARCANUM_CLI_TIMEOUT_MS=500`, plus per-case vars.
- **Stubs**: reuse the `test_install_cli.sh` stub shapes. Stub `npm` logs each call; for the ordering case it also records whether `$HOME/.claude/skills/arcanum.json` exists at its first call. Stub `node` fakes `--version` (e.g. `v22.13.0`) and execs the real `node` otherwise. Skip the whole script with a message (exit `0`) if `node` or `jq` is missing on the host.
- **TTY file gotcha**: every `read < "$TTY_DEVICE"` reopens a regular file and reads its **first line**. So:
  - a TTY file whose first line is empty means: default target, and Enter (= yes) at the client prompt;
  - a first line of a custom path makes the confirmation read that same non-empty line, so the installer aborts with exit `1`. That is exactly the aborted-target case;
  - `install_cli.sh` appends its prompt text to the TTY file, which lets a test assert the client prompt was asked.

## Cases

Each case asserts the exit code and relevant stderr lines.

1. **Ordering / happy path**: TTY first line empty, stub `npm` succeeds. Exit `0`; `arcanum installed to` precedes `arcanum-cli: arcanum-cli@2.3.0 installed.` in stderr; `arcanum.json` existed at the first `npm` call; the target holds `arcanum.json`.
2. **`ARCANUM_SKIP_CLI=1`**: exit `0`, `client step skipped (ARCANUM_SKIP_CLI is set)`, empty npm call log, complete install.
3. **Client failure**: stub `npm i` fails with `EACCES`. Exit `0`, the EACCES warning, complete install.
4. **`ARCANUM_ASSUME_YES=1`** does not answer the client prompt: the prompt text `Install arcanum-cli@2.3.0 globally (npm i -g)? [Y/n]` was appended to the TTY file.
5. **Exported `ARCANUM_CLI_PROMPT=chat`**: exit `0`, empty stdout (no `FALLBACK=chat`).
6. **Existing install**: pre-create `$HOME/.claude/skills/arcanum.json`. Exit `1`, the existing-install error, empty npm call log.
7. **Aborted target**: TTY first line `<tmp>/custom`. Exit `1`, `Aborted: installation not confirmed.`, empty npm call log, no `<tmp>/custom/arcanum.json`.

Each case uses a fresh `HOME` (or removes the previous target) so installs do not collide.

## Files to Change

- `arcanum/install/test_installer.sh` — new standalone test script.

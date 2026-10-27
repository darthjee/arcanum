# 01 — Wire the client step into installer.sh

1. **TTY seam.** Near the top of `arcanum/install/installer.sh`, add:

   ```bash
   # TEST-ONLY override of the TTY device (same seam as arcanum/_lib/install_cli.sh).
   TTY_DEVICE="${ARCANUM_TTY_DEVICE:-/dev/tty}"
   ```

   Replace both `read -r ... < /dev/tty` with `< "$TTY_DEVICE"`. Default behavior is unchanged.

2. **Client step.** After `echo "arcanum installed to ${TARGET}" >&2`, add the last step:

   ```bash
   # Client step (docs/agents/specs/cli-install/install.md): installs or
   # updates arcanum-cli@$VERSION. Never fails the install: install_cli.sh
   # exits 0 on every outcome, `|| true` covers a usage error, and
   # ARCANUM_CLI_PROMPT is cleared because the installer has no chat to
   # fall back to (no exit 4 / FALLBACK=chat).
   ARCANUM_CLI_PROMPT= "${SCRIPT_DIR}/../_lib/install_cli.sh" "$VERSION" || true
   ```

   No `--no-confirm`: the installer always asks on the TTY. `ARCANUM_SKIP_CLI` and `ARCANUM_ASSUME_YES` need no handling here (the former is honored by `install_cli.sh`; the latter is deliberately not passed on as consent).

3. **Header comment.** Update the installer's header: it now also runs the `arcanum-cli` client step as its last step (link the spec), and list the env vars it reacts to (`ARCANUM_SKIP_CLI`, and `ARCANUM_TTY_DEVICE` as test-only).

The installer must still exit `1` before the client step when the target confirmation is aborted or an arcanum install already exists.

## Files to Change

- `arcanum/install/installer.sh` — TTY seam, client-step call, header comment.

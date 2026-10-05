# Plan: Auto-next: script and config

Issue: [714-auto-next-script-and-config.md](../../issues/714-auto-next-script-and-config.md)

## Overview

Add `--auto-key <skill>` and `--no-prompt` to `arcanum/_lib/next_step_prompt.sh`, so a next-step offer can be skipped when `next_step.auto.<skill>` resolves to JSON `true` through the 3-tier config chain. Pin the new behavior in the existing contract spec, and document the flags and the `next_step.auto.*` keys. Follows the merged spec `docs/agents/specs/skill-auto-next.md`. Wiring the flags into skills is #715 and is out of scope here.

## Agents involved

- [scripter](scripter.md)
- [node](node.md)
- [architect](architect.md)

## Shared contracts

CLI:

```text
next_step_prompt.sh --repo <repo_path> --command "<command>" [--command "<command>"]... [--auto-key <skill>] [--no-prompt]
```

Config read: `config_chain_read "$REPO_PATH" next_step "auto.<skill>"` (from `arcanum/_lib/config_chain.sh`). The value is compact JSON (`jq -c`), so the key is enabled **only** when the output is exactly `true`. Absent, `null`, `false`, `"true"` (string), or anything else counts as disabled.

Order of evaluation:

1. Argument validation (exit 1, empty stdout, error on stderr): unknown argument; flag missing its value; missing `--repo`; `--repo` not a directory; no `--command`; empty `--command`; empty `--auto-key` value. `--no-prompt` takes no value. No config read and no TTY probe happen before validation passes.
2. If `--auto-key` is given and the key is enabled:
   - stderr: `auto-continuing: <first --command, verbatim> (next_step.auto.<skill>=true)`
   - stdout: `CHOICE=yes\nAUTO=true\n`
   - exit 0, `/dev/tty` never probed (applies with or without `--no-prompt`).
3. Else if `--no-prompt`: stdout `CHOICE=no\n`, nothing on stderr, exit 0, `/dev/tty` never probed (also when `--auto-key` is absent).
4. Else: today's behavior, unchanged (TTY prompt; or exit 4 with `FALLBACK=chat` + `COMMAND=` lines).

`AUTO=true` is the only new stdout line and only appears right after `CHOICE=yes`.

Test hooks the spec relies on (already existing): `ARCANUM_TTY_DEVICE` (test-only TTY path), and the global tier path `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`. Local tier: `<repo>/.claude/state/arcanum-config.json`; repo tier: `<repo>/.claude/configuration/arcanum-repo-config.json`. Key shape in every tier: `{"next_step": {"auto": {"<skill>": true}}}`.

Documented keys (default `false`, chain local → repo → global): `next_step.auto.enhance-issue`, `next_step.auto.discuss-issue`, `next_step.auto.auto-plan-issue`.

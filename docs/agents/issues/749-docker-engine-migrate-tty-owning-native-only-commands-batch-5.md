# Issue: Docker engine: migrate TTY-owning native-only commands (batch 5)

## Description

Part of epic #724 (implement `engine.mode=docker`), batch 5 of the migration planned in #730. Credential class: **TTY-owning native-only** (`gh` credentials). Row details (`credentials`, `mounts`, `env`, `notes`) are in [`docs/agents/specs/docker/checklist.md`](../specs/docker/checklist.md).

Depends on #747 (batch 3).

Commands (2 rows):

- `arcanum-create-issue-start` (`arcanum-create-issue/scripts/start.sh`)
- `arcanum-create-issue-publish` (`arcanum-create-issue/scripts/publish.sh`)

## Problem

Both commands open `/dev/tty` through `core/lib/utils/io/TtyPrompt.js`, but [dispatch.md → TTY](../specs/docker/dispatch.md#tty) decides the container never has a TTY. Today they are still `native` in `arcanum/_lib/migration-status.json`, so under `engine.mode=docker` they run on the host with the "not docker-ready yet" warning.

Only the prompting paths need the TTY: `start` prompts only when drafts exist and neither `--new` nor `--resume <draft>` is given; `publish` prompts only when `--confirmed` (and, for `shipit`, `--shipit-confirmed`) is missing. With those flags, both run without a TTY, so under docker they work normally. Without them they take the exit-4 `FALLBACK=chat` path, and `arcanum-create-issue` already handles that with `AskUserQuestion` and calls the command again with the flags.

Both commands call GitHub: `start` runs `GithubPreflight`, and `publish` creates the issue and its labels.

The shim header comments still say native-only dispatch "errors out" under `engine.mode=docker`. That stopped being true once native-only commands became docker-routable (e.g. `arcanum-check-config`, #741).

## Expected Behavior

Per [testing.md → Ticking a checklist row](../specs/docker/testing.md#ticking-a-checklist-row), for both commands:

- the shim's `--needs`/`--path-arg` declarations match the row's `mounts`/`env` columns (`global-config:ro, gitconfig:ro`; `CLAUDE_CONFIG_DIR, GIT_CONFIG_GLOBAL, GH_TOKEN`);
- the shim-level routing spec has a `docker` callback;
- there is a parity case under `core/spec/docker/` (run with `make docker-parity`, platform reported in the PR), or a `notes` entry saying why there is none;
- in the same PR, the command flips to `"docker"` in `arcanum/_lib/migration-status.json` and its checklist row is ticked ✅ with `#749`.

Parity scope:

- Cover the paths that don't write to GitHub: invalid input (exit 2), a missing draft, and `start --new` / `start --resume <draft>`.
- Cover the no-TTY `FALLBACK=chat` path (exit 4) for both commands. Run the native side with no controlling terminal (e.g. `setsid`, stdin detached), so native and docker both take the fallback and must match.
- `publish`'s GitHub-writing success path gets no parity case. Its checklist `notes` entry says why: it would create a real issue.

Both shim header comments (`start.sh`, `publish.sh`) are updated. They drop "except engine.mode=docker, which errors out" and describe docker routing and the exit-4 fallback instead.

Under docker, a call that needs a prompt returns exit 4 with `FALLBACK=chat` (and, for `start`, its `DRAFT=` lines) unchanged. A call that passes the flags behaves exactly as it does natively.

### Out of scope

- The commands of the other batches (1–4).
- `host-only` rows (`arcanum-update-run-update-*`, `auto-fix-issue-run-checks`): they stay `n/a`.
- Scripts not routed through `engine_dispatch.sh`, such as `next_step_prompt.sh`: handled by #733.
- Changing `TtyPrompt` or the chat-fallback contract.

Owner: scripter (shims, routing specs, status/checklist) / node (parity cases).

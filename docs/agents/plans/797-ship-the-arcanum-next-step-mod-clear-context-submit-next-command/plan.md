# Plan: Ship the arcanum-next-step mod (clear context + submit next command)

Issue: [797-ship-the-arcanum-next-step-mod-clear-context-submit-next-command.md](../../issues/797-ship-the-arcanum-next-step-mod-clear-context-submit-next-command.md)

## Overview

Ship `arcanum-next-step/`, a Claude Code mod auto-loaded from the arcanum install,
registering one non-deferred tool `mcp__arcanum-next-step__handoff({ command })`.
On the main loop's normal turn end it runs `/clear` and then the allowlisted
arcanum skill command via `$.command.run`. Around it: a `--list` mode for the
release-zip builder plus a spec that the mod is packaged, a `make mod-check` gate and
a CircleCI job, and user docs. No skill calls the tool yet (#798).

**Dependency:** #800 (create the `mod` agent, roster and folder-structure rows) must
land first — the `mod` agent below does not exist until then.

## Agents involved

- [mod](mod.md) — the mod itself, its tests and its README.
- [scripter](scripter.md) — `scripts/build_release_zip.sh --list`.
- [node](node.md) — `core/spec` packaging spec.
- [infra](infra.md) — `make mod-check` and the CircleCI `mod-checks` job.

**Architect-owned docs (done by the architect during implementation):**

- Root `README.md`: a short section on the mod — what it is, that it ships and
  auto-loads with arcanum and is inert until a skill calls it (none does until #798),
  the custom-install-path caveat (no auto-load outside a skills folder), and a link to
  `arcanum-next-step/README.md`.
- `docs/agents/architecture/install-and-release.md` and the `scripts/` row of
  `docs/agents/folder-structure.md`: mention `build_release_zip.sh --list`.
- The `Makefile` row of `docs/agents/folder-structure.md`: mention `mod-check`.

## Shared contracts

**Mod folder layout** (produced by `mod`, consumed by `node`, `infra`):

```
arcanum-next-step/
  .claude-plugin/plugin.json      # name "arcanum-next-step", "types": "./types/index.d.ts"
  hooks/hooks.json                # { "modules": ["./register.ts"] }
  hooks/register.ts
  hooks/*.test.ts                 # claude plugin test suite
  types/index.d.ts                # $.state contract (pending handoff)
  tsconfig.json                   # extends ./.claude-plugin/types/tsconfig.json
  README.md
```

`arcanum-next-step/.claude-plugin/types/` is engine-generated and **never
committed**: add it to `.gitignore` (so it never reaches the `MANIFEST`).

**Tool contract** (produced by `mod`, consumed by #798):

- Full name `mcp__arcanum-next-step__handoff`, registered on `session.start`, not
  deferred. Input `{ command: string }` (required).
- Accepted: `/<skill>[ args]` where `<skill>` is a sibling folder of the mod's own
  folder containing `SKILL.md`; or `/loop /<skill>[ args]` with `<skill>` the same.
  Trim, split at the first whitespace run; args verbatim. `/clear` never accepted.
- Error results (exact text): `handoff only runs arcanum skills`;
  `a handoff is already pending: <command>`; `handoff is only available on the main
  loop` (call with `agentId`).
- Success result (exact text): `scheduled: will /clear then run <command> once this
  turn ends — end your turn now without further output`.
- Toasts: `arcanum-next-step: handoff cancelled` (aborted / refusal / error turn end,
  or a user prompt submitted while pending); `arcanum-next-step: <error> — run
  <command> manually` (a `command.run` failure).

**`build_release_zip.sh --list`** (produced by `scripter`, consumed by `node`):

- `scripts/build_release_zip.sh --list`: prints the would-be `MANIFEST` (the same
  filtered `git ls-files` paths, same order), one per line, nothing else on stdout;
  exit 0. Creates no zip, no output directory, no `MANIFEST` file.
- Without `--list`, behavior is byte-identical to today.

**`make mod-check`** (produced by `infra`, used by `mod` as its gate): runs, for
`arcanum-next-step`, `claude plugin validate`, `tsc -p` and `claude plugin test`;
fails on the first failure.

## CI Checks

- `core`: `make core-check` (CI jobs: `test` → `yarn test`, `checks` → `yarn lint`).
- `arcanum-next-step`: `make mod-check` (CI job: `mod-checks`, new).

## Notes

- Manual checks (record results in the PR description):
  - codeword test through the tool path, using `/arcanum-check-config next_step.auto`;
  - whether a `handoff` call raises the permission prompt in the default permission
    mode (feeds #798's conditional grant migration);
  - headless `claude -p` behavior; two installs loading the mod; a fresh
    `curl | bash` install auto-loads it.
- `.circleci/` is not yet in `infra`'s scope (#775 adds it). If #775 has not landed,
  the architect makes the CircleCI change instead.
- Found while planning: #801 (`render_issue` expands `$` patterns) — unrelated,
  not in this scope.

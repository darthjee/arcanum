# Plan: Enhance spec: already-installed.md (CLI install)

Issue: [865-enhance-spec-already-installed-md-cli-install.md](../../issues/865-enhance-spec-already-installed-md-cli-install.md)

## Overview

Turn `docs/agents/specs/cli-install/already-installed.md` from its skeleton into a complete spec for what the shared client-install script does when `arcanum-cli` is already installed, then sync the index, `install.md` and `update.md` with the decisions it introduces. Docs only; owned by the architect.

## Context

Part of epic #861. #862 wrote the spec skeleton; #863 and #864 completed `install.md` and `update.md` (both merged). The issue's Solution section holds every decision, settled in the enhance dialogue:

- Detection only through `npm ls -g --json --depth=0 arcanum-cli`, parsed from its JSON (never its exit code) by a `node -e` wrapper with a ~15 s `spawnSync` timeout.
- Semver precedence comparison in the same wrapper, which prints `CLI_STATE=missing|older|same|newer|linked|unknown` and `CLI_INSTALLED=<v>`.
- `unknown` (timeout, unreadable output, no `version`, unparseable version) → warn and skip; `linked` (`npm link` dev checkout) → info, left as is.
- Detection runs after the Node/npm check and before `npm view`; same/newer/linked need no network call and no prompt.
- Foreign `arcanum` on `PATH`: a warning after the step only; `EEXIST` falls into the existing failure row, never `--force`.
- Update prompt names `current → target`; `/arcanum-update` fallback gains `CLI_INSTALLED=<v>`.
- `--no-confirm` only answers the prompt; it never bypasses detection. The `install-cli` resume re-detects.

## Implementation Steps

### Step 1 — Complete `already-installed.md`

Rewrite `docs/agents/specs/cli-install/already-installed.md`, keeping its intro line and Purpose, following the section shape of the completed `install.md` and `update.md`:

- **Decisions:** keep the three existing ones (older → update in place, same → no-op, newer → leave); add detection (single source, JSON parsing, unknown → warn and skip, no `arcanum --version`), version comparison (semver precedence rules, prerelease target with release installed → newer), the `linked` state, the foreign-binary `PATH` check (when it runs, how directories are compared with `cd -P … && pwd -P`, the three cases, `EEXIST` without `--force`), and the per-caller behavior (one shared script; `--no-confirm` never bypasses detection; the resume re-detects; installer not special-cased).
- **Flow:** the nine-step client-step order from the issue's "Flow placement & performance" section, with the detection branch outcomes, and the note that detection stays after the TTY check.
- **Outcomes:** the issue's outcomes table (Updated, Unchanged, Newer kept, Linked, Unknown, Declined (update), Update failed, `PATH` warning), all exit `0`, one stderr line each, exact wording left to #868.
- **Callers:** the per-caller table from the issue.
- **Edge cases:** the issue's edge-case table.
- **Names:** `CLI_STATE` (wrapper output, its six values), `CLI_INSTALLED` (wrapper output and exit-`4` stdout key).
- **Testing strategy:** the issue's bats list for #868 (stub `npm`, one test per state, no-network assertions, `--no-confirm` no-downgrade, `PATH` tests, table-driven semver test, shortened-timeout env seam).
- **Alternatives considered:** keep auto-downgrade; add `arcanum --version`, unknown-as-missing, `npm ls` exit code, running the foreign binary, refusing on a foreign binary, `--force` on `EEXIST`, `sort -V`, equality-only, comparing a linked checkout's version.
- **Open points:** "None left."

### Step 2 — Sync the index, `install.md` and `update.md`

- `docs/agents/specs/cli-install.md`:
  - Shared rules, **Consent only by argument**: add that `--no-confirm` only answers the prompt and never bypasses detection (never downgrades, leaves `linked` alone, skips `unknown`).
  - Shared rules, **Skipped paths cost nothing**: state the order — the local installed-version check runs before `npm view`, so an unchanged, newer or linked client costs one local `npm ls` and no network call.
  - Parts table row for `already-installed.md`: mention detection, the `linked` state and the foreign-binary warning.
- `docs/agents/specs/cli-install/install.md`:
  - Flow step 5: move "If the client is already installed, follow already-installed.md" before the `npm view` check (detect → `npm view` → prompt → install), and add the final `PATH` check step; update the "order of 5.3 to 5.6 is a proposal" note so detection-before-`npm view` is fixed by already-installed.md.
  - Outcomes "Client already installed" row: keep the pointer; optionally list the states it covers.
- `docs/agents/specs/cli-install/update.md`:
  - `/arcanum-update` Flow step 2 and the Outcomes row for exit `4`: add `CLI_INSTALLED=<v>` when a client is installed; the "nothing to do" row also covers unchanged/newer/linked/unknown.
  - Names: extend the `FALLBACK=chat`, `CLI_VERSION=<v>` row with `CLI_INSTALLED=<v>` (printed only when a client is installed; additive, old skills ignore it).
  - Global migration Flow step 4 / Outcomes: note that `--no-confirm` keeps the already-installed rules.
- Check every relative link and anchor touched (e.g. `already-installed.md#…` anchors cited from `install.md`/`update.md`) resolves.

## Files to Change

- `docs/agents/specs/cli-install/already-installed.md` — completed spec part (Step 1).
- `docs/agents/specs/cli-install.md` — shared-rule wording and Parts row (Step 2).
- `docs/agents/specs/cli-install/install.md` — flow order, `PATH` check step, outcome pointer (Step 2).
- `docs/agents/specs/cli-install/update.md` — `CLI_INSTALLED=` in the fallback contract and Names, migration note (Step 2).

## Notes

- Docs only: no scripts (#868), no skill changes (#870), no migration file (#872), no core/CLI code, no change to `docs/agents/architecture/install-and-release.md`.
- Keep citing the migration as `next/001` (no `repos/` prefix), per the index's Migration section, so `scripts/bump-version.sh` does not abort.
- Exact prompt and warning wording stays open for #868 (the index's remaining open point); the spec fixes only each line's content.
- Keep the Shared rules referenced, not repeated, in the part.

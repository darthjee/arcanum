# Plan: Add Claude skill to invoke the arcanum update script

Issue: [117-add-claude-skill-to-invoke-the-arcanum-update-script.md](../issues/117-add-claude-skill-to-invoke-the-arcanum-update-script.md)

## Overview

Adds a new `arcanum-update` skill (`/arcanum-update`) that runs `arcanum/update/bootstrap.sh` from inside a Claude Code session, gated by an explicit chat-level trust confirmation. Getting there also means hardening `arcanum/update/bootstrap.sh`/`updater.sh` (and, for symmetry, `arcanum/install/bootstrap.sh`) with a script-level confirmation prompt, working-directory preservation, git-clone install support, and a concurrency guard — all motivated by the skill giving people a much lower-friction way to trigger these scripts than typing a `curl | bash` line by hand.

Single-file plan (`AGENT_SPLIT=false`): `scripter` is the only implementation specialist configured in this repo (`architect` is the coordinator, `skill-reviewer` is read-only), so there's no benefit to a per-agent split. Ownership is still called out per step below so implementation knows what to delegate.

## Context

Follow-up to #116, which delivered `arcanum/update/bootstrap.sh` + `arcanum/update/updater.sh` but deliberately left the Claude-Code-facing wrapper for later. The full design (naming, confirmation model, git-clone support, locking, edge cases) was already worked out in the issue's `enhance-issue`/`discuss-issue` dialogue — this plan translates that into concrete file changes, it does not re-derive the design.

## Implementation Steps

### Step 1 — Layer 2 confirmation in both `bootstrap.sh` scripts (owner: `scripter`)

In `arcanum/update/bootstrap.sh` and `arcanum/install/bootstrap.sh`: right after `REPO`/`VERSION` are resolved and the download URL is built (before the `curl` call), print the resolved repo/version/URL and require an explicit y/N via `read -r ... < /dev/tty`, mirroring the existing target-directory confirmation pattern already in `installer.sh`/`updater.sh`. Skip the prompt entirely when `ARCANUM_ASSUME_YES` is set in the environment (any non-empty value). Document `ARCANUM_ASSUME_YES` in each script's header comment, alongside the existing `ARCANUM_REPO`/`ARCANUM_VERSION`/`ARCANUM_TARGET` docs.

### Step 2 — Preserve caller's working directory (owner: `scripter`)

In `arcanum/update/bootstrap.sh`: capture `ORIG_PWD="$(pwd)"` up front, `export` it alongside `REPO`/`VERSION`/`TARGET` before the final `exec "${WORK_DIR}/arcanum/update/updater.sh"`.

In `arcanum/update/updater.sh`: extend the existing `trap 'rm -rf "$WORK_DIR"' EXIT` to also `cd "$ORIG_PWD" 2>/dev/null || true` first (safe no-op if `ORIG_PWD` is unset, e.g. `updater.sh` invoked directly).

### Step 3 — Git-clone install detection and update path (owner: `scripter`)

In `arcanum/update/bootstrap.sh`, extend the existing `TARGET`/`REPO` resolution block:

- **Detection:** at the candidate target, `arcanum.json` present → existing zip flow, unchanged. `arcanum.json` absent but `.git` present → git flow (new, below). Neither present → unchanged fallback (empty `TARGET`, `updater.sh` prompts/errors as today).
- **REPO default for a git install:** parse owner/repo out of `git -C "$TARGET" remote get-url origin`, used the same way `arcanum.json`'s `.repo` field is used for the zip flow.
- **VERSION resolution is shared, unchanged:** `ARCANUM_VERSION` if set, else the existing "latest published GitHub release" API call. No separate default for the git path.
- **No-op check before touching the network:** compare the resolved `VERSION` to the target's current tag/ref (`git -C "$TARGET" describe --tags --exact-match` or equivalent). Already there → report up to date, skip `fetch`/`checkout` and the network call entirely.
- **Uncommitted-changes guard:** `git -C "$TARGET" status --porcelain` — any output → fail immediately with a message telling the user to commit/stash/discard first. No auto-stash, no auto-discard.
- **Update:** `git -C "$TARGET" fetch --tags --prune && git -C "$TARGET" checkout "$VERSION"` (detached HEAD on the resolved tag).
- **Confirmation copy (feeds Step 1's prompt for this path):** state the method explicitly — "running `git fetch`/`git checkout <version>` in `<target>` (currently on `<branch-or-commit>`) from remote `<repo>`" — since this is a bigger behavior change (detached HEAD) than the zip path.
- **Skips `updater.sh` entirely** for this path — `bootstrap.sh` runs the git commands directly against `TARGET` and exits.

### Step 4 — Concurrency lock on the zip path (owner: `scripter`)

In `arcanum/update/updater.sh` only (the git path in Step 3 doesn't need this — `git checkout`'s own `.git/index.lock`/`.git/HEAD.lock` already makes a second concurrent invocation fail cleanly). Right after confirming `arcanum.json` exists at `TARGET`:

- Acquire `mkdir "${TARGET}/.arcanum-update.lock"`. If it fails (already exists), print "An update is already running for this install. If you're sure this is stale from a crashed run, remove `<lockdir>` and retry." and exit nonzero.
- Extend the existing EXIT trap (already handling `WORK_DIR` cleanup and, after Step 2, the `ORIG_PWD` restore) to also `rmdir "$LOCK_DIR" 2>/dev/null || true`.
- Deliberately a separate lock directory, not a field written into `arcanum.json` — see the issue's "Concurrent invocations" section for why (atomicity, and not disturbing `arcanum.json`'s write-last-for-safe-retry invariant).

### Step 5 — `arcanum-update/scripts/run_update.sh` (owner: `scripter`)

New script, two subcommands, invoked by the skill (Step 6):

- **`run_update.sh check`** — resolves install method/repo/current version the same way `bootstrap.sh` now does (read `arcanum.json` if present, else `git remote`/current ref), relative to this script's own location (`<script_dir>/../../arcanum/update/bootstrap.sh`). Prints, one per line: `METHOD=zip|git`, `REPO=<repo>`, `CURRENT=<version-or-ref>`, `TARGET=<path>`. If `arcanum/update/bootstrap.sh` doesn't exist at the expected relative path (edge case: partial/manual install missing the `arcanum/` folder), prints `STATUS=missing_arcanum` instead and exits nonzero — this is what backs the "Could not find `arcanum/update/bootstrap.sh` next to this skill" message.
- **`run_update.sh apply`** — exports `ARCANUM_ASSUME_YES=1`, runs `../arcanum/update/bootstrap.sh`, streaming its stdout/stderr live (not captured/suppressed), then re-resolves the current version/ref and prints a final summary line: `RESULT=updated FROM=<old> TO=<new>`, `RESULT=noop VERSION=<v>`, or relies on the script's own nonzero exit for the error case (no `RESULT=` line needed then — the skill relays the already-streamed error output).

Both subcommands need `jq` (already a hard dependency of the existing zip-flow scripts) for the zip-path case; the git-path case needs no new dependency beyond `git` itself.

### Step 6 — `arcanum-update/SKILL.md` (owner: `architect`)

New skill, single file (no auxiliary step files — the deterministic work lives in `run_update.sh`):

1. Run `scripts/run_update.sh check`. On `STATUS=missing_arcanum`, report the "install may be incomplete or non-standard" message and stop.
2. Present the Layer 1 confirmation in conversation, naming the repo, target, and method (zip download vs. git fetch+checkout) from the `check` output. Wait for explicit yes.
3. On decline: acknowledge and stop, no error, nothing was touched.
4. On confirmation: run `scripts/run_update.sh apply`, relaying its streamed output live.
5. On success (`RESULT=updated`): report the version change and the session-restart reminder ("Start a new Claude Code session to pick up new or renamed skills").
6. On success (`RESULT=noop`): report already up to date, no restart reminder.
7. On nonzero exit: relay the script's error output verbatim, note the operation is safely retryable, no auto-retry.

Frontmatter: `name: arcanum-update`, description summarizing the above, per this repo's `SKILL.md` convention.

### Step 7 — Documentation updates (owner: `architect`)

- `README.md`: add `ARCANUM_ASSUME_YES` next to the existing `ARCANUM_REPO`/`ARCANUM_VERSION`/`ARCANUM_TARGET` docs in both the "Installation" and "Updating" sections ("set to skip the trust-confirmation prompt, e.g. for unattended/CI use"). Reword the "Updating" section's current claim that git-clone installs need "no separate update script" — false after Step 3 ships; git-clone installs now have a real `bootstrap.sh` path, manual `git pull` remains valid too. Add `/arcanum-update` to the "Available skills" table.
- `docs/agents/architecture.md`: the existing "Update" subsection (in Portuguese — match that, don't switch languages) describes `bootstrap.sh`/`updater.sh` in enough detail that it goes stale after Steps 1–4. Update it to mention: the Layer 2 confirmation prompt and `ARCANUM_ASSUME_YES` bypass, `ORIG_PWD` preservation, the git-clone detection/update branch, and the `mkdir`-based concurrency lock (zip path only).

## Files to Change

- `arcanum/update/bootstrap.sh` — Layer 2 confirmation, `ORIG_PWD` export, git-clone detection/update branch.
- `arcanum/update/updater.sh` — `ORIG_PWD` restore in the EXIT trap, concurrency lock.
- `arcanum/install/bootstrap.sh` — Layer 2 confirmation (mirrors `arcanum/update/bootstrap.sh`'s, no `ORIG_PWD`/git-clone changes needed here since install has no equivalent use case).
- `arcanum-update/SKILL.md` — new.
- `arcanum-update/scripts/run_update.sh` — new.
- `README.md` — `ARCANUM_ASSUME_YES` docs, reworded "Updating" section, new skill table row.
- `docs/agents/architecture.md` — update the "Update" subsection to match the new script behavior.

## Notes

- Whether `read ... < /dev/tty` inside `bootstrap.sh` actually gets a real interactive terminal when the *script itself* is invoked directly by a human (the only way this has been exercised before) is not in question; what's unverified is that `arcanum-update/scripts/run_update.sh apply` (running under Claude Code's Bash tool) reliably gets `ARCANUM_ASSUME_YES` recognized and skips that prompt without ever hitting it — worth an explicit manual smoke test of `/arcanum-update` after implementation, not just unit-level script testing.
- No changes needed to `scripts/build_release_zip.sh` — it packages every `git ls-files`-tracked path except a fixed exclude list that doesn't include skill folders, so `arcanum-update/` ships automatically once committed.
- `arcanum/update/bootstrap.sh`/`arcanum/install/bootstrap.sh` don't live under a `<skill-name>/scripts/` folder, so they're not a literal fit for `scripter`'s documented scope — assigned to `scripter` anyway here since they're plain bash and match its stack; flag this ownership boundary to the architect agent roster if it comes up again on a future issue.

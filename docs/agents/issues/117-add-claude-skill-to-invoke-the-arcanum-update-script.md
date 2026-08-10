# Issue: Add Claude skill to invoke the arcanum update script

## Description

Follow-up to #116 (which added `arcanum/update/bootstrap.sh` + `arcanum/update/updater.sh`). Adds an `arcanum-update` Claude Code skill (`/arcanum-update`) that invokes the update from inside a session, instead of requiring a shell. Also extends the underlying update scripts — and, for symmetry, `arcanum/install/bootstrap.sh` — with what the skill's new calling context requires: an explicit trust confirmation before running downloaded/executed code, working-directory preservation across the call, and support for git-clone-based installs (currently a dead end for updates).

Deliberately scoped out of #116: the skill wrapper was meant to come after the underlying update script existed and was proven out, not before.

## Problem

- There's currently no way to update an arcanum install from within Claude Code itself — only from a shell.
- Git-clone installs (no `arcanum.json`) have no update path at all today: `updater.sh` hard-requires `arcanum.json` and errors out otherwise.
- Invoking an update script from inside an agentic session raises concerns a plain shell invocation doesn't: the user should see what's about to run (and from which repo) before it runs, since this is arbitrary remote code execution; the invoking shell's working directory needs to survive the call; and a live update overwriting the running session's own skill files needs to be communicated, not silently left stale.

## Expected Behavior

When the user runs `/arcanum-update`:

1. The skill reads the target install's current repo/version (from `arcanum.json` for a zip-tracked install, or from the git remote/current ref for a git-clone install) and asks for explicit confirmation in conversation — naming the repo and which update method will run (downloading a release zip vs. `git fetch`/`git checkout`) — before doing anything.
2. On confirmation, it runs `arcanum/update/bootstrap.sh` (resolved relative to its own on-disk location), streaming the script's own progress output rather than hiding it behind a summary.
3. On success, it reports whether anything actually changed (vs. "already up to date," a clean no-op) and, only if something did change, reminds the user to start a new Claude Code session to pick up new or renamed skills.
4. On failure, it relays the script's own error message verbatim and notes the operation is safely retryable — no auto-retry, no silent fallback to a different repo/version.
5. If the user declines the confirmation, the skill stops cleanly — nothing was touched, no error.

Run directly from a shell (no skill involved), both `bootstrap.sh` scripts behave equivalently, now with their own built-in confirmation prompt (bypassable via `ARCANUM_ASSUME_YES=1` for unattended/CI use).

## Solution

### Naming/invocation

- Name: `arcanum-update` (not `update-arcanum`). Deliberately deviates from this repo's usual `<verb>-issue` pattern (`enhance-issue`, `discuss-issue`, `plan-issue`, ...): `arcanum-<something>` establishes a namespace prefix for skills that manage arcanum itself (meta/self-management), as opposed to skills that operate on a target project's issues. Future arcanum-meta skills should follow the same `arcanum-<something>` prefix.
- Skill folder: `arcanum-update/` at repo root, sibling to the other skills (e.g. `toggle-clear-context/`) — not nested under `arcanum/` (that folder is the shipped script payload, not a skill).
- Invocation: `/arcanum-update`, no arguments — matches `bootstrap.sh`'s own no-args contract.

### What the skill does under the hood

- The new skill invokes `arcanum/update/bootstrap.sh` via a **relative path** from the skill's own on-disk location within the install (e.g. `../arcanum/update/bootstrap.sh`), not an absolute path or a `curl | bash`. `bootstrap.sh` already auto-detects `TARGET` from its own on-disk location (falls back to `arcanum.json` next to it), so invoking it this way gets correct target resolution for free — no `ARCANUM_TARGET`/`ARCANUM_REPO`/`ARCANUM_VERSION` env vars need to be set by the skill in the common case. (`arcanum/update/bootstrap.sh` is meant to ship inside the installed target: `installer.sh`'s own error message points to `${TARGET}/arcanum/update/bootstrap.sh`.)
- `bootstrap.sh` already avoids the self-overwrite problem on its own — it downloads the new release into a temp dir and `exec`s `updater.sh` from there, never from the live install being overwritten. No special handling needed on the skill side for that.

#### Session reload after update

Updating overwrites the installed skills directory (`TARGET`, e.g. `~/.claude/skills`) live, out from under the running Claude Code session. Two things can go stale:
- Skill *body* content (`SKILL.md`/step files) — read fresh from disk per invocation, so this self-heals immediately, no action needed.
- The skill *catalog* (names + descriptions listed at session start) — likely computed once per session; a newly added, renamed, or removed skill may not show up until a new session starts. Not something the skill can verify or force from inside itself (no tool to restart the host).

Decision: no automated/forced restart (not possible). After a successful update, the skill prints an explicit reminder, e.g. "Update complete (`vX` → `vY`). Start a new Claude Code session to pick up new or renamed skills."

#### Preserve caller's working directory

Motivated by this new use case: unlike the original one-off `curl | bash` usage, invoking the update from inside a long-lived interactive session (the Bash tool's persistent shell) means the caller's cwd matters afterward. Neither script currently changes the caller's cwd (every `cd` today happens inside a `$(...)` subshell), so this is a defensive guarantee for the new caller, not a bug fix. Concretely:
- `bootstrap.sh`: capture `ORIG_PWD="$(pwd)"` up front, `export` it alongside `REPO`/`VERSION`/`TARGET` before the final `exec` (which replaces the process, so bootstrap.sh itself can't restore cwd after that point).
- `updater.sh`: extend the existing `trap 'rm -rf "$WORK_DIR"' EXIT` to also `cd "$ORIG_PWD" 2>/dev/null || true` first, so it restores cwd on both success and failure paths, with a safe no-op fallback if `ORIG_PWD` is unset (e.g. `updater.sh` run directly) or no longer resolvable.

This touches `arcanum/update/bootstrap.sh`/`updater.sh` (delivered by #116), not just the new skill wrapper — kept in scope of #117 since it's directly motivated by this issue's new calling context.

#### Git-clone install support

`updater.sh` currently hard-requires `arcanum.json` and errors out otherwise — meaning a `git clone` install (the README's documented Option 2) is a dead end for the skill (and for `bootstrap.sh` as it stands today). Brought into scope: `bootstrap.sh` detects the install method early, right where it resolves `TARGET`/`REPO` today, and branches before doing anything else:

- **Detection:** at the candidate target, `arcanum.json` present → zip-tracked install (existing behavior, unchanged). `arcanum.json` absent but `.git` present → git-tracked install, handled entirely differently below. Neither present → unresolved, same as today (falls through to the existing interactive/env-var `TARGET` handling).
- **REPO default for a git install:** parsed from `git remote get-url origin` (owner/repo) instead of `arcanum.json`'s `.repo` field — same question, answered from git's own metadata instead of ours.
- **VERSION resolution is unchanged and shared** with the zip flow: `ARCANUM_VERSION` if set, else the latest published GitHub release (same API call `bootstrap.sh` already makes). No separate "default to `git pull` on whatever branch" mode — a git install's default update target is the same latest-release tag a zip install would get, just applied via git instead of a zip extract.
- **Update mechanism:** `git fetch --tags --prune && git checkout <VERSION>` in `TARGET`, always (whether `VERSION` came from an explicit override or the default resolution) — no plain `git pull`. This lands the install in detached HEAD on the resolved tag; `--tags` guarantees the tag is fetched even if it's brand new (plain `--prune`/`-p` alone isn't guaranteed to fetch new tags depending on `tagOpt`).
- **Skips the zip path entirely:** for a git install there's no reason to download/unzip a release zip at all — `bootstrap.sh` runs the git commands directly against `TARGET` and exits; `updater.sh` isn't invoked.
- **Uncommitted-changes guard:** before doing anything, check `git status --porcelain` in `TARGET`. Any dirty output → fail immediately with a message telling the user to commit/stash/discard their local changes first. No auto-stash, no auto-discard, no checkout over uncommitted work — the user resolves it, then re-runs.
- **Confirmation copy reflects the method:** both the skill-level and script-level confirmations (below) need to say *which* update path will run — "downloading a release zip from `<repo>`" vs. "running `git fetch`/`git checkout <version>` in `<target>` (currently on `<branch-or-commit>`) from remote `<repo>`" — since the git path is a bigger behavior change (detached HEAD) that the user should see coming.

### User confirmation before running

Two layers, not one — a chat-level confirmation from the skill isn't enough on its own, since it only protects people who go through the skill:

**Layer 1 — skill-level (chat) confirmation, before it runs anything.** The skill reads `.repo`/`.version` directly out of the target's `arcanum.json` (a single `jq` read — not duplicating `bootstrap.sh`'s full resolution cascade; git-aware fallback to `git remote`/current ref when there's no `arcanum.json`) and explicitly tells the user, in conversation: "This will download and execute a release zip from `<repo>`, applying it over your install at `<target>`. That means running shell code from that repo — make sure you trust it, especially if it's a fork. Proceed?" Only invokes the Bash call after an explicit yes; stops otherwise.

**Layer 2 — a confirmation baked into `bootstrap.sh` itself** (both `arcanum/update/bootstrap.sh` and `arcanum/install/bootstrap.sh` — folded into #117's scope even though the install side isn't strictly required by this issue's deliverable, since it's the same code shape and closes an equivalent gap). Right after `REPO`/`VERSION` are resolved and the download URL is built (before the `curl` call), print the resolved repo/version/URL and require an explicit y/N via `/dev/tty`, mirroring the existing target-directory confirmation pattern in `installer.sh`/`updater.sh`. This is what protects direct `curl | bash` / plain-shell users regardless of whether the skill is ever used.

**Bypass for the skill's own invocation:** it's unconfirmed whether a `read ... < /dev/tty` inside a script actually gets an interactive terminal when run through Claude Code's Bash tool (as opposed to a human's own shell, the only way these scripts have been exercised so far) — if not, Layer 2's prompt could hang the skill's Bash call indefinitely. To avoid depending on that: after Layer 1 confirms, the skill sets `ARCANUM_ASSUME_YES=1`, and both `bootstrap.sh` scripts skip their own Layer-2 prompt when it's set — same shape as the existing `TARGET` pre-resolution bypass. Document/demonstrate `ARCANUM_ASSUME_YES` only as a one-off command prefix (`ARCANUM_ASSUME_YES=1 bash bootstrap.sh`), never as something to export permanently — exporting it would silently kill the trust check forever, including the one time it'd actually matter.

### Output/errors surfaced back through the skill

- **Show, don't swallow.** `bootstrap.sh`/`updater.sh` already write clear progress/error messages to stderr ("Downloading arcanum X from Y...", "Error: failed to download...", "Error: no arcanum install found... run the install script instead", etc.). The skill streams that output to the user as it runs rather than hiding it behind a distilled summary — consistent with the transparency goal behind the confirmation step.
- **Detect "updated" vs "already up to date" via `arcanum.json`, not text parsing.** Both are exit-0 today (`updater.sh`'s no-op path is `echo "Already on ${VERSION}." >&2; exit 0`), and stderr wording could drift, so string-matching would be fragile. Instead: read `.version` from `arcanum.json` before running and again after (same `jq` read Layer 1 already does). Changed → update succeeded, show the success message plus the session-restart reminder. Unchanged → already up to date, skip the restart reminder — nothing changed, no reason to restart. Git installs need the equivalent: compare the current ref to the resolved `VERSION` *before* touching the network, so an already-up-to-date git install skips `fetch`/`checkout` entirely rather than running it and diffing after the fact.
- **On nonzero exit: stop, relay the script's error verbatim, no retry.** The scripts already fail with actionable guidance built in (wrong repo/version, no `arcanum.json` at target, etc.); the skill doesn't add cleverness on top — no auto-retry, no silently falling back to a different repo/version, since that could mask a real config problem (e.g. a wrong `ARCANUM_REPO`). Interrupted/partial updates are safely retryable — `updater.sh` writes `arcanum.json` last specifically so a partial failure (network drop, user cancels) leaves the old `arcanum.json` untouched — and the skill's error relay should say so explicitly ("safe to just run `/arcanum-update` again") rather than reading as something now broken.
- **Mechanically:** the whole flow (read version before → run script, streaming output → read version after → decide messaging) is deterministic, so it belongs in `arcanum-update/scripts/run_update.sh`, per this repo's convention of extracting logic out of `SKILL.md` prose into scripts. `SKILL.md` itself stays focused on the Layer-1 confirmation dialogue and relaying the script's final result.

### Concurrent invocations against the same target

Only a real risk on the zip path: `cp -R` plus the manifest-diff deletes plus writing `arcanum.json` are all unguarded today, so two concurrent runs could genuinely interleave into a corrupted, mixed-version install. The skill lowers the friction that makes this more likely than it used to be (two Claude Code sessions/tabs against the same install, vs. needing two manually-typed `curl | bash` terminals before). The git path doesn't need the same treatment — `git checkout` already takes `.git/index.lock`/`.git/HEAD.lock` internally, so a second concurrent invocation just fails cleanly ("Unable to create '.git/index.lock': File exists"), the same outcome a custom lock would produce anyway, for free.

- **Fix, zip path only:** `updater.sh` acquires `mkdir "${TARGET}/.arcanum-update.lock"` right after confirming `arcanum.json` exists (atomic — either the `mkdir` succeeds or it doesn't, no read-modify-write race window). If it already exists, fail fast: "An update is already running for this install. If you're sure this is stale from a crashed run, remove `<lockdir>` and retry." Release via the existing `trap '...; rm -rf "$WORK_DIR"' EXIT`, extended to also `rmdir` the lock dir.
- **Deliberately a separate lock directory, not a field inside `arcanum.json`:** a JSON flag can't be toggled atomically (read → parse → modify → serialize → write has a race window a plain `mkdir` doesn't), and mutating `arcanum.json` earlier than its current single write-at-the-end would reintroduce the exact partial-failure risk that "write it last" was designed to avoid. Keeping the lock as its own directory keeps `arcanum.json` exactly as designed, and stale-lock recovery is just "delete this directory," not "hand-edit JSON."

### Scope boundaries

**In scope for #117:**
- New `arcanum-update/` skill (`SKILL.md` + `scripts/run_update.sh`) at repo root, `/arcanum-update`, no args.
- Layer 1 + Layer 2 confirmation (method-aware — zip vs. git), added to **both** `arcanum/update/bootstrap.sh` and `arcanum/install/bootstrap.sh`.
- `ORIG_PWD` capture/restore in `arcanum/update/bootstrap.sh` + `updater.sh`.
- Git-clone install detection and update path in `arcanum/update/bootstrap.sh`.
- Session-restart reminder messaging, output streaming, and updated/no-op/error detection via `arcanum.json` version diffing (zip) and current-ref diffing (git).
- Concurrency lock for the zip update path.

**Explicitly out of scope:**
- No `arcanum-install` skill — this issue only wraps *update*. Install still only happens via `curl | bash` or `git clone` directly, no Claude Code skill for it. Natural symmetric follow-up, separate issue.
- No multi-install picker — the skill only ever targets the install it physically lives inside (resolved via its own relative path).
- No first-class way to pin a different `ARCANUM_REPO`/`ARCANUM_VERSION` (e.g. testing a fork) through the skill itself — still only settable by exporting env vars before invoking. No flags/args added to the skill.
- No automated/forced session restart, no auto-retry on failure.
- No changes to the release-build/MANIFEST pipeline (`.circleci`, `scripts/bump-version.sh`, etc.).
- No handling of a git remote not named `origin`, or a target that's already in detached HEAD before the update runs.

### Backward compatibility

- **Breaking: Layer 2's confirmation prompt changes the default behavior of unattended `curl | bash` installs/updates.** Today that one-liner runs with zero interactive prompts as long as `TARGET`/`REPO`/`VERSION` resolve. After this change, unattended callers (dotfiles, CI, a Docker image build) hang or fail (no tty) unless they also set `ARCANUM_ASSUME_YES=1`. Intentional, but a real compat break worth calling out in release notes.
- **Fix:** document `ARCANUM_ASSUME_YES` in the README right alongside the existing `ARCANUM_REPO`/`ARCANUM_VERSION`/`ARCANUM_TARGET` env vars (both the "Installation" and "Updating" sections).
- **README's "Updating" section also goes stale otherwise:** it currently says git-clone installs need "no separate update script" — true today, false after this ships. Needs rewording as part of this issue's deliverable (git-clone installs now have a real `bootstrap.sh` path; manual `git pull` remains valid too, just no longer the *only* option).
- Everything else is additive/non-breaking: `ORIG_PWD` restore only makes an already-true guarantee explicit; git-clone detection only activates where `arcanum.json` is absent, so existing zip-tracked installs are unaffected.

### Performance & security considerations

- The core risk (downloading/executing remote code) is inherent to what an updater does; the two-layer confirmation showing the resolved repo URL before anything runs is the accepted mitigation.
- `git checkout` can trigger local git hooks if the target's `.git/hooks` has active (non-`.sample`) hooks — not addressed here, since hooks aren't part of what's fetched from the remote.
- No checksum/signature verification of the downloaded zip — deliberately not addressed by this issue.
- Performance is a non-issue, arguably a slight win: the git-clone path skips the zip download/unzip entirely, and `arcanum-update` is manually-invoked and confirmation-gated (not autonomous), so call frequency against GitHub's unauthenticated API rate limit stays low in practice.

### Edge cases

- Manual/partial install missing `arcanum/` next to `arcanum-update/` (e.g. someone hand-copied just the skill folder): the skill checks for this and gives a specific message — "Could not find `arcanum/update/bootstrap.sh` next to this skill — this install may be incomplete or non-standard" — instead of a raw "No such file or directory."
- User declines the Layer 1 confirmation: a clean no-op, acknowledge and stop, not an error state.

## Benefits

- No context-switch to a shell just to keep an arcanum install current — `/arcanum-update` handles it from inside the session.
- Establishes an `arcanum-<something>` namespace for future arcanum self-management skills (e.g. a future `arcanum-install`).
- Closes a real gap for git-clone installs, which currently have no update path at all.
- The trust-confirmation and working-directory fixes benefit every caller of `bootstrap.sh`, not just the skill — direct `curl | bash` users get the same protection.
- Fixes a latent unguarded-concurrency risk in the zip update path along the way.

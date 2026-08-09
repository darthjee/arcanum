# Issue: Add update script

## Description

Adds an `update` script for arcanum installs, complementing the `install` script added in #114 / PR #115 (commit 7941a69). `install` can only perform a fresh install today; there is no way to bring an existing install up to date with a newer release.

## Problem

`installer.sh` refuses outright when `arcanum.version` already exists at the target ("This script does not support updates yet — remove the existing install manually first"). There is no way to add new files, overwrite changed ones, or remove files that were dropped between releases — a user must manually delete and reinstall to pick up any new release.

## Expected Behavior

- Running the update script fetches the desired arcanum release and reconciles the target install: adds new files, overwrites changed files, and deletes files no longer part of the release — without touching anything else in the target directory.
- Works with zero flags in the common case (running the copy already sitting inside an existing install). Explicit overrides are available via env vars for the fresh `curl | bash` case.
- Defaults to the latest published release when no version is specified, and to the same repo (including forks) the install originally came from.
- `installer.sh` redirects users to `update` instead of refusing outright when an install already exists.

## Solution

### Script location

Mirrors `arcanum/install/`'s structure and reasoning: `arcanum/update/bootstrap.sh` (tiny curl|bash entry point, fetches the release zip fresh and hands off) + `arcanum/update/updater.sh` (the real update logic, bundled inside the release zip like `installer.sh` is today).

Because the whole `arcanum/` folder passes through untouched into every release zip and every installed copy (see `scripts/build_release_zip.sh`'s excludes list), this ships in every install "for free" and can be invoked two ways:
- `curl -fsSL .../arcanum/update/bootstrap.sh | bash` — no local checkout needed, always fetches the newest bootstrap logic.
- Directly from an existing install: `bash <install-dir>/arcanum/update/bootstrap.sh` — same script, already on disk.

The two-stage split (rather than a single `update.sh`) exists so a bug fixed in the updater logic itself reaches users immediately — the bootstrap stage always re-fetches the newest release rather than running whatever updater logic happened to ship with the currently-installed version.

### How to invoke

**Version resolution.** Unlike `install/bootstrap.sh` (which falls back to a baked-in `DEFAULT_VERSION` constant, kept in sync by `scripts/bump-version.sh`), `update/bootstrap.sh` resolves an unset `ARCANUM_VERSION` by querying GitHub directly for the latest release tag:

```
GET https://api.github.com/repos/${ARCANUM_REPO}/releases/latest → tag_name
```

parsed with `grep`/`sed` rather than `jq`, to keep the blindly-piped bootstrap stage dependency-free like the rest of it. This avoids a staleness problem specific to update: the local copy invoking this could be arbitrarily old, so a baked-in constant would be wrong exactly when it matters most. `ARCANUM_VERSION`, when set, is used as-is (same as install).

**Target directory resolution.** Uses the script's own location as a signal for whether it's running as a real file or piped via `curl | bash`:

- `[[ -f "${BASH_SOURCE[0]}" ]]` is true → running as an actual file already inside an install (e.g. `bash <install-dir>/arcanum/update/bootstrap.sh`). `TARGET` is inferred as two directories up from the script's own location (`arcanum/update/bootstrap.sh` → `../..`), verified by `arcanum.json` existing there. No prompt, no flags needed — the common case. Because `TARGET` is known before downloading, `bootstrap.sh` also reads `TARGET/arcanum.json`'s `repo` field here and uses it as the `ARCANUM_REPO` default (still overridable by an explicit env var) — see "Install metadata" below.
- `[[ -f "${BASH_SOURCE[0]}" ]]` is false → piped via `curl | bash`, so `${BASH_SOURCE[0]}` isn't a real path and there's no location signal. Falls back to `ARCANUM_TARGET` env var if set, else an interactive prompt identical to `installer.sh`'s today (default `~/.claude/skills`, confirm if different).

Command shape, combining both:

```bash
# Common case — already installed, update in place, latest version:
bash ~/.claude/skills/arcanum/update/bootstrap.sh

# Fresh curl, explicit overrides:
ARCANUM_REPO=fork/arcanum ARCANUM_VERSION=0.9.0 ARCANUM_TARGET=~/.claude/skills \
  curl -fsSL https://raw.githubusercontent.com/darthjee/arcanum/main/arcanum/update/bootstrap.sh | bash
```

The one case that can't auto-detect the repo: piped `curl | bash` with no `ARCANUM_TARGET` set, where `TARGET` is only discovered later via the interactive prompt inside `updater.sh` — by then the download already happened against the default/explicit `ARCANUM_REPO`. Updating a fork install that way still requires an explicit `ARCANUM_REPO`, same limitation `install` already has today. Accepted as a narrow, documented gap rather than something to re-architect around.

### Install metadata: `arcanum.json` (replaces `arcanum.version`)

Today, `arcanum.version` is a static file baked into the release zip at build time (`scripts/bump-version.sh`) and just carried along by `installer.sh`'s blind `cp -R` — it's never written dynamically. That's no longer enough: update needs to know which repo an install came from (so a fork install's `update` defaults to pulling from the same fork, not silently back to `darthjee/arcanum`), plus a manifest of tracked files to compute deletions. Neither of those can be baked into the zip at build time — a fork builds identical zip contents, and which repo it was *served from* is only known at `bootstrap.sh` runtime.

So `arcanum.version` is replaced by `arcanum.json`, written dynamically by `installer.sh`/`updater.sh` (not shipped statically in the zip):

```json
{
  "version": "0.9.0",
  "repo": "darthjee/arcanum",
  "manifest": ["arcanum/install/bootstrap.sh", "arcanum/install/installer.sh", "..."]
}
```

- `version`/`repo` are populated from the `VERSION`/`REPO` values `bootstrap.sh` already resolves — passed down to `installer.sh`/`updater.sh` as env vars so they can write the file after copying (a small new responsibility for `installer.sh`, which today writes nothing).
- `manifest` is the same file list `scripts/build_release_zip.sh` already computes (its `FILES` array) for building the zip — carried into the zip as a `MANIFEST` file at a well-known path so `installer.sh`/`updater.sh` can read it without needing `git`.
- Reading/writing this file requires `jq`, which is fine — `installer.sh`/`updater.sh` are the bundled-in-the-zip stage, not the dependency-free blindly-piped `bootstrap.sh` stage.
- No migration path needed from the old `arcanum.version`: `install` shipped in commit 7941a69 with no real adopters yet, so `arcanum.json` can simply be the only format from day one — no graceful-degradation logic for a case that doesn't exist in practice.

### Add/delete decision

With `MANIFEST` shipped inside the new release's zip and the previous `manifest` cached in `TARGET/arcanum.json`, `updater.sh` computes:

- **Add/update** — every path in the *new* `MANIFEST` → `cp -R`, overwriting existing files, same as `install` today.
- **Delete** — every path in the *old* `manifest` (from `arcanum.json`) that's absent from the *new* `MANIFEST` → removed from `TARGET`.
- Anything in `TARGET` not mentioned in *either* manifest is left completely untouched — safe even when `TARGET` isn't arcanum-exclusive (install allows `.` or any custom path, not just the dedicated default).

This keeps the delete pass a pure local diff — no second network fetch of an old release just to learn what used to be there.

### Installer refusal now points to update

`installer.sh`'s existing check becomes:

```bash
if [[ -f "${TARGET}/arcanum.json" ]]; then
  echo "Error: an arcanum install already exists at ${TARGET}." >&2
  echo "Run the update script instead: bash ${TARGET}/arcanum/update/bootstrap.sh" >&2
  exit 1
fi
```

replacing today's "This script does not support updates yet — remove the existing install manually first."

### Edge cases

1. **Hand-edited tracked file gets overwritten or deleted.** No checksum baseline exists, so "modified since install" can't be detected. Accepted: overwrite/delete unconditionally, same as `install`'s existing blind `cp -R` — skills are vendored files, not meant to be hand-edited. (Future option if this bites someone: per-file checksums in `arcanum.json`'s manifest, warn/skip on mismatch — deferred, not needed now.)
2. **Already up to date** (resolved version == `arcanum.json`'s recorded version). Short-circuits with a friendly "already on X.Y.Z" message instead of running the full copy/delete pass.
3. **Explicit downgrade** (`ARCANUM_VERSION` set older than installed). Allowed — the add/delete mechanics are direction-agnostic, no special-casing needed.
4. **Partial failure mid-update.** `arcanum.json` is written *last*, only after all file copies/deletes succeed. A failed run leaves the old `arcanum.json` in place, so a retry is well-defined (add/update is idempotent; re-deleting already-gone files is a harmless no-op).
5. **`ARCANUM_REPO` explicitly conflicts with the repo recorded in `arcanum.json`** (e.g. install came from a fork, user explicitly passes upstream). Treated as an intentional override — proceeds, and overwrites the recorded `repo` with the new value. No warning; an explicit env var is a deliberate signal.
6. **Unauthenticated GitHub API rate limit** (60 req/hour/IP) on the `releases/latest` lookup used when `ARCANUM_VERSION` is unset. Accepted as a known limitation for occasional manual use — no token-based auth added to the dependency-free bootstrap stage.

### Alternative solutions

- **Git-native update** (`git fetch && git checkout <tag>`/`git pull`) for installs done via `git clone` (the README's other install option). Already works today, independent of anything this issue builds — git natively solves add/update/delete, no manifest needed. Not something to special-case inside the update script; it's simply the pre-existing alternative for git-clone installs, orthogonal to the zip/curl-installed case this issue targets.
- **`rsync -a --delete`** in place of the manifest-diff `cp -R`/`rm` approach. Explored and rejected: correctly scoping `--delete` to only arcanum-tracked paths (so it never touches unrelated content in a non-exclusive `TARGET`) requires rsync's include/exclude filter engine, which is fiddly — parent directories must be explicitly included alongside file patterns, rule order matters, file vs. directory patterns have different trailing-slash semantics — easy to get subtly wrong in a way that deletes too much or silently deletes nothing. A plain `comm -23 <(sort old_manifest) <(sort new_manifest)` diff piped to `rm -f` gives the identical safety guarantee with far less surface for a bug, and avoids a dependency that isn't guaranteed present (notably not guaranteed in the `cimg/base:stable` container `.circleci/config.yml` builds releases in, nor on every user machine — unlike `cp`/`rm`/`comm`, which are POSIX-guaranteed).
- **`rsync -a`** (no `--delete`) as a straight `cp -R` replacement for the add/update pass alone — preserves permissions/timestamps and skips unchanged files. Marginal benefit for a tree this size; not worth the added dependency.

### Backward compatibility

`install` shipped in commit 7941a69 (PR #115) with no real adopters yet — there is no live `arcanum.version`-only install to migrate. So `arcanum.json` is simply the format from day one: `installer.sh`'s exists-check and `updater.sh`'s manifest handling don't need to special-case or degrade for a pre-`arcanum.json` install, since none exist. If that assumption changes before this ships, revisit — but building graceful-degradation/migration logic for a scenario that can't currently happen would be unnecessary complexity.

### Scope

In scope for this issue:
- `arcanum/update/bootstrap.sh` + `arcanum/update/updater.sh`
- `arcanum.json` replacing `arcanum.version` (written dynamically by `installer.sh`/`updater.sh`, not baked in the zip)
- `installer.sh` changes: write `arcanum.json`; refusal message pointing to `update` when an install already exists
- `scripts/build_release_zip.sh` change: emit a `MANIFEST` file inside the zip
- Add/delete diffing logic, version resolution (latest-tag lookup), target resolution (self-location / prompt / `ARCANUM_TARGET`), repo auto-detection

Explicitly out of scope (deferred):
- Per-file checksums / hand-edit detection (edge case 1)
- Retrofitting `install/bootstrap.sh` to also do a latest-tag lookup instead of its baked `DEFAULT_VERSION` — separate concern
- Uninstall functionality
- Update-availability notifications / auto-update nagging
- Rollback/"undo last update" beyond what an explicit `ARCANUM_VERSION` downgrade already gives
- A Claude-facing skill wrapper to invoke update from within Claude Code — split out to **#117**

### Performance & security considerations

**Path-traversal safety in the delete pass (real issue, needs mitigation).** The delete step iterates over path strings read from `arcanum.json`'s cached `manifest` field, which ultimately originates from a downloaded release's `MANIFEST` file — unlike the add/update pass (a single `cp -R "${RELEASE_ROOT}/." "$TARGET/"`, self-limiting to whatever the verified zip actually unzipped), the delete pass runs `rm -f "${TARGET}/${path}"` per entry individually. A manifest entry like `../../../../etc/passwd` or an absolute path — from a compromised release or a build-script bug — would mean arbitrary-file-deletion outside `TARGET`. Mitigation: validate every manifest entry before use, both when caching it into `arcanum.json` and when computing the delete set — reject any entry that's absolute or contains a `..` segment, and confirm the resolved real path stays strictly inside `TARGET` (`realpath` + prefix check) before ever calling `rm`.

**Temp dir cleanup (hygiene/performance).** `bootstrap.sh` downloads into `mktemp -d` and never cleans it up today (it `exec`s onward into `installer.sh`, and an `EXIT` trap wouldn't fire across `exec`) — accepted for `install`, a one-shot operation. `update` is more likely to run repeatedly, so leftover temp dirs would accumulate. Since `updater.sh` is the final stage (no further `exec`), it should `rm -rf` its own `WORK_DIR` on completion, success or failure, via a trap.

**Accepted, unchanged from `install`'s existing precedent — not new risk introduced here:**
- The `curl | bash` pattern itself (blind execution of remote code) — inherent to how `install` already works.
- No checksum/signature verification of the downloaded release zip — `install` doesn't do this either; adding it would be a symmetric improvement to both, better scoped as its own issue.
- `ARCANUM_REPO` pointing to an attacker-controlled fork if the env var is compromised — same exposure `install` already has.
- Unauthenticated GitHub API calls — no secrets involved, already covered under edge case 6 (rate limiting).
- Manifest diffing (`comm`/`sort` over a few dozen paths) and the API lookup are computationally negligible.

## Benefits

- Users can pull in fixes and new skills without manually deleting and reinstalling.
- Reconciliation is scoped precisely to arcanum-tracked files (via the manifest), so it's safe to run even when the install directory isn't arcanum-exclusive.
- Fork installs stay on their own fork by default — no silent switch back to upstream.
- Symmetric, low-risk extension of the existing `install` architecture rather than a new mechanism.

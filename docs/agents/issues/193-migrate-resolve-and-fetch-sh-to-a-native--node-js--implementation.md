# Issue: Migrate resolve_and_fetch.sh to a native (Node.js) implementation

## Description

The first real entrypoint migration for #168's shell-to-Node.js script-engine effort: a native Node.js implementation of `resolve_and_fetch.sh` — the entrypoint called by `discuss-issue`, `enhance-issue`, and `arcanum-split-issue` — dispatched through the `engine_dispatch.sh` guard (#192, closed) and built against the `core/` Node package (#190/#191, closed). Both blocking sub-issues are done; this issue is unblocked and ready to start.

As part of this issue, `resolve_and_fetch.sh`'s own shell contract is also simplified (see Solution) — the native implementation is built to match the new, simpler contract from the start rather than replicate the old one.

## Problem

Two problems, addressed together:

1. #168's script-engine architecture (dispatch guard, migration-status map, `core/` package) exists but has never been exercised end-to-end by a real entrypoint — only a throwaway fixture (`dispatch-fixture`/`dispatch-fixture-crash`). `resolve_and_fetch.sh` is a realistic, non-trivial first target: it fetches issue data from GitHub, touches git, and has meaningful branches (id resolution, GitHub fetch success/failure, safe-branch checkout).
2. `resolve_and_fetch.sh` is currently over-general for what it actually needs: it delegates to `resolve_id_and_file.sh`'s full Scenario A/B/C parsing (id+title combos, title-only "missing id" flow) even though every one of its actual callers (`discuss-issue`, `enhance-issue`, `arcanum-split-issue`) only ever passes a bare `#<id>` — their own `Usage:` lines already document that. This unused generality drags in a class of bugs: `resolve_id_and_file.sh` resolves paths against the ambient shell cwd instead of `$REPO_PATH` (a gap left over by #208/PR #219, which fixed the same bug class in `github_issue.sh`/`issue_state.sh`/`list_agents.sh` but didn't touch this script — its own PR description even name-checks `resolve_and_fetch.sh` as an at-risk caller), and produces a confusing two-tier error contract (a malformed id hard-crashes with no `STATUS=` line at all, while "issue not found" gets a proper `STATUS=error`).

## Expected Behavior

- `resolve_and_fetch.sh` (shell) accepts only `#<digits>` as input (surrounding whitespace trimmed). Anything else — empty string, `#abc`, `#193 - title`, a bare title — uniformly produces `STATUS=error` + `ERROR=<message>`, exit 0. No hard-failure/no-`STATUS=`-line class remains for this entrypoint.
- With `engine.mode=native` configured (resolved local -> repo -> global), the same script transparently runs a Node.js implementation instead, producing byte-identical stdout (`STATUS=ok`/`ID=`/`TITLE=`/`FILE=`/`DOMAIN=`/`REPO=`, or `STATUS=error`/`ERROR=`) and exit code for every defined input.
- With `engine.mode=shell` (the default) or `docker` (falls back to shell per #192's scope), behavior is unchanged from the simplified shell contract above.
- `discuss-issue`, `enhance-issue`, and `arcanum-split-issue` all continue to work unchanged — none need edits, since their existing `#<id>`-only usage and `STATUS=error` handling already match the simplified contract.
- The first time a repo processes migrations after this ships, it sees a one-time, opt-in-feature notice about `engine.mode` (see Solution).

## Solution

**Call graph.** `resolve_and_fetch.sh`'s real observable behavior is the union of three pieces plus one side-effect write, all of which the native reimplementation owns itself (self-contained under `core/lib/`, per #168's "no standalone `_lib` migration" rule -- the existing `arcanum/_lib/*.sh` files stay untouched for `engine.mode=shell` callers):

1. **Safe-branch checkout** (`checkout_safe_branch.sh`/`safe_branch.sh`): dirty-tree check, `git fetch -p`, `git checkout <branch>` -- plain `git` via `child_process`, no `gh` involved.
2. **ID resolution** -- simplified (see below): parse `#<digits>` only, locate an existing `docs/agents/issues/<id>_*`/`<id>-*` file.
3. **GitHub fetch** (`github_issue.sh fetch`): a REST call to `GET /repos/<owner>/<repo>/issues/<id>` (REST only -- no GraphQL is actually used today), label-to-canonical-tag mapping (`tags.sh`'s table), and a side-effect write to `.claude/state/issue-<id>.json` via `issue_state.sh`.

**In scope**: native reimplementations of all three pieces above, plus the tag-mapping table, duplicated into `core/lib/` rather than shared -- acceptable for now; revisit sharing a native tag module only once a second migrated entrypoint needs the same table.

**Out of scope**: every other `github_issue.sh` subcommand (`update`, `create`, `mark-*`) stays shell-only for this issue.

**Simplify the id contract** (shell side changes too, not just native -- folded into this issue): `resolve_and_fetch.sh` drops its dependency on `resolve_id_and_file.sh` entirely and gets its own small, dedicated parser -- input must match `#<digits>`; anything else is uniformly `STATUS=error`. `resolve_id_and_file.sh` itself is untouched, since it's still needed in full by `auto-new-issue`'s own "create a new issue from a title" flow.

**State-file locking**: `issue_state.sh`'s write to `.claude/state/issue-<id>.json` uses a lock-file/retry protocol (see `docs/agents/architecture/lock-system.md`) so concurrent writers don't clobber each other. The native implementation must replicate this exact lock/mutate/release sequence, not a simplified version -- kept deliberately robust given a longer-horizon plan to eventually move issue/tag state onto a dedicated server, which makes it worth not cutting corners on the current locking semantics now.

**Security**:
- The GitHub token obtained via `gh auth token` must never be printed to stdout/logs. Obtained via `child_process` `execFile`/`spawn` with an argument array -- never a string-interpolated `exec()` call, since issue titles/bodies are untrusted content.
- **Filename sanitization**: `normalize_title` strips a GitHub issue title down to `[a-z0-9-]` before it's used to build `docs/agents/issues/<id>-<slug>.md`. Since the title comes from GitHub (attacker-influenced on a public repo), the native version must replicate this exact sanitization before writing any file path built from it -- a looser regex is a path-traversal risk.
- **ID validation before use**: the id must be validated against `^[0-9]+$` before it's used in a file glob or as a REST URL path segment -- not after.
- **Fetch timeout**: the shell version's `curl -sf` call has no timeout and can hang forever on a stalled connection; Node's global `fetch` has no default timeout either. The native version adds a 30-second timeout via `AbortSignal.timeout(30000)` -- a strict improvement, since a hang isn't a defined branch the byte-identical/parity contract covers.
- No GitHub SDK package -- Node's built-in global `fetch` (Node 18+) for the HTTP call, `gh auth token` for auth. Zero runtime dependencies, matching `core/`'s existing convention.

**Performance**: no real concern -- this entrypoint runs once per `discuss-issue`/`enhance-issue`/`arcanum-split-issue` invocation, not in a loop or hot path, so Node's process-startup overhead (roughly 50-100ms) vs. bash's (roughly 5-10ms) is negligible.

**Edge cases to cover in both the shell change and the native tests**:
- Uniform `STATUS=error` for any malformed input (see Expected Behavior) -- every existing caller's handling already treats `STATUS=error` this way, so no caller-side changes are needed.
- `TITLE`'s provenance is now single-sourced: the real GitHub API response (fresh fetch) or `title_from_filename`'s Title-Case-from-filename derivation (existing-file match). Both need their own test fixture.
- `find_existing_file`'s match order is filesystem-dependent: if two files matched the same id prefix, `find | head -1` picks whichever the filesystem returns first -- not stable even in the shell original. The parity test should avoid constructing ambiguous multi-match fixtures rather than chasing a "correct" deterministic tie-break the shell version itself doesn't have.
- Exact error-message text must be preserved across every failure source (auth failure, fetch failure, malformed id) since it flows straight into `STATUS=error`'s `ERROR=` field -- part of the byte-identical contract.

**Testing**: unit tests (`core/spec/`) covering the native implementation's branches, with `fetch` mocked/stubbed via fixture data under `core/spec/support/fixtures/` (no real GitHub network calls in CI), plus a required **parity test** that runs both the shell script and the native script with identical inputs and asserts identical stdout + exit code.

**Migration notice**: `engine.mode` is a purely opt-in config key (defaults to `shell`; nothing breaks for repos that ignore it) -- not a structural change existing repos need to catch up on. Still worth a one-time informational nudge: add a `next/` migration entry (`type: "script"`, `applies_to: "local"`, `skippable: true`) whose `run` step prints a prominent notice -- no file changes, trivially idempotent -- covering:
- Experimental & opt-in: enabling `engine.mode=native` today only activates a native path for `resolve_and_fetch.sh`; every other entrypoint silently falls back to shell regardless, per `engine_dispatch.sh`'s fallback rule.
- The key: `engine.mode` -- values `shell` (default), `native`, `docker` (docker also falls back to shell today, per #192's scope).
- Where to set it, resolved local -> repo -> global:
  - Local (gitignored, per clone): `.claude/state/arcanum-config.json` -> `{"engine": {"mode": "native"}}`
  - Repo (committed, shared): `.claude/configuration/arcanum-repo-config.json` -> `{"engine": {"mode": "native"}}`
  - Global (account/machine-wide): `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` -> `{"engine": {"mode": "native"}}`

**What needs to be done**:
- [ ] Add a `next/` migration entry (script, `applies_to: local`, `skippable: true`) that prints the one-time opt-in notice.
- [ ] Simplify `resolve_and_fetch.sh`'s shell contract to id-only and drop its dependency on `resolve_id_and_file.sh`. Do this first, since the native implementation is built to match this new contract.
- [ ] Implement the native equivalent of the simplified `resolve_and_fetch.sh` under `core/lib/` (and whatever supporting modules it needs, e.g. for the GitHub REST call currently in `arcanum/_lib/github_issue.sh` -- reimplemented natively for this entrypoint's needs only).
- [ ] Write unit tests (`core/spec/`) covering the native implementation's branches, with `fetch` mocked via fixtures.
- [ ] Write the required parity test comparing shell vs. native output/exit code for the same inputs.
- [ ] Update `resolve_and_fetch.sh` itself to become the thin shell shim that calls into `arcanum/_lib/engine_dispatch.sh` instead of running its logic directly -- its filename and call sites in `discuss-issue`/`enhance-issue`/`arcanum-split-issue` stay unchanged.
- [ ] Add this entrypoint to the migration-status map, marking it "available" (native) -- only once unit tests, the parity test, and code review all pass, per #168's gating decision.
- [ ] Manually verify `discuss-issue`, `enhance-issue`, and `arcanum-split-issue` all still work correctly with `engine=native` configured, in addition to the automated parity test.
- [ ] Fix `resolve_id_and_file.sh`'s cwd-relative `ISSUES_FOLDER` resolution bug for its remaining caller (`auto-new-issue`) -- it should resolve against `$REPO_PATH`, not the ambient cwd, matching the fix #208/PR #219 already applied elsewhere.

## Benefits

- Proves #168's architecture end-to-end with a real, non-trivial entrypoint, unblocking every subsequent script-to-native migration.
- Removes unused generality from `resolve_and_fetch.sh`'s id handling, and the confusing two-tier (hard-crash vs. `STATUS=error`) failure contract that came with it.
- Fixes a latent cwd-relative-path bug's blast radius by construction for this entrypoint's callers, and tracks the underlying fix for its one remaining caller (`auto-new-issue`).
- Establishes reusable patterns (dispatch shim, parity testing, fixture-mocked `fetch`, native GitHub REST + `gh auth token` auth) that every future entrypoint migration can copy directly.

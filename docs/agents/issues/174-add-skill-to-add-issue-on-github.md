# Issue: Add skill to add issue on github

## Description

Add a shared internal script, `arcanum/_lib/spawn_issue.sh`, that lets a skill mid-dialogue (`enhance-issue`, `discuss-issue`, and a refactored `arcanum-split-issue`) create a brand-new GitHub issue on demand — with the right title/body, a correctly filtered set of labels copied from the issue currently being discussed, and a new provenance label, `Spawned`, marking it as having been created this way. The new label is registered in the shared tag table, the `init-claude` label registry, and synced to already-onboarded repos via a new migration.

## Problem

Right now, when the agent is in the middle of `enhance-issue` or `discuss-issue` and the discussion surfaces something that deserves its own GitHub issue, there is no default, structured way to create it. In practice this has led to the agent committing the new issue's draft file directly to `master`, bypassing the normal branch/PR flow entirely.

## Expected Behavior

Whenever `enhance-issue`/`discuss-issue` (or `arcanum-split-issue`) needs to spin off a new issue mid-dialogue, it calls `spawn_issue.sh` with the parent issue id, a title, and a body. The script:

- Creates the issue on GitHub with a title/body/label set derived safely from the parent issue — never a raw copy that could leak pipeline-only labels like `shipit`.
- Adds the new `Spawned` label, so any issue created this way is identifiable at a glance and programmatically (via `has_tag`).
- Never leaves a local file behind to be accidentally committed — the local draft it uses is scratch input only, deleted once the GitHub issue exists.
- Optionally links the new issue back to its origin, either as a lightweight comment cross-reference or, when appropriate, as a formal native GitHub sub-issue.

Repos that already ran `init-claude` before this change get the `Spawned` label synced onto their live GitHub repo automatically via a migration, without needing to re-run `init-claude` from scratch.

## Solution

### Scope

- **Full pipeline, owned by `spawn_issue.sh`** — this is what actually fixes the "agent commits directly to master" problem: given a parent issue id, a title, and a body, it creates the issue on GitHub with the right title/body/labels, writes the body to a local scratch file under `docs/agents/issues/` purely as create-call input (reusing `arcanum/_lib/github_issue.sh`'s existing `create` command unchanged), and **deletes that file once the GitHub issue is created — it is never committed.** The new issue is not part of the current branch/PR's work; it belongs to whichever branch eventually discusses/plans it, fetched fresh at that point by `enhance-issue`/`discuss-issue`/`plan-issue`. No local file survives to be committed at all, so the mistake the issue opens with is structurally removed rather than routed through a "proper" commit path.
- **Shared with `arcanum-split-issue`** — the "create a GitHub issue carrying a filtered/derived label set" logic lives in one place, reused by both this new mid-dialogue path and `arcanum-split-issue/scripts/create_sub_issue.sh`. Single source of truth for the label policy and the new label, instead of two implementations that could drift.
- **Internal-only** — no standalone user-facing slash command. It's a script other skills call directly with explicit args, the same way `enhance-issue`/`discuss-issue` already reuse each other's scripts (e.g. `resolve_and_fetch.sh`) without each having its own slash command. Correspondingly, `spawn_issue.sh` itself needs no confirmation/selection prompt of its own — the decision of whether to spawn, with what title/body, as a sub-issue or not, already happens in the ordinary chat dialogue that calls it, not a script-level prompt.

### New label: `Spawned`

- **Name**: `Spawned` — distinct from the existing `Split` label, which marks the *parent* issue after it has been split (see `docs/agents/architecture/issue-tags.md`), not the newly created children/issues. `Spawned` covers both this new mid-dialogue-creation path *and* `arcanum-split-issue`'s sub-issues.
- **Color**: `#6a737d` (neutral gray) — not used by any existing label. Deliberately not a purple: the palette already has a cluster there (`Refactor` 983e7f, `Working` c314d7, `Question` 5319e7). Gray reads as "system-applied metadata" rather than a human triage category, pairing conceptually with `Split`'s black (`000000`) as the other provenance/lineage label.
- **Lifecycle**: permanent — applied once at issue-creation time and never removed by any `mark-*` transition. It's provenance metadata (like `Bug`/`Automated`), orthogonal to pipeline-stage labels (`Idea`/`Created`/`Refined`/...), mirroring how `Split` itself stays on the parent forever once applied.
- Registered in `arcanum/_lib/tags.sh`'s canonical-tag/label-name table (`spawned` <-> `Spawned`) alongside `Split`, even though no mutation ever removes it, so any future script can check for it via `has_tag`.

### Calling contract

`arcanum/_lib/spawn_issue.sh <repo_path> <parent_id> <title> <body_file> [--as-subissue]`

- **Scratch file**: `<body_file>` is passed straight through to `arcanum/_lib/github_issue.sh`'s existing `create <repo_path> <title> <file>`, which still writes the canonical `docs/agents/issues/<id>-slug.md`. `spawn_issue.sh` deletes that file itself once every step below succeeds.
- **Retry**: wraps the create call in the same retry loop `arcanum-split-issue/scripts/create_sub_issue.sh` already has around `gh issue create` (`max-retry-count`/`error-sleep-time` from `arcanum-config.json`'s `"plan-issues"` section), so a transient GitHub API blip does not kill the dialogue it is called from.
- **Transport**: built on `github_issue.sh`'s existing curl+jq `cmd_create` primitive (JSON payload via `jq --arg`), not raw `gh issue create --title/--body` shell args — avoids quoting/`ARG_MAX` edge cases and reuses rather than triples the transport logic.
- **Labels**: after a successful create, fetches `<parent_id>`'s current labels, filters them through the allow-list described below, adds `Spawned`, then applies the result via `gh issue edit --add-label`. Best-effort — a `gh` failure here logs a warning but does not fail the whole call, since the issue itself was already created.
- **Linking back**: always posts a lightweight GitHub comment cross-reference on both issues (e.g. "Spawned issue #<new_id>: <title>" on the parent, "Spawned from #<parent_id>" on the new issue — GitHub auto-links the `#<id>` mentions). The optional `--as-subissue` flag additionally creates a formal native GitHub sub-issue link (the `addSubIssue` GraphQL mutation `arcanum-split-issue` already used, moved into the shared script). Best-effort, with the same "created but not linked; link it manually on GitHub" fallback message `create_sub_issue.sh` already has today.
- **Output**, mirroring `create_sub_issue.sh`'s existing contract: `STATUS=ok` / `ID=<new_id>` / `URL=<url>` on success, exit 0; `STATUS=failed` on exhausted create retries, exit 1 (the scratch file is only ever written on a successful create, so there is nothing to clean up on this path).
- **Callers**:
  - `enhance-issue`/`discuss-issue` call it directly, mid-dialogue: `../../arcanum/_lib/spawn_issue.sh "$REPO_PATH" <current_issue_id> "<title>" <body_file> [--as-subissue]`. The calling skill/agent decides per-call whether the new issue is genuinely a piece of the current issue's own work breakdown (`--as-subissue`) or a tangential/independent concern (comment-only, the default) — an agent judgment call each time, not a fixed rule.
  - `arcanum-split-issue/scripts/create_sub_issue.sh` is refactored to call it with `--as-subissue` always (its whole purpose is a structural work breakdown), parsing its own sub-issue draft file into a temp body file first, then keeps only its own `.claude/state/issue-<id>.json` tracking on top of the returned `ID` — its current inline `gh issue create` + label-building + `addSubIssue` call are all replaced by this single call.
  - Native sub-issue nesting is not a structural concern either way: GitHub supports up to 8 levels of nesting and up to 100 direct sub-issues per parent ([GitHub Docs](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues)).

### Label policy (security)

The issue's own exclude list (`Created, Refined, Ready, Working, Enqueued`) omits `shipit` — the human-only, pre-approved-for-auto-merge label. Copying it verbatim onto a freshly spun-off issue would silently pre-approve auto-merge with no human review, a real security gap. Instead, the label copy is an **allow-list**: strip every label that maps to a canonical pipeline tag in `arcanum/_lib/tags.sh` (`created`, `refined`, `ready`, `working`, `enqueued`, `shipit`, `idea`, `writting`, `enhancing`, `fetched`, `pr`, `planning`, `split`, `question`, `ready_for_work`), keep everything else (e.g. `Bug`/`Feature`/`Documentation`/`Refactor`/`Automated`), then add `Spawned`. Safe by construction against future pipeline labels, unlike a hand-maintained deny-list.

### Migration

A new migration under `arcanum/migrations/repos/next/`, `applies_to: "repo"` (it mutates the live, shared GitHub repo), `skippable: true` — the first migration in the project to sync a label rather than a config file/permission grant.

- Creates/updates the `Spawned:6a737d` label directly on the repo's live GitHub labels (`gh label create`/`gh label edit`, matching `init-claude/scripts/sync_labels.sh`'s existing case-insensitive-match-then-create-or-update logic) — this is what actually makes `spawn_issue.sh`'s `gh issue edit --add-label Spawned` succeed.
- If `.claude/state/init-claude-config.json` already exists (the repo previously ran `init-claude`'s label setup), also upserts `Spawned:6a737d` into it via `init-claude/scripts/write_label_config.sh add`, so a future manual `sync_labels.sh` re-run stays consistent. If the config does not exist, that part is simply skipped.
- **No confirmation prompt** — unlike the shipit-permission migrations, which loosen a security gate and always ask, adding a label is fully additive/reversible. It runs silently in both interactive and non-interactive contexts, printing an informational line to stdout that `arcanum-migrate`'s relay already surfaces.
- Idempotent / safe to re-run, like every other migration.

### Edge cases

Operation order inside `spawn_issue.sh`: **create (retried) -> fetch/apply labels (best-effort) -> linking/comments (best-effort) -> delete scratch file.** Everything after the create call is best-effort and logs a warning rather than failing the whole call, since the primary outcome — the issue exists on GitHub — has already been achieved.

- **Parent issue lookup fails** (bad `<parent_id>`, deleted/inaccessible issue, transient `gh` failure) — happens after the new issue already exists, so it cannot block creation. Falls back to applying just `Spawned` alone, logs a warning.
- **Scratch-file cleanup (`rm`) fails** — still `STATUS=ok`, but with a *loud* warning: an un-removed file in `docs/agents/issues/` is exactly the failure mode this feature exists to prevent. The calling skill step should surface this warning rather than silently continuing.
- **`--as-subissue` link failure** — best-effort, same "created but not linked; link it manually on GitHub" fallback `create_sub_issue.sh` already has. The comment cross-reference is still attempted regardless.
- **Comment-post failure** — best-effort, warn, does not fail the call.
- **Retry-after-actual-success creating a duplicate issue** — an inherited, already-accepted risk (the same shape `create_sub_issue.sh`'s existing retry loop already has today), not new here and not solved differently here.
- **Missing/invalid args** — standard usage-error validation, matching every other script in `arcanum/_lib/`.

## Benefits

- Removes the actual cause of the "agent commits issue files directly to master" problem, structurally — not by routing the commit through a "correct" path, but by never leaving a local file to commit in the first place.
- Single, shared, safe-by-construction label-copy policy (allow-list, not deny-list) used by every code path that spins off a new issue, closing a real gap where `shipit` could otherwise leak onto a brand-new issue and silently pre-approve auto-merge.
- `arcanum-split-issue` sheds its own bespoke issue-creation/label/linking code in favor of the shared script, reducing duplicate logic that could drift.
- Every spawned issue is identifiable at a glance (and programmatically) via the new `Spawned` label, whether it came from a formal split or a tangential concern raised mid-dialogue.
- Repos that already ran `init-claude` catch up automatically via a migration — no manual GitHub label setup needed to pick up the new feature.

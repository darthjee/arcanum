# Issue: Add global migration mechanism

## Description
Arcanum's per-repo migration system (`arcanum/migrations/repos/<version>/migrations.json`) marks each entry with `applies_to: "repo"` (satisfied once the committed pointer in `.claude/configuration/arcanum-repo-config.json` advances) or `"local"` (satisfied once the per-clone pointer in `.claude/state/arcanum-config.json` advances).

Issue #160 (PR #171) separately shipped a third, outermost **config tier** — a global, cross-project file (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`, via `arcanum/_lib/global_config.sh`/`config_chain.sh`) shared across every repo the active Claude Code account/profile touches. That gave arcanum a place for global *values* to live, but the migration **manifest schema** itself was never extended to match: `applies_to` still only accepts `"repo"` or `"local"`. This issue adds a real `applies_to: "global"` scope so migrations can target that tier directly, with the same "run at most once" guarantee `"repo"`/`"local"` already provide for their own scopes.

## Problem
- The migration manifest schema has no way to express "this entry's effect belongs to the global, cross-project config tier" — only `"repo"` and `"local"` exist.
- The one migration that already writes to the global tier (`arcanum/migrations/repos/next/001.sh`, sets `git.email`) works around this by using `applies_to: "local"` plus a hand-rolled idempotency check (re-verify all three config tiers before acting). It re-runs — and re-checks — on every clone, forever, since nothing ever marks it "done" globally. Any future one-time, cross-project preference prompt (e.g. a default agent-name pattern, a default `git.safe_branch` preference) would have to reimplement that same guard by hand, with no framework guarantee it's done correctly.
- There is also no way today to initialize/seed a global migrations pointer at all — the concept doesn't exist yet.

## Expected Behavior
- `applies_to: "global"` is a valid third value in `migrations.json`, alongside `"repo"`/`"local"`.
- A `"global"`-scoped entry is satisfied once `.migrations.version` inside the global config file (`${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json`) reaches the entry's version folder — and since that file is genuinely shared across *every* repo on the machine/account (not just clones of one repo), one repo advancing it satisfies every other repo immediately.
- If the global config location can't be resolved at all (no `$HOME` and no `CLAUDE_CONFIG_DIR`), processing a `"global"`-scoped entry hits a **hard error**, scoped to just those entries — unrelated `"repo"`/`"local"` entries in the same manifest still proceed normally. (Louder than `global_config.sh`'s own silent-degrade read/write behavior, deliberately: the alternative — treating the pointer as `0.0.0` forever — would mean the entry re-prompts/re-runs on every single `/arcanum-migrate` invocation in that environment forever, with no way to ever complete.)
- Advancing the global pointer tolerates "already past this version" as the normal case (another repo/profile got there first) — same not-backwards guard `_advance_pointers` already applies to `"repo"`/`"local"`.
- Running `/arcanum-migrate` under a different Claude Code profile (different `CLAUDE_CONFIG_DIR`) makes an already-satisfied global entry look pending again under that profile — intended, mirrors `global_config.sh`'s own per-profile scoping, not a bug.
- No new prompting flow — `"global"` flows through `arcanum-migrate`'s existing `[A]ll/[N]one/[S]elect/[C]hat` master-script pattern (`arcanum/migrations/run.sh`) unchanged.

## Solution
Add `"global"` as a genuine third scope in the migration manifest, mirroring `"repo"`/`"local"` closely enough to reuse their pattern, but reading/writing its pointer through `arcanum/_lib/global_config.sh`'s resolve+lock helpers (`_global_config_file`, `_acquire_lock`/`_release_lock`) instead of `repo_config_get_version`/`repo_config_set_version` — the global file's location is never `--repo`-relative.

Plumbing required (confirmed by reading the current implementation):

| File | Current state | Change needed |
|---|---|---|
| `arcanum/migrations/_manifest.sh` | Header/contract documents only `"repo"`/`"local"`. `_manifest_has_scope` is already scope-agnostic (plain string compare) — works for `"global"` with **no code change**. | Document `"global"` as a third value in the header comment. |
| `arcanum/migrations/_pending_versions.sh` | `_pending_versions <committed_version> <local_version>`, two branches. | Add a third `<global_version>` param and branch. |
| `arcanum/migrations/update_per_version.sh` | Reads `COMMITTED`/`LOCAL_VERSION` via `repo_config_get_version` against repo-local files; `HAS_REPO_ENTRY`/`HAS_LOCAL_ENTRY`; two-armed satisfied-check; `_advance_pointers` writes both files. | Read/write a `GLOBAL_VERSION` pointer through `global_config.sh`; add `HAS_GLOBAL_ENTRY`, a third satisfied-check arm, and a third arm in `_advance_pointers`. |
| `arcanum/migrations/run.sh` / `select_version.sh` | Resolve committed+local pointers, pass into `_pending_versions`. | Also resolve the global pointer and pass it through. |
| `arcanum/migrations/generate_next.sh` | Scaffolds `applies_to: "local"` as the default. | Offer/allow `"global"` as a choice too. |
| `docs/agents/architecture/per-repo-migrations.md`, `docs/guides/arcanum-repo-version.md`, `docs/guides/arcanum-global-config.md` | Describe the 2-pointer scheme. | Describe the 3-pointer scheme; note the global pointer is satisfied machine-wide, not per-clone. |

**Ship with a seed/no-op migration.** Add one `type: "script"`, `applies_to: "global"` entry (empty `run`, e.g. just `exit 0`, `skippable: true`) in the same version this feature ships in, purely to initialize `.migrations.version` in the global config file for every install. This decouples "prove the new plumbing works" (pointer resolution, the hard-error path, the lock, `_advance_pointers`' new arm — exercised across real, varied `$HOME`/`CLAUDE_CONFIG_DIR` setups) from "carries real behavior," so a bug in either is easy to isolate. Skipping it just means the global pointer doesn't advance yet and it's offered again next run, same semantics as any other skipped entry.

**Cross-repo write races**: two different repos' `/arcanum-migrate` runs could concurrently decide a `"global"` entry is still pending and both act on it before either writes the pointer. `global_config_write`'s lock only protects the write itself, not the surrounding decide-then-act sequence. Accepted as best-effort at the framework level (no new cross-process locking around the whole check-then-run-then-advance sequence) — **each `"global"`-scoped migration's author is responsible for thinking through this race for that specific entry** (e.g. re-checking state right before acting, guarding a prompt against having already been answered elsewhere), the same way idempotency itself is already an authoring responsibility for `type: "script"` entries. The same applies to `type: "instructions"` + `applies_to: "global"` mid-manifest resume: the completion ledger is per-repo, while the global pointer only advances once a whole manifest finishes without halting, so a different repo won't see another repo's in-flight progress on the same version and will retry the entry from scratch when it gets there.

**Out of scope:** converting existing `001.sh` (currently `applies_to: "local"` with hand-rolled idempotency, targeting `git.email`) to `applies_to: "global"`. It keeps working as-is; that conversion is a separate, later cleanup issue, not part of this one.

## Benefits
- Gives migrations a framework-guaranteed "run at most once, ever, machine-wide" mechanism for cross-project preferences, instead of every author hand-rolling the same idempotency-check pattern `001.sh` demonstrates.
- Keeps the manifest schema symmetric and self-documenting: `"repo"`, `"local"`, and `"global"` each map cleanly to one of arcanum's three config tiers, so an entry's `applies_to` value tells you exactly which pointer/file it affects without reading its script.
- The seed migration proves the new plumbing works safely, in production, across real and varied environments before any consequential global-effect migration relies on it.

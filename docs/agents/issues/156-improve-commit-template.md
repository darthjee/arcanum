# Issue: Improve commit template

## Description

Today, when `auto-fix-issue` (or `auto-new-issue`/`auto-plan-issue`) makes a commit, the calling scripts (`auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, `auto-plan-issue/scripts/commit_plan.sh`) build the commit message by hardcoding its shape directly in bash. `.github/commit_message_template.md` (copied into a repo once by `init-claude/scripts/setup_templates.sh`) is purely human-facing documentation of that shape — it is never read or parsed at runtime. Both `Co-Authored-By` trailers currently reuse the same email: the running AI model's canonical noreply address (e.g. `noreply@anthropic.com`), supplied by the calling agent per its top-level instructions.

## Problem

- The commit scripts never prefer a repo-local template over arcanum's own — there's no lookup/fallback at all, since the file isn't read either way.
- There is no way to give a specialist agent's `Co-Authored-By` line a distinct, real email. It always reuses the model's own canonical noreply address, which prevents mapping individual agents (`architect`, `backend`, `frontend`, ...) to their own GitHub identity for attribution/notifications.
- The repo-level config path referenced in earlier drafts of this issue (`.claude/config/arcanum-repo-config.json`) does not exist anywhere in this codebase — the real path is `.claude/configuration/arcanum-repo-config.json`.

## Expected Behavior

- With no configuration at all, commit message output is byte-for-byte identical to today (single shared email on both `Co-Authored-By` lines) — zero-config repos see no change.
- Once a repo has `.github/commit_message_template-2.0.md` present (via the migration below) and a `git.email` pattern configured (locally and/or in repo config), each commit's **agent** line carries a distinct, per-agent email (e.g. `darthjee+architect@gmail.com` for the `architect` agent, `darthjee+backend@gmail.com` for `backend`), while the **model** line keeps reporting the actual running AI model's own address, unaffected by any config.
- A repo that has an old `.github/commit_message_template.md` but no `-2.0.md` yet keeps getting old-shape output — adopting the new behavior is opt-in via the migration, never a forced upgrade.

## Solution

### Scope

Applies to all three commit scripts: `auto-fix-issue/scripts/commit_change.sh`, `auto-new-issue/scripts/commit_issue.sh`, and `auto-plan-issue/scripts/commit_plan.sh`. The latter two get the same agent/model email split as `commit_change.sh`, using their fixed `agent="architect"` value for the `{agent}` substitution in `agent_email_get`.

### Template resolution model

File presence is a version switch, not something that gets parsed. The scripts never read the template file's text today (they hardcode the message shape in bash) and that stays true — nothing becomes a real templating engine. What changes is that the scripts now check *which* template file exists to decide which of two fixed, hardcoded shapes to emit:

1. `$REPO_PATH/.github/commit_message_template-2.0.md` exists → **new engine** — two distinct `Co-Authored-By` lines, agent line's email via the `{agent}`-templated `git.email` lookup (see below).
2. Else `$REPO_PATH/.github/commit_message_template.md` exists (old file only, no `-2.0.md` yet) → **old engine** — exactly today's output (single shared email on both lines). This is what keeps a repo that hasn't run the migration unaffected — no forced upgrade.
3. Else (repo has neither file, e.g. never ran `init-claude`'s `setup_templates.sh`) → fall back to arcanum's own installed `-2.0.md` → **new engine**.

The `commit_message_template-2.0.md` content itself still gets updated (as human-facing documentation of the new shape), but it is never parsed at runtime — only checked for existence. The scripts already take `$REPO_PATH` today; nothing changes there beyond using it for this existence check.

### Agent email vs. model email

The template keeps **two separate `Co-Authored-By` lines**, each with its own, independently-sourced email — not one shared value reused for both, and not a toggle to drop either line:

- **Model line** (`<AI model name> <AI model email>`): unchanged from today. Always supplied by the running agent itself per its top-level instructions (e.g. `Claude Sonnet 5 <noreply@anthropic.com>`). **Not** config-overridable — out of scope for this issue.
- **Agent line** (`<agent> agent <agent email>`): its email now goes through a new config fallback chain (local state → repo config → default). When nothing is configured, it defaults to the same value as the model email, which reproduces today's output exactly.

Example (new engine, `git.email` configured as `darthjee+{agent}@gmail.com`, substituted for the `architect` agent):
```
docs(issue): add issue file (issue https://github.com/darthjee/arcanum/issues/145)
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Co-Authored-By: architect agent <darthjee+architect@gmail.com>
```

### Config path & lookup implementation

Repo config path: `.claude/configuration/arcanum-repo-config.json` (matches every other reference in this codebase, e.g. `arcanum/_lib/repo_config.sh`'s docs and `safe_branch.sh`'s usage). Local state: `.claude/state/arcanum-config.json`, under the `git` key (same namespace already used for `git.safe_branch`).

No new JSON-parsing logic needed — reuse the existing `arcanum/_lib/repo_config.sh` helper (`repo_config_read <new_file> <legacy_file> <namespace> <key>`, no legacy file needed since `git.email` has no predecessor), chained the same way `safe_branch.sh`'s `safe_branch_get()` reads `git.safe_branch`:

```bash
# agent_email_get <agent>
#   git.email holds a *pattern* (e.g. "darthjee+{agent}@gmail.com"), not
#   a static address — see "Edge Cases" below. {agent} is substituted
#   with the calling agent's name (e.g. "architect", "backend").
agent_email_get() {
  local agent="$1" email
  email=$(repo_config_read ".claude/state/arcanum-config.json" "" "git" "email")
  [[ -n "$email" && "$email" != "null" ]] || \
    email=$(repo_config_read ".claude/configuration/arcanum-repo-config.json" "" "git" "email")
  email="${email//\"/}"
  [[ -n "$email" && "$email" != "null" ]] || { echo "$MODEL_EMAIL"; return; }
  echo "${email//\{agent\}/$agent}"
}
```

### Edge cases

- **`git.email` is a per-agent template, not a static address.** It holds a pattern like `darthjee+{agent}@gmail.com`, with `{agent}` substituted for the actual agent name (`architect`, `backend`, ...) at commit time — each agent ends up with its own distinct email. This must be spelled out explicitly in the migration `.md` that proposes setting this key (both the repo and local variants), since it's not obvious from the key name alone.
- **GitHub account linking is the user's responsibility, not the script's.** The user creates one GitHub account per agent and registers each generated address as a verified email on that account. The script only needs to produce the substituted address correctly — it does not need to validate that the address is registered/verified anywhere.
- **`null` and missing are the same as "not configured."** Whether the key is entirely absent, the file itself doesn't exist, or the key is explicitly JSON `null`, treat all three identically: fall through to the next source in the chain (local → repo → model-email default). A literal string `"null"` must never end up in a commit trailer.
- **Precedence: local overrides repo.** A personal `.claude/state/arcanum-config.json` value always wins over the shared, committed `.claude/configuration/arcanum-repo-config.json` value, consistent with local state being per-clone/personal and repo config being the team-wide default.

### Migration

Three separate migration entries, all under the same next version folder in `arcanum/migrations/repos/<version>/` (the existing manifest already supports mixing `applies_to: "local"` and `applies_to: "repo"` entries side by side — see `0.13.0`'s `001`/`002`):

1. **Repo, script — create `.github/commit_message_template-2.0.md`.** Copies arcanum's own updated template into the repo if the file doesn't already exist there (mirrors `setup_templates.sh`'s create-if-absent behavior). Idempotent/safe to re-run, `skippable: true` — skipping just means the repo keeps using the old engine until it's applied. Never touches the old `commit_message_template.md`.

2. **Local, script, interactive — set `git.email` on `.claude/state/arcanum-config.json`.** Same `/dev/tty` interactive pattern as `0.13.0/001.sh` (`safe_branch`): `[Y]es/[T]ype/[S]kip`, silently writes the guessed default when no interactive terminal is available, `skippable: true` (unset key already falls back to the model email at use-time via `agent_email_get`). Guessed default: derived from `git config user.email` (e.g. `darthjee@gmail.com` → guess `darthjee+{agent}@gmail.com`); falls back to prompting with no guess (`[T]ype/[S]kip` only) if `git config user.email` is empty. Must explain in its `.md` that this is a per-agent template (`{agent}` gets substituted, not a static address).

3. **Repo, script, interactive — set `git.email` on `.claude/configuration/arcanum-repo-config.json`.** Same interactive shape as #2, but since this file is committed and shared with every contributor, the prompt must show an explicit warning before writing — e.g. "This value will be committed to the repo and visible to all contributors." Also `skippable: true`. Its `.md` must explain the same per-agent templating as #2.

### Script-driven interaction

No new master script needed. `arcanum/migrations/run.sh` already is the single master script that owns the whole interactive flow (`/dev/tty`-driven `[A]ll/[N]one/[S]elect/[C]hat`, explicit `--repo <path>` argument, no ambient-cwd reliance) and already loops every pending migration's own `config`/`run` subcommands in sequence — including nested per-migration prompts (see `0.13.0`'s interactive `001` + instructions-type `002` coexisting today). The three migrations above just become new manifest entries under the next version folder; `run.sh`/`update_per_version.sh` orchestrates them with no additional work.

### Testing strategy

No dedicated test harness exists for these bash scripts today — verify manually (running the scripts directly against various config states: unset, local-only, repo-only, both, `null`, missing files) during implementation/review, consistent with how the rest of this codebase's shell scripts are checked.

### Related follow-up (out of scope here)

A separate, global (cross-project) local arcanum config — distinct from this issue's per-repo `.claude/state/arcanum-config.json` — was raised as a related but out-of-scope idea; tracked as its own follow-up issue rather than folded into this one.

## Benefits

- Fully backward compatible by default — repos that never adopt the new template file or config see byte-for-byte identical commit output.
- Enables real, per-agent GitHub identity/attribution instead of every agent's commits showing the same generic model email.
- Reuses existing, already-tested infrastructure (`arcanum/_lib/repo_config.sh`, the `arcanum/migrations/repos/<version>/` manifest, `run.sh`'s interactive flow) rather than introducing a new templating engine or a new master script.

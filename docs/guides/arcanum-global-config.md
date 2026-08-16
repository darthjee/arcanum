# Guide: The Arcanum Global Config

Arcanum has a third, outermost configuration layer, on top of the two
per-repo files described in [`arcanum-repo-config.md`](arcanum-repo-config.md):
a **global**, cross-project file, scoped to your active Claude Code
account/profile rather than to any one repo.

## Where it lives

```
${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json
```

This is the same `CLAUDE_CONFIG_DIR` environment variable Claude Code
itself uses to relocate its own config directory for multi-account
setups — so if you run multiple accounts on the same machine (e.g.
`claude-d`, `claude-f`), each one automatically gets its own,
independent arcanum global config, with no extra setup on arcanum's
side.

It's a bare `arcanum-config.json` file, same base name as the per-repo
local-state file (`.claude/state/arcanum-config.json`), just living
outside every repo instead of inside one. The lock file used during
writes lives alongside it (`arcanum-config.json.lock`).

## Why it exists

Without this layer, a setting you configure in one repo (e.g. your
personal commit-author email pattern, via
[migration `002.sh`](../../arcanum/migrations/repos/0.14.0/002.md))
only applies to that one repo — every other project you work in asks
you the same question again. The global tier lets you set a personal
default once and have it picked up automatically everywhere, while
still letting any individual repo override it with its own explicit
setting.

## Resolution order

```
local repo state  ->  repo config  ->  global user config  ->  hardcoded default
```

This mirrors git's own `--local` > `--global` > `--system` precedence: a
repo's own explicit, committed choice always wins over your personal
roaming default, and your personal default always wins over whatever
hardcoded fallback the code would otherwise use. The global tier only
ever applies when the project itself has no opinion.

`arcanum/_lib/config_chain.sh`'s `config_chain_read` is the function
that walks this chain — see
[`docs/agents/architecture/shared-state-and-configuration.md`](../agents/architecture/shared-state-and-configuration.md)
for the implementation details. A JSON `null` value at any tier is
treated the same as an absent key and falls through to the next tier;
an explicit empty string (`""`) is a real value and stops the chain
there.

## Which keys use it

Today, only `git.email` — the per-agent commit-author email pattern
used by `commit_change.sh`/`commit_issue.sh`/`commit_plan.sh` (see
`arcanum/_lib/agent_email.sh`) — is wired into the global chain. Other
namespaced keys (e.g. `auto-fix-all`'s `ignored_check_patterns`) still
only read the two per-repo files; they may adopt the global chain later,
feature by feature.

## The `migrations.version` pointer

Separately from `config_chain_read`'s namespaced-key resolution above,
this same file also carries a `.migrations.version` pointer — the
third, "global" scope in arcanum's per-repo migration manifest
(`arcanum/migrations/repos/<version>/migrations.json`'s `applies_to`),
alongside the existing `"repo"`/`"local"` scopes. A `"global"`-scoped
migration entry is satisfied once this pointer reaches the entry's
version folder — shared machine/account-wide like everything else in
this file, so one repo's run advancing it satisfies every other repo
immediately. Read/written via `global_config_get_version`/
`global_config_set_version` in `arcanum/_lib/global_config.sh` (reusing
`repo_config_get_version`/`repo_config_set_version` against this file's
resolved path), never via `config_chain_read`/`global_config_read`
directly. See
[`docs/agents/architecture/per-repo-migrations.md`](../agents/architecture/per-repo-migrations.md)
and
[`docs/guides/arcanum-repo-version.md`](arcanum-repo-version.md) for
the full three-pointer migration story, including the hard-error
behavior when this file's location can't be resolved.

## How to set it

Two ways:

1. **Let the migration ask you.** A per-repo migration (`applies_to:
   "local"`) offers to set your global `git.email` default the first
   time it reaches any repo on your machine/account where the value
   isn't already set anywhere — locally, in that repo's own config, or
   already in the global file from an earlier repo. It guesses a
   default from your `git config user.email` (e.g. `you@example.com` ->
   `you+{agent}@example.com`) and lets you confirm, type a different
   pattern, or skip. Once answered anywhere, every other repo's copy of
   the same migration finds the global value already set and no-ops —
   you're asked at most once, ever.
2. **Edit the file by hand.** Create/edit
   `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/arcanum-config.json` directly,
   nesting whatever you're adding under the right namespace's key, same
   shape as the per-repo files:
   ```json
   {
     "git": { "email": "you+{agent}@example.com" }
   }
   ```

## Notes

- **Important — `git.email` holds a per-agent *template*, not a static
  address**, exactly like its per-repo counterpart: it must contain the
  literal substring `{agent}`, replaced with the actual agent name
  (`architect`, `backend`, `frontend`, ...) at commit time.
- A malformed/corrupt global file degrades silently to "no value" at
  that tier, same as a malformed per-repo file — it never breaks the
  tiers underneath it.
- If `$HOME`/`CLAUDE_CONFIG_DIR` can't be resolved, the global tier
  simply isn't available — reads return nothing, writes are skipped
  with a warning, and every other tier keeps working normally.
- The file is created with normal default permissions (`644`), same as
  every other arcanum config file — no extra restriction, since it
  already lives under your own home directory.

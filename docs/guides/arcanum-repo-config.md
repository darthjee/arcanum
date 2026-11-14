# Guide: The Arcanum Repo Config Move

Arcanum's configuration used to live in feature-specific files. It now lives in two namespaced files shared by every feature. The old files are no longer read by any arcanum script, so a value that exists only in an old file has no effect. Run `/arcanum-migrate` to copy any remaining values forward; a pending migration (#906) then deletes the old files.

## What changed

Arcanum configuration used to live in files named after the one feature that used them:

| Old (legacy) file | New file |
| --- | --- |
| `.claude/configuration/auto-fix-all.json` | `.claude/configuration/arcanum-repo-config.json` |
| `.claude/state/auto-fix-all-config.json` | `.claude/state/arcanum-config.json` |
| `.claude/configuration/monitor-issues.json` | `.claude/configuration/arcanum-repo-config.json` (under `"monitor-issues"`) |
| `.claude/state/monitor-issues-config.json` | `.claude/state/arcanum-config.json` (`.monitor-issues.clear_context`) |

The new files are shared across every arcanum feature, each keeping its own key inside them — e.g. everything `auto-fix-all` reads/writes lives under a top-level `"auto-fix-all"` key:

```json
{
  "auto-fix-all": {
    "ignored_check_patterns": ["Codacy"]
  }
}
```

`monitor-issues` follows the same layout under a top-level `"monitor-issues"` key: its `clear_context` toggle lives in `.claude/state/arcanum-config.json` as `{"monitor-issues": {"clear_context": true}}`, and any other key lives in `.claude/configuration/arcanum-repo-config.json`. `clear_context` has no legacy-file fallback — the non-skippable local migration `arcanum/migrations/repos/2.2.0/001.sh` copies an existing `.claude/state/monitor-issues-config.json` value forward instead (run `/arcanum-migrate`). Other `monitor-issues` keys are read only from `.claude/configuration/arcanum-repo-config.json`; `.claude/configuration/monitor-issues.json` is no longer read.

This lets future arcanum features store their own settings (under their own key) without colliding with `auto-fix-all`'s, or inventing yet another ad-hoc file.

## No fallback

Every script that reads this configuration (`auto-fix-all/scripts/config.sh`, `auto-fix-all/scripts/wait_ci.sh`, `monitor-issues/scripts/config.sh`, `init-claude`'s set-ci-ignored-patterns, and their `core/` counterparts) reads only the new files, through the config chain described in [`config-keys.md`](../agents/architecture/config-keys.md). The legacy `.claude/configuration/auto-fix-all.json` and `.claude/configuration/monitor-issues.json` are neither read nor used to seed a namespace on write. If one is still present it is silently ignored, with no warning; a pending migration (#906) deletes it.

## How to migrate

Two ways, either is fine:

1. **Run `/arcanum-migrate`** — the migration this issue shipped (`arcanum/migrations/repos/*/001.sh`) copies both legacy files' contents into the new ones under the `auto-fix-all` key, then leaves the legacy files in place (harmless — they're no longer read; #906's pending migration deletes them). This is safe to re-run.
2. **Re-run `/init-claude`** — `init-claude/setup_auto_fix_all_settings.md` already writes straight to the new files going forward, so re-running that step has the same effect for the keys it manages.

You can also edit `.claude/configuration/arcanum-repo-config.json` / `.claude/state/arcanum-config.json` by hand — just nest whatever you're adding under the right feature's key.

### From a terminal

The [`arcanum` CLI](arcanum-cli.md) (`npm i -g arcanum-cli`) edits this
pair of files for you, with validation and the same write lock the
skills use:

```bash
arcanum config set <key> <value> --repo    # .claude/configuration/arcanum-repo-config.json
arcanum config set <key> <value> --local   # .claude/state/arcanum-config.json
```

The CLI writes only the new files above, never the legacy ones. See the
[CLI user guide](arcanum-cli.md) for every command and shortcut.

## Per-repo migrations use this same pair of files, for two independent version pointers

The top-level `.version` field on `arcanum-repo-config.json` (committed, shared via git) and the namespaced `.migrations.version` field on `arcanum-config.json` (gitignored, local per clone) each track how far this repo/clone has caught up on `arcanum/migrations/repos/<version>/migrations.json`'s entries — one pointer per entry `applies_to` scope (`"repo"` or `"local"`). See `docs/guides/arcanum-repo-version.md` for why there are two pointers instead of one, and `docs/agents/architecture/per-repo-migrations.md` for the full `migrations.json` schema.

`type: "instructions"` entries additionally rely on `.claude/state/arcanum-migrations-ledger.json` for per-entry resume tracking — deliberately *not* part of this config-file pair (it isn't a version pointer and doesn't route through `repo_config.sh`); see `docs/guides/arcanum-repo-version.md`'s "A third tracker" section.

## Documented keys

Full list of keys and where each is read from: [Config Keys](../agents/architecture/config-keys.md). Each key's type, allowed tiers and default are in [`keys.json`](../../shared/lib/config/keys.json) (see [Config Keys](../agents/architecture/config-keys.md)); `/arcanum-check-config <key>` shows where a value resolves from.

A few `git`-namespaced keys, read through this config pair (and, for
some of them, the global tier described below), control commit
behavior directly:

| Key | Notes |
| --- | --- |
| `git.agents` | Per-agent explicit `agent name -> concrete email` mapping, consulted before `git.email` at each tier (see `arcanum/_lib/agent_email.sh`). Lets multiple agent names share a single GitHub identity instead of requiring one dedicated account per agent name. See [`arcanum-global-config.md`](arcanum-global-config.md). |
| `git.email` | Per-agent commit-author email pattern used by `commit_change.sh`/`commit_issue.sh`/`commit_plan.sh` (see `arcanum/_lib/agent_email.sh`). See [`arcanum-global-config.md`](arcanum-global-config.md). |
| `git.safe_branch` | The ref `arcanum/_lib/safe_branch.sh` checks out via `enhance-issue`/`discuss-issue`/`arcanum-split-issue`. See [Branch Bootstrap and Merge Conflicts](../agents/architecture/branch-bootstrap-and-merge-conflicts.md). |
| `git.omit_model_coauthor` | When `true`, `auto-fix-issue`/`auto-new-issue`/`auto-plan-issue`/`auto-fix-all`'s commit scripts (`commit_change.sh`, `commit_issue.sh`, `commit_plan.sh`, `cleanup_artifacts.sh`) skip emitting the model's `Co-Authored-By` trailer, keeping only the agent's own line. The agent's line is dropped too when its email resolves to the model's email (no `git.agents.<agent>`/`git.email` configured, or the old commit template engine), so the commit may carry no `Co-Authored-By` trailer at all. See [`arcanum-global-config.md`](arcanum-global-config.md). |
| `git.merge_body_mode` | Controls the squash-merge commit body used by `auto-fix-all`'s `github.sh pr-merge` (`cmd_pr_merge`, see `arcanum/_lib/merge_body.sh`). `empty` keeps today's behavior (`--body ""`); `full` omits `--body` so GitHub/`gh` picks its own default squash body; `coauthors` builds `--body` from the deduped `Co-authored-by:` trailers found across the PR's commits (excluding the merger's own login, and the model's own line when `git.omit_model_coauthor` is `true`), falling back to `full`'s behavior if the resulting list is empty. An unrecognized value warns to stderr and falls back to `empty`. See [`arcanum-global-config.md`](arcanum-global-config.md). Seeded, optionally, by three per-scope migrations (`arcanum/migrations/repos/0.16.1/001`–`003`, `applies_to`: `local`/`repo`/`global`). |

A `next_step`-namespaced key per skill lets a next-step offer
continue automatically instead of prompting:

| Key | Notes |
| --- | --- |
| `next_step.auto.enhance-issue` | When `true`, `enhance-issue`'s `/discuss-issue <id>` offer is skipped and the command runs automatically. |
| `next_step.auto.discuss-issue` | When `true`, `discuss-issue`'s first offer (`/auto-plan-issue <id>`) is skipped and the command runs automatically. |
| `next_step.auto.auto-plan-issue` | When `true`, the `/loop /auto-resolve-issue <id>` offer made once a plan exists (`auto-plan-issue`, `discuss-issue`'s second offer, `plan-issue`) is skipped and the command runs automatically. |

Only the JSON boolean `true` enables a key; the string `"true"` or any
other value counts as `false`. Each key is read by
`arcanum/_lib/next_step_prompt.sh --auto-key <skill>` (see
[Skill Finish](../agents/architecture/skill-finish.md#auto-next)). To
set them, run `/init-claude` (its auto-next step writes repo config)
or `/arcanum-migrate`, which offers three skippable migrations, one
per tier (local, repo, global), each asking `[Y]es/[N]o/[S]kip` per
key. An explicit `false` shadows a `true` in a lower tier. Run `/arcanum-check-config next_step.auto.<skill>` to see
which tier a value resolves from.

A second key per skill asks for the conversation context to be cleared
at that automatic hop. A clear key only does something when the
matching `next_step.auto.<skill>` is `true`; with auto off it is never
read:

| Key | Notes |
| --- | --- |
| `next_step.clear.enhance-issue` | When `true` (and `next_step.auto.enhance-issue` is `true`), the automatic `/discuss-issue <id>` hop is reported with `CLEAR=true`, asking for the context to be cleared before it runs. |
| `next_step.clear.discuss-issue` | When `true` (and `next_step.auto.discuss-issue` is `true`), the automatic `/auto-plan-issue <id>` hop is reported with `CLEAR=true`. |
| `next_step.clear.auto-plan-issue` | When `true` (and `next_step.auto.auto-plan-issue` is `true`), the automatic `/loop /auto-resolve-issue <id>` hop is reported with `CLEAR=true` (also forwarded by `auto-plan-issue/scripts/auto_next.sh` with `CHAIN=yes`). |

The clear keys follow the same rules as the auto keys: only the JSON
boolean `true` enables one, and an explicit `false` shadows a `true` in
a lower tier. A manual `[Y]es` never clears; clearing applies only to
automatic hops. `/init-claude`'s auto-next step offers them in the same
table as the auto keys (a `Clear` column, written to repo config). No
`/arcanum-migrate` migration sets them yet. Run
`/arcanum-check-config next_step.clear.<skill>` to see which tier a
value resolves from. On `CLEAR=true`, skills hand the next command off
to a cleared context as described in
[Clearing](../agents/architecture/skill-finish.md#clearing).

## A third, global tier on top of this pair

Both files described above are repo-scoped — neither survives outside
the repo it lives in. There's also a third, outermost tier, global and
cross-project (scoped to your Claude Code account/profile instead of
any one repo), consulted only when neither of these two has a value
for a given key. See [`arcanum-global-config.md`](arcanum-global-config.md)
for the full resolution order and how to set it.

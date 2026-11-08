# Per-tier matrix (`--all-tiers`)
Make `arcanum config agents email --all-tiers` render every agent × every tier, so the user sees where an email is set and where it isn't.

**Flags.** In `checkReadFlags()` accept `--all-tiers` only on the listing form (no positional). Keep refusing tier flags (`--local`/`--repo`/`--global`) and `--unset` on read forms, and keep refusing `--all-tiers` on the detail form (`agents email <agent>`), with the existing "it always shows every tier" message. The plain listing (no flag) and its JSON (`{ default, agents }`) must stay byte-for-byte unchanged.

**Rows.** Reuse `readEmailTiers()` + `repoAgents()` + `configuredAgents()` for the same agent set and order as the listing. Row `(default)` shows the raw `git.email` per tier; each agent row shows the raw `git.agents.<agent>` per tier (`-` when absent or `null`, `""` for an explicit empty string).

**Marks** (per row, from `AgentEmail#resolve` / `configChain.readWithSource`): which tier/key resolves — including when an agent resolves from `git.email` (show the `{agent}`-substituted email, e.g. `<- global (default: you+mod@x.com)`); values that are set but lose (shadowed — remember a higher-tier `git.email` beats a lower-tier `git.agents.<agent>`); `(model default)` when nothing resolves or an explicit `""` wins (say where it sits); `(not in this repo)` for configured agents absent from `.claude/agents/`; `(no target)` for local/repo columns outside a repo (only configured-in-global agents are listed there). Malformed tier files keep the generic read warnings and the readable tiers still render.

**JSON** (`--all-tiers --json`), a new shape:

```json
{"files":{"local":"…/state.json","repo":"…/arcanum-repo-config.json","global":"…"},
 "default":{"tiers":{"local":{"set":false,"value":null},"repo":{"set":false,"value":null},"global":{"set":true,"value":"you+{agent}@x.com"}},
            "resolved":{"set":true,"value":"you+{agent}@x.com","source":"global"}},
 "agents":[{"agent":"node","in_repo":true,
            "tiers":{"local":{"set":false,"value":null},"repo":{"set":true,"value":"node@x.com"},"global":{"set":false,"value":null}},
            "resolved":{"email":"node@x.com","source":"repo","key":"git.agents.node"}}]}
```

`files.<tier>` is `null` for a tier with no target; `in_repo` is `null` outside a repo; `resolved` uses the same fields/nulls as the listing rows. Exit `0` always (like the listing).

Specs: human + JSON output; precedence/shadowing (higher-tier `git.email` vs lower-tier `git.agents.<agent>`); `{agent}` substitution; `""` and `null`; not-in-repo agents; outside a repo (no repo-like files read); nothing configured (only the `(default)` row); flag refusals (tier flags, `--unset`, `--all-tiers` on the detail); plain listing output unchanged.

## Files to Change
- `cli/lib/commands/config/shortcuts/agentsEmail.js` — accept `--all-tiers` on the listing, dispatch to the matrix.
- `cli/lib/commands/config/shortcuts/agentsEmailMatrix.js` (new, optional split) — build the matrix data and its human rendering, reused by the editor.
- `cli/spec/lib/commands/config/shortcuts/agentsEmail_spec.js` (or a new `agentsEmailMatrix_spec.js`) — the specs above.

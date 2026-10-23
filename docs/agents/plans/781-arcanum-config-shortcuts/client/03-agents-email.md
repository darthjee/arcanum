# agents email
Implement `config agents email` (spec "`agents email`": Resolution, Which agents are listed, Listing, Detail, Writes).

- Resolution goes only through `AgentEmail#resolve`. Don't reimplement it. `email === undefined` with a `tier`/`key` set is the explicit-`""` case and shows `(model default)   (empty at <tier>: <key>)`. A missing result is `(model default)` with `source: null`.
- Agents listed: the union of `git.agents.*` keys in every tier and the basenames of `.claude/agents/*.md` in the target repo (other files are ignored). Agents not in the repo are marked `(not in this repo)`. Outside a repo, only configured agents are listed and `in_repo` is `null`. Rows are sorted by name.
- Listing: a `default` line with the raw `git.email` (`{agent}` not substituted) and its tier, then the rows. Always exit `0`.
- Detail `<agent>`: a per-tier breakdown of `git.agents.<agent>` and `git.email`, with the resolved key marked and shadowed keys marked. `"file": null` for a tier with no target. Exit `1` when nothing resolves.
- Writes: `set <pattern>` writes `git.email`, `set <agent> <email>` writes `git.agents.<agent>` (told apart by arity), and `unset [<agent>]` does the same for unset. The default tier is global, with output from the generic `set`/`unset`.

## Files to Change
- `cli/lib/commands/config/shortcuts/agentsEmail.js` (new) — the listing, detail and write forms.
- `cli/spec/lib/commands/config/shortcuts/agentsEmail_spec.js` (new) — resolution cases reusing the `AgentEmail` shell/native parity fixture table from `shared/spec`. Copy or share the table data through a CLI-side fixture, since `cli/` must not import `shared/spec/**`. Also: listing in and outside a repo, a configured agent not in the repo, a non-`.md` file in the agents folder, the detail view including exit `1`, and the write forms against the generic commands.

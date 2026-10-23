# Identity per-agent overrides and the ci array loop
Handle the two items that are not plain scalars.

- **Identity.** After `git.email`, ask `customise per-agent emails? [y/N]`. The default is no, and the question is skipped when there is no repo.
  - On yes, list `repoAgents(root)` (sorted) and run the step-02 flow once per agent on `git.agents.<agent>`.
  - The "current" line also shows what the `git.email` pattern resolves to for that agent, using `AgentEmail.resolve` (as `agents email <agent>` does), e.g. `currently resolves to: node-bot@example.com (git.email, global)`.
  - A repo with no `.claude/agents/*.md` skips this with a note.
- **ci (`auto-fix-all.ignored_check_patterns`, repo-only).**
  - Show the current list, using `storedPatterns`. A non-array value marks the item failed, with `NOT_ARRAY_HINT`, and moves on.
  - Then loop over `[a]dd / [r]emove / [d]one`.
    - `a` asks for one pattern and validates it with `new RegExp`; invalid patterns re-ask.
    - `r` asks for one pattern from the list.
  - Each change is confirmed (`[Y/n]`) and written immediately, through the same atomic path as `ignore-checks add/remove`: `writeKey({op: 'update'})` with `applyPatterns`. Factor the reusable core out of `editPatterns` if needed, so the lock re-read semantics are identical.
  - Each written change is its own summary row; `d` ends the item.

**Specs:**
- the per-agent opt-in, both no and yes with two agents, including the resolved-pattern line;
- no agents folder;
- the `ci` loop: add, add a duplicate, add an invalid regex then re-ask, remove, remove a missing pattern, done;
- a non-array stored value.

## Files to Change
- `cli/lib/commands/config/setup.js` (or `setup/identity.js`, `setup/ci.js`) — the two special items.
- `cli/lib/commands/config/shortcuts/ignoreChecks.js` — export a reusable `updatePatterns(context, {verb, patterns})` core, if needed.
- `cli/spec/lib/commands/config/setup_spec.js` — the identity and ci specs.

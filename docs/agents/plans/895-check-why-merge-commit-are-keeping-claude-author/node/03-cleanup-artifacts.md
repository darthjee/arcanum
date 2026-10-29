# Use it in the cleanup command and update its specs

In `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js`, add `configChain` / `agentEmail` / `coauthorTrailers` constructor deps (same defaults pattern as the other commit commands) and rewrite `_commit` to build `chore(docs): remove planning artifacts (issue #<id>)` followed — only when non-empty — by a blank line and `await this._coauthorTrailers.lines(repoPath, 'architect', modelName, modelEmail)`. Update the `_commit`/`run` JSDoc, which currently says it deliberately mirrors the hardcoded heredoc rather than `agent_email.sh`. CLI signature and usage message stay unchanged.

Specs:
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js` — expected messages for omit false (model line + `architect agent <architect email>`), omit true with architect email (architect line only), omit true without agent email (no trailers), old template engine.
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js` — isolate the global config tier (`HOME`/`CLAUDE_CONFIG_DIR` pointing at a temp dir, as the other commit parity specs do) and add cases seeding `.claude/configuration/arcanum-repo-config.json` with `omit_model_coauthor` true/false and with/without `git.agents.architect`, asserting byte-identical output and identical commit messages between the shell and native runs.

## Files to Change
- `core/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts.js` — use `CoauthorTrailers` with agent `architect`.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllCleanupArtifacts_spec.js` — new trailer expectations.
- `core/spec/bin/autoFixAllCleanupArtifactsParity_spec.js` — config isolation + omit/agent-email cases.

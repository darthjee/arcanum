# Add AgentEmail and replace the _agentEmailGet copies

Create `core/lib/utils/config/AgentEmail.js`, importing only `./ConfigChain.js` (constructor takes an injectable `configChain`, defaulting to `new ConfigChain()`):

- `resolve(repoPath, agent)` → `{ email, raw, tier, key } | undefined`, built on `readWithSource(repoPath, 'git', \`agents.${agent}\`, 'email')`. `raw` is the value before substitution (stringified with `String(value)`); `email` is `raw.replaceAll('{agent}', () => agent)`, or `undefined` when `raw === ''`. `key` is reported as the full dotted key (`git.agents.<agent>` / `git.email`).
- `get(repoPath, agent, modelEmail)` → `resolve(...)?.email || modelEmail`. **Deliberate fix:** a resolved `""` now yields `modelEmail`, matching `agent_email.sh`.

Replace `_agentEmailGet` in `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan` (agent `architect`) and `AutoFixIssueCommitChange` with an injected `AgentEmail` (built from the same `configChain` so existing spec injection keeps working). Update their specs, adding a `""` case.

**Shell/native parity:** add one shared fixture table, `core/spec/support/fixtures/agentEmailFixtures.js` (tier setups → expected email: absent, `null`, `""`, agent-specific only, generic only, generic at repo beats specific at global, `{agent}` substitution). Exercise it from:
- `core/spec/lib/utils/config/AgentEmail_spec.js` (native `get` / `resolve`);
- a parity spec, `core/spec/bin/agentEmailParity_spec.js`, that seeds a temp repo + temp `CLAUDE_CONFIG_DIR` per row and runs `bash -c 'cd "$1" && source <repo>/arcanum/_lib/agent_email.sh && agent_email_get "$2" "$3"'`, asserting the same expected email (follow the existing `core/spec/bin/*Parity*` helpers in `core/spec/support/utils/`).

`arcanum/_lib/agent_email.sh` is not modified.

## Files to Change
- `core/lib/utils/config/AgentEmail.js` — new.
- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js`, `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js`, `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — drop `_agentEmailGet`, use `AgentEmail#get`.
- Their specs under `core/spec/lib/commands/…` — adapt; add the `""` → model email case.
- `core/spec/support/fixtures/agentEmailFixtures.js` — new shared table.
- `core/spec/lib/utils/config/AgentEmail_spec.js` — new.
- `core/spec/bin/agentEmailParity_spec.js` — new shell parity spec.

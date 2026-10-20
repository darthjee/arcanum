# Architect Plan: Shared config key registry

Main plan: [plan.md](plan.md)

## Shared contracts

- The registry lives at `core/lib/utils/config/keys.json`, owned by `node`.

## Implementation Steps

### Step 1 — Docs rule checklist
Add the rule "adding a config key means adding a `core/lib/utils/config/keys.json` entry (and `# config-key:` annotations on unparseable shell calls)" as a checklist item in:

- `docs/agents/architecture/shared-state-and-configuration.md`. Also add a short paragraph pointing at the registry as the source of truth for key types, tiers and defaults, and mention `next_step.clear.<skill>` in the tier rows where `next_step.auto.<skill>` already appears, if missing.
- `.claude/agents/node.md`, under Conventions.

### Step 2 — Spec seed list correction
Update `docs/agents/specs/arcanum-cli/key-registry.md`'s seed table to add `next_step.clear.<skill>` (boolean, all, `false`, no `setup`), introduced by #796 after the audit, so the spec and `keys.json` agree.

## Files to Change
- `docs/agents/architecture/shared-state-and-configuration.md` — checklist item and registry pointer.
- `.claude/agents/node.md` — convention bullet.
- `docs/agents/specs/arcanum-cli/key-registry.md` — add `next_step.clear.<skill>` to the seed table.

## Notes
- If scripter does not own `.claude/agents/scripter.md`, the architect makes that edit too, with the wording from scripter.md Step 2.

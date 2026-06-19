# Determine Agent Split

The goal is to decide whether the plan should be a single generic `plan.md`, or split into one file per specialist agent plus an overview `plan.md`.

## List the agents configured in the target project

Run:

```bash
scripts/list_agents.sh
```

(defaults to `.claude/agents`; pass a different path only if the project documents one elsewhere).

Each line of output has the form `<name>|<description>`.

- **No output (empty)** — the target project has no specialist agents configured. Skip straight to "No split" below.
- **One or more lines** — proceed to "Exclude the coordinator".

## Exclude the coordinator

If one of the listed agents is clearly a coordinator/orchestrator rather than an implementation specialist — e.g. its description mentions things like "coordinator", "coordinates other agents", "writes plans/skills", "spans more than one agent's scope" — exclude it from the split. A project may or may not have such an agent; do not assume one exists.

The remaining agents are the **candidate agents**.

If excluding the coordinator leaves zero candidate agents, treat this the same as "no agents configured" — skip to "No split" below.

## No split

Set `AGENT_SPLIT=false`. The plan will be a single `plan.md` with no `## Agents involved` or `## Shared contracts` sections (same shape as the interactive `plan-issue` skill).

## Decide which candidate agents have work

For each candidate agent, read its `description` and judge — based on the issue and the codebase exploration from the previous step — whether this issue requires changes within that agent's scope.

- If **none** of the candidate agents have work (unlikely, but possible for a purely cross-cutting issue), fall back to "No split" above.
- If **exactly one** candidate agent has work, set `AGENT_SPLIT=false` but still write that agent's plan as the single `plan.md` content (no need for a separate file or a "Shared contracts" section, since there is nothing to share) — there's no benefit to splitting when only one agent is involved.
- If **two or more** candidate agents have work, set `AGENT_SPLIT=true` and record the list of involved agents (name + description). This list drives Step 4.

## Identify shared contracts (only when AGENT_SPLIT=true)

When two or more agents are involved, identify what crosses the boundary between them: any interface, data shape, contract, or dependency that one agent's work produces and another agent's work consumes. Examples (generalize to whatever applies to this project and these agents — do not assume a fixed set of pairs):
- An API surface one agent exposes and another calls (endpoint, method, payload shape, field names and types)
- A shared schema, config key, or environment variable
- A build, deployment, or infrastructure change one agent depends on another to provide

Write this down precisely (names, types, exact values where known) — it becomes the single source of truth copied into each involved agent's plan file in Step 4.

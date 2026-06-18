# Setup Agents

Create the `.claude/agents/` directory with one Markdown file per agent, including an `architect` agent that coordinates the others.

## Step 1 — Detect existing agents

Check whether `.claude/agents/` already exists and list its contents.

- If agent files already exist, read them. Their content is the baseline — preserve scopes and conventions already documented, only filling gaps or applying changes the user requests.
- If the directory does not exist or is empty, proceed to Step 2 from scratch.

## Step 2 — Discuss agents with the user

Tell the user:

```
Now let's set up .claude/agents/. Each agent is a specialist Claude Code sub-agent scoped to part of the codebase, plus an `architect` agent that coordinates them.
```

Common agents seen across projects: `frontend`, `backend`, `infra`. These are only examples — do not assume any of them apply.

Ask the user:

```
Which agents should this project have, and what is each one's scope (which folders/files it owns) and responsibility?
```

Wait for the user's answer. Clarify with follow-up questions if a scope is ambiguous or overlaps with another agent's scope. Two agents should not own the same files.

There is always exactly one coordinator agent, conventionally named `architect`. If the user didn't mention it, confirm that `architect` will be created as the coordinator, owning:
- `docs/agents/`
- root-level files (`README.md`, `AGENTS.md`, `CLAUDE.md`, and similar)
- cross-cutting decisions spanning more than one specialist agent's scope

## Step 3 — Gather details for each specialist agent

For each non-coordinator agent the user listed, gather (asking only for what isn't already obvious from the codebase):

1. **Scope** — which folder(s) or files it owns; what it must NOT touch.
2. **Stack** — languages, frameworks, package manager, linters, test runner.
3. **Conventions** — code style, naming, test structure, anything project-specific.
4. **Commands** — how to run tests/lint/build for this scope (exact commands, including any required wrapper like `docker-compose run`).

## Step 4 — Draft the agent files

Draft one file per agent using this structure:

For specialist agents:

```markdown
---
name: <agent-name>
description: <Project> <agent-name> specialist. Use for any task involving <short list of triggers: languages, frameworks, directories>.
tools: Read, Edit, Write, Bash
---

You are the <agent-name> specialist for the <project> project — <one-line project description>.

## Your scope

You own everything inside `<scope-path>/`:

- <subfolder> — <role>

Do NOT touch <other agents' scopes> or any file outside `<scope-path>/`.

## Stack

- <languages, frameworks, tools>

## Commands

<exact commands to run tests/lint/build for this scope>

## Conventions

- <project-specific conventions gathered in Step 3>
```

For the `architect` agent:

```markdown
---
name: architect
description: <Project> architect and coordinator. Use for cross-cutting tasks, multi-agent coordination, documentation, root-level files, or any task that spans more than one agent's scope.
tools: Read, Edit, Write, Bash, Agent
---

You are the architect and coordinator for the <project> project — <one-line project description>.

## Your scope

- `docs/agents/` — all project documentation
- Root-level files: <list>
- Cross-cutting decisions that span multiple layers
- Coordination of the other specialist agents

## Specialist agents

Delegate implementation work to the right agent. Never implement what belongs to a specialist yourself.

| Agent | Scope |
|-------|-------|
| `<agent-name>` | `<scope-path>/` — <one-line summary> |

## How to coordinate

When a task spans multiple agents:

1. **Break it down** — identify which parts belong to which agent.
2. **Sequence or parallelize** — if agents' outputs are independent, run them in parallel; if one depends on the other, sequence them.
3. **Integrate** — after specialist agents finish, verify cross-cutting concerns.
4. **Update docs** — reflect any architectural change in `docs/agents/`.

## Documentation (`docs/agents/`)

<reuse the Documentation table already present in AGENTS.md, if any>

Keep documentation up to date after any architectural change. When a new agent is created or its scope changes, update this file and `AGENTS.md`.
```

Adapt section names and content to what the project actually has — do not invent stack details, domain models, or commands that weren't gathered or found in the codebase.

## Step 5 — Present drafts and ask for confirmation

Show all drafted agent files to the user and ask:

```
These are the proposed agents under .claude/agents/. Shall I write them, or would you like to make changes?
```

Wait for the user's response.

- If the user confirms: proceed to write the files.
- If the user requests changes: apply them and ask again before writing.

## Step 6 — Write the agent files

Ensure `.claude/agents/` exists, then write (or overwrite) one file per agent: `.claude/agents/<agent-name>.md`.

## Step 7 — Confirm

Tell the user:

```
.claude/agents/ written:
- architect.md
- <agent-name>.md (one per specialist agent)

Keep these in sync with AGENTS.md and docs/agents/ as scopes evolve.
```

# Scenario: No existing configuration files

Neither `CLAUDE.md` nor `.github/copilot-instructions.md` exist. Both will be created, along with a shared `AGENTS.md`.

## Step 1 — Announce the intent

Tell the user:

```
No configuration files found. The following files will be created:
- AGENTS.md       (shared project instructions)
- CLAUDE.md       (points to AGENTS.md)
- .github/copilot-instructions.md  (points to AGENTS.md)
```

## Step 2 — Collect project context

Ask the user the following questions (can be answered together):

1. What is the project about? (brief description)
2. What language(s) and framework(s) does it use?
3. Are there any coding conventions or important rules to document? (optional)

Wait for the user's response before proceeding.

## Step 3 — Create AGENTS.md

Create `AGENTS.md` in the current working directory with the following structure:

```markdown
# Project Instructions

<brief description provided by the user>

## Stack

<languages and frameworks>

## Conventions

<conventions if provided, otherwise omit this section>
```

## Step 4 — Create CLAUDE.md

Create `CLAUDE.md` in the current working directory with the following content:

```markdown
See [AGENTS.md](AGENTS.md) for project instructions.
```

## Step 5 — Create .github/copilot-instructions.md

Ensure the `.github/` directory exists, then create `.github/copilot-instructions.md` with:

```markdown
See [AGENTS.md](../AGENTS.md) for project instructions.
```

## Step 6 — Confirm completion

Tell the user:

```
Done! Files created:
- AGENTS.md
- CLAUDE.md
- .github/copilot-instructions.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

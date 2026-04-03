# Scenario: Only .github/copilot-instructions.md exists

`CLAUDE.md` is absent but `.github/copilot-instructions.md` exists. Its content will be migrated to a new `AGENTS.md`, then both files will point to it.

## Step 1 — Announce the intent

Tell the user:

```
Found .github/copilot-instructions.md. Its content will be migrated to AGENTS.md.
The following changes will be made:
- AGENTS.md                          (created with current copilot-instructions content)
- CLAUDE.md                          (created, pointing to AGENTS.md)
- .github/copilot-instructions.md    (replaced, pointing to AGENTS.md)
```

## Step 2 — Ask for confirmation

Ask:

```
Shall I proceed?
```

Wait for the user's response.

- If the user confirms: proceed.
- If the user declines: stop.

## Step 3 — Create AGENTS.md

Read the current content of `.github/copilot-instructions.md` and create `AGENTS.md` in the current working directory with that exact content.

## Step 4 — Create CLAUDE.md

Create `CLAUDE.md` in the current working directory with:

```markdown
See [AGENTS.md](AGENTS.md) for project instructions.
```

## Step 5 — Replace .github/copilot-instructions.md

Overwrite `.github/copilot-instructions.md` with:

```markdown
See [AGENTS.md](../AGENTS.md) for project instructions.
```

## Step 6 — Confirm completion

Tell the user:

```
Done! Migration complete:
- AGENTS.md — contains the former copilot-instructions content
- CLAUDE.md — created, pointing to AGENTS.md
- .github/copilot-instructions.md — now points to AGENTS.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

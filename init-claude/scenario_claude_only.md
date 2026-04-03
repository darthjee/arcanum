# Scenario: Only CLAUDE.md exists

`.github/copilot-instructions.md` is absent but `CLAUDE.md` exists. Its content will be migrated to a new `AGENTS.md`, then both files will point to it.

## Step 1 — Announce the intent

Tell the user:

```
Found CLAUDE.md. Its content will be migrated to AGENTS.md.
The following changes will be made:
- AGENTS.md                          (created with current CLAUDE.md content)
- CLAUDE.md                          (replaced, pointing to AGENTS.md)
- .github/copilot-instructions.md    (created, pointing to AGENTS.md)
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

Read the current content of `CLAUDE.md` and create `AGENTS.md` in the current working directory with that exact content.

## Step 4 — Replace CLAUDE.md

Overwrite `CLAUDE.md` in the current working directory with:

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
Done! Migration complete:
- AGENTS.md — contains the former CLAUDE.md content
- CLAUDE.md — now points to AGENTS.md
- .github/copilot-instructions.md — created, pointing to AGENTS.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

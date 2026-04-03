# Scenario: Only AGENTS.md exists

`CLAUDE.md` and `.github/copilot-instructions.md` are absent but `AGENTS.md` already exists. Both files will be created pointing to it.

## Step 1 — Announce the intent

Tell the user:

```
Found AGENTS.md. The following files will be created pointing to it:
- CLAUDE.md                          (created, pointing to AGENTS.md)
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

## Step 3 — Create CLAUDE.md

Create `CLAUDE.md` in the current working directory with:

```markdown
See [AGENTS.md](AGENTS.md) for project instructions.
```

## Step 4 — Create .github/copilot-instructions.md

Ensure the `.github/` directory exists, then create `.github/copilot-instructions.md` with:

```markdown
See [AGENTS.md](../AGENTS.md) for project instructions.
```

## Step 5 — Confirm completion

Tell the user:

```
Done! Files created:
- CLAUDE.md — pointing to AGENTS.md
- .github/copilot-instructions.md — pointing to AGENTS.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

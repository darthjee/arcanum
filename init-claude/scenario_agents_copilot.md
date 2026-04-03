# Scenario: AGENTS.md and copilot-instructions.md exist, CLAUDE.md absent

`AGENTS.md` and `.github/copilot-instructions.md` exist but `CLAUDE.md` does not. The content of both will be consolidated into `AGENTS.md`, then `copilot-instructions.md` will point to it and `CLAUDE.md` will be created.

## Step 1 — Announce the intent

Tell the user:

```
Found AGENTS.md and .github/copilot-instructions.md. Their contents will be consolidated into AGENTS.md.
The following changes will be made:
- AGENTS.md                          (updated with consolidated content)
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

## Step 3 — Read both files

Read the full content of:
- `AGENTS.md`
- `.github/copilot-instructions.md`

## Step 4 — Consolidate into AGENTS.md

Merge both contents into a single coherent document. Follow these rules:
- Remove duplicate information, keeping only one copy
- Preserve all unique information from both files
- Use the structure and headings that best represent the combined content
- Do not add a preamble explaining the merge — just produce clean, unified instructions

Overwrite `AGENTS.md` with the consolidated content.

## Step 5 — Create CLAUDE.md

Create `CLAUDE.md` in the current working directory with:

```markdown
See [AGENTS.md](AGENTS.md) for project instructions.
```

## Step 6 — Replace .github/copilot-instructions.md

Overwrite `.github/copilot-instructions.md` with:

```markdown
See [AGENTS.md](../AGENTS.md) for project instructions.
```

## Step 7 — Confirm completion

Tell the user:

```
Done! Migration complete:
- AGENTS.md — consolidated content from AGENTS.md and copilot-instructions.md
- CLAUDE.md — created, pointing to AGENTS.md
- .github/copilot-instructions.md — now points to AGENTS.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

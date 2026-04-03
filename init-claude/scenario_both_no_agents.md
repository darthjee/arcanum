# Scenario: CLAUDE.md and copilot-instructions.md exist, AGENTS.md absent

Both `CLAUDE.md` and `.github/copilot-instructions.md` exist but `AGENTS.md` does not. Their contents will be consolidated into a new `AGENTS.md`, then both files will point to it.

## Step 1 — Announce the intent

Tell the user:

```
Found CLAUDE.md and .github/copilot-instructions.md. Their contents will be consolidated into AGENTS.md.
The following changes will be made:
- AGENTS.md                          (created with consolidated content)
- CLAUDE.md                          (replaced, pointing to AGENTS.md)
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
- `CLAUDE.md`
- `.github/copilot-instructions.md`

## Step 4 — Consolidate into AGENTS.md

Merge the two contents into a single coherent document. Follow these rules:
- Remove duplicate information, keeping only one copy
- Preserve all unique information from both files
- Use the structure and headings that best represent the combined content
- Do not add a preamble explaining the merge — just produce clean, unified instructions

Create `AGENTS.md` in the current working directory with the consolidated content.

## Step 5 — Replace CLAUDE.md

Overwrite `CLAUDE.md` with:

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
- AGENTS.md — consolidated content from CLAUDE.md and copilot-instructions.md
- CLAUDE.md — now points to AGENTS.md
- .github/copilot-instructions.md — now points to AGENTS.md

Edit AGENTS.md to keep your project instructions up to date — both Claude and Copilot will read from it.
```

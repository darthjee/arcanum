# Architect Plan: Docker engine: migrate migration-status.json to a status enum

Main plan: [plan.md](plan.md)

## Shared contracts

Documents the map format and reader from [plan.md](plan.md#shared-contracts): string enum `shell`/`native`/`docker`/`host-only`, native-only commands listed, read via `_engine_dispatch_status`. Link to `docs/agents/specs/docker/dispatch.md#docker-readiness-source-of-truth` rather than duplicating the reading-rule table.

## Implementation Steps

### Step 1 — Update architecture and spec docs

- `docs/agents/architecture/script-engine.md`:
  - line ~19: the map is `arcanum/_lib/migration-status.json`, a string enum (link to the dispatch spec), and it answers "which engine may run this command";
  - line ~25: "says no native implementation exists" → "says `shell`";
  - line ~36 (native-only section): native-only commands **are** listed, with `native`/`docker`/`host-only`, never `shell`, and appear in entrypoint-migration-status.md. The `--native-only` path does not consult the map until the docker branch lands.
- `docs/agents/specs/shell-engine-removal.md`:
  - precondition (line ~15) → "No entry in `arcanum/_lib/migration-status.json` is `shell`";
  - line ~36: drop "and are not listed in `migration-status.json`" (say they are listed, never as `shell`).
- `docs/agents/architecture/arcanum-create-issue.md` line ~30: "neither is in `migration-status.json`" → both are listed as `"native"`.
- `docs/agents/architecture/skill-finish.md` line ~103: "`finish-report` is `true`" → "`finish-report` is `\"native\"`".

### Step 2 — Update agent definitions

- `.claude/agents/node.md` line ~26: replace "Do not add them to `arcanum/_lib/migration-status.json`" with "Add them to `arcanum/_lib/migration-status.json` as `\"native\"`, never `\"shell\"`".
- `.claude/agents/scripter.md`: wherever it describes the map or native-only shims, use the same wording (enum; native-only listed).

## Files to Change

- `docs/agents/architecture/script-engine.md`
- `docs/agents/specs/shell-engine-removal.md`
- `docs/agents/architecture/arcanum-create-issue.md`
- `docs/agents/architecture/skill-finish.md`
- `.claude/agents/node.md`
- `.claude/agents/scripter.md`

## Notes

- Do not edit `docs/agents/architecture/entrypoint-migration-status.md` by hand. scripter regenerates it.
- Markdown must pass the repo's `.markdownlint.json`.

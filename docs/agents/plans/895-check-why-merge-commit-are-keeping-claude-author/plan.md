# Plan: Check why merge commit are keeping claude author

Issue: [895-check-why-merge-commit-are-keeping-claude-author.md](../../issues/895-check-why-merge-commit-are-keeping-claude-author.md)

## Overview

The model co-author leaks into squash-merge commits because `auto-fix-all`'s planning-artifacts cleanup commit hardcodes its `Co-Authored-By` trailers (always the model line, plus `architect agent <model email>`), ignoring `git.omit_model_coauthor` and the architect's configured email. The fix extracts the trailer logic into one shared builder per engine — a native helper in `core/lib/utils/git/` and a shell function in `arcanum/_lib/agent_email.sh` — and routes all four commit entrypoints (issue, plan, change, cleanup) through it. Under `git.omit_model_coauthor`, the builder also drops the agent trailer when its email would fall back to the model email.

## Agents involved

- [node](node.md)
- [scripter](scripter.md)

## Shared contracts

### Trailer semantics (identical in both engines)

Inputs: `agent` (e.g. `architect`, `node`), `modelName`, `modelEmail`, plus the target repo's config/working tree.

1. `engine` = commit template engine: `new` when `.github/commit_message_template-2.0.md` exists, `old` when only `.github/commit_message_template.md` exists, `new` when neither exists.
2. `agentEmail` = `engine == new` ? agent-email lookup (`git.agents.<agent>` → `git.email` with `{agent}` substitution, falling back to `modelEmail`) : `modelEmail`.
3. `omit` = `git.omit_model_coauthor` resolved through the 3-tier chain is the JSON boolean `true` **or** the string `"true"`.
4. Output lines, in order:
   - `Co-Authored-By: <modelName> <<modelEmail>>` — only when `!omit`;
   - `Co-Authored-By: <agent> agent <<agentEmail>>` — always, **except** when `omit && agentEmail == modelEmail` (then dropped).
5. The output may be empty (zero lines). Callers must then end the message right after the subject/body, without a trailing blank line followed by nothing — i.e. the blank separator line before the trailers is emitted only when at least one trailer line exists.

### Native API (node)

`core/lib/utils/git/CoauthorTrailers.js`, default export class `CoauthorTrailers`:

- `constructor({ configChain = new ConfigChain(), agentEmail = new AgentEmail({ configChain }), fileExists } = {})`
- `async lines(repoPath, agent, modelName, modelEmail)` → `Promise<string[]>` (the trailer lines from rule 4, no trailing newline).

### Shell API (scripter)

`arcanum/_lib/agent_email.sh`, new function:

- `coauthor_trailers <agent> <model_name> <model_email>` — prints the trailer lines from rule 4, one per line (nothing when empty); reads config/template from the ambient cwd (callers already `repo_path_enter "$REPO_PATH"` first). Sources `commit_template.sh` itself so callers only need `agent_email.sh`.

### Message shape (both engines, all four commands)

```
<subject>
[\n<body>]
[\nAddresses-Comment: <url>]        (commit_change only)
[\n<trailer lines>]                 (only when the trailer list is non-empty)
```

Native and shell must stay byte-identical per entrypoint; the existing parity specs (`core/spec/bin/*Parity_spec.js`) enforce it.

### Cleanup commit

`cleanup_artifacts.sh` keeps its CLI signature (`<repo_path> <issue_file> <plan_dir> <id> <model_name> <model_email>`) and builds `chore(docs): remove planning artifacts (issue #<id>)` + trailers with `agent = architect`.

## Order

The two agents can work in parallel against the contracts above; the node agent's parity spec updates (node step 03) exercise the scripter's shell changes, so run the full `core` suite after both land.

## Docs (architect, coordinator)

- `docs/guides/arcanum-repo-config.md` — `git.omit_model_coauthor` row: add `cleanup_artifacts.sh` to the listed scripts and document the "agent trailer is also dropped when it resolves to the model email" rule.
- `README.md` — the matching `git.omit_model_coauthor` row.

## Notes

- No migration needed (no config shape change).
- `docs/agents/architecture/script-engine.md`'s "no wholesale `_lib` migration" rule is respected: the native helper is grown in `core/lib/` because four migrated entrypoints need it; the shell `_lib` gets one added function, existing functions unchanged.

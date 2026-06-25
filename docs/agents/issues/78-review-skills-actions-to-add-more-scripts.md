# Review skills actions to add more scripts

## Context

Several skill step files describe actions in natural language (e.g., "push the branch", "open a PR", "run the tests") rather than invoking concrete, deterministic scripts. This makes agents less reliable — they must interpret and improvise the implementation each time, leading to inconsistency across runs. A systematic review is needed to identify every such prose action and replace it with an explicit script call.

## What needs to be done

The architect reviews every skill's step files across `~/.claude-favini/skills/` and identifies each action that:
- Is currently described in prose without a corresponding script call, and
- Could be replaced by a specific bash command or a new script under `scripts/` or `_lib/`.

For each such action, the architect produces a structured finding describing what the action does, which file it is in, and what script should be created or called instead. It then delegates each fix:
- Script creation → `scripter` agent
- Skill markdown updates → `architect` agent

## Acceptance criteria

- [ ] All skill step files have been reviewed for prose actions that could be explicit script calls
- [ ] Each identified action has a corresponding script created under `scripts/` or `_lib/`
- [ ] Each identified skill step file is updated to call the new script instead of describing the action in prose
- [ ] New scripts are reusable across multiple skills where applicable

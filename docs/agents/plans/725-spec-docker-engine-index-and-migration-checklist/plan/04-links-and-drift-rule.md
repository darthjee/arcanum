# Cross-links and temporary drift rule

Link the new spec from the existing docs, and add the temporary drift rule to the agents that create and review scripts.

- `docs/agents/specs/shell-engine-removal.md`: in the Prerequisites bullet about `engine.mode=docker`, link [Docker engine spec](docker.md) as the work that delivers it. Add the same link to "See also".
- `docs/agents/architecture/script-engine.md`: add one "See also" line: `[Docker Engine spec](../specs/docker.md)`, the in-progress design for `engine.mode=docker` (epic #724).
- Agent files: add a short, clearly temporary note (e.g. a `## Temporary: docker migration checklist (epic #724)` section) saying that while epic #724 is open, any PR adding or removing a script under `<skill>/scripts/` or `arcanum/_lib/` must update `docs/agents/specs/docker/checklist.md`. Add a line stating it is removed by #731.
  - `.claude/agents/scripter.md`: as written above.
  - `.claude/agents/skill-reviewer.md`: phrased as something to check and report. Keep the reviewer's "only report" rule intact.

## Files to Change
- `docs/agents/specs/shell-engine-removal.md` — link to the docker spec.
- `docs/agents/architecture/script-engine.md` — "See also" line.
- `.claude/agents/scripter.md` — temporary drift rule.
- `.claude/agents/skill-reviewer.md` — temporary drift-rule check.

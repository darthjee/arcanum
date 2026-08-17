# Overview and Source Code Layout

## Overview

This repository has no application architecture in the traditional sense — there's no running process, no runtime layers. Each skill is a set of markdown instructions that Claude Code loads and interprets when the user invokes `/skill-name`. That's still true for the skills themselves; deterministic logic within a skill, however, is migrating per-entrypoint from bash scripts to a native Node.js runtime layer under `core/` — see [Script Engine](script-engine.md) for the design (not yet implemented as of this writing).

## Source Code Layout

Each skill lives in its own folder at the repository root:

```
skill-name/
├── SKILL.md          ← entry point, loaded when /skill-name is invoked
├── step-one.md        ← auxiliary instructions, referenced from SKILL.md
└── step-two.md
```

- `SKILL.md` requires a frontmatter with `name` and `description`.
- Simpler skills may have just `SKILL.md`, with no auxiliary files.
- More complex skills split the flow across multiple markdown files (e.g. one per scenario or per step), referenced via relative links from `SKILL.md`.

All logic shared between skills lives in `arcanum/_lib/` (formerly `_lib/` at the root — moved inside `arcanum/` so the release zip, described below, is self-contained). Skill scripts reference this folder as `../../arcanum/_lib/...`, relative to the skill's own `<skill>/scripts/` folder.

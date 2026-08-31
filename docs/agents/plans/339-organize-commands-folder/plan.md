# Plan: Organize commands folder

Issue: [339-organize-commands-folder.md](../issues/339-organize-commands-folder.md)

## Overview
Reorganize `core/lib/commands/`'s 23 flat files into four subfolders grouped by owning skill (`arcanum-split-issue/`, `arcanum-update/`, `auto-fix-all/`, `shared/`), mirror the same structure into `core/spec/lib/commands/`, and update every path this move touches — the `commands.js` registry, `RepoContext.js`'s one hardcoded import, and all relative imports broken by the extra directory depth. Pure internal reorg, no behavior change.

See [node.md](node.md) for the full plan.

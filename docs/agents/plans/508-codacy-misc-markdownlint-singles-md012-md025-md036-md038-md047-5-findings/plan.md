# Plan: Codacy: misc markdownlint singles — MD012/MD025/MD036/MD038/MD047 (5 findings)

Issue: [508-codacy-misc-markdownlint-singles-md012-md025-md036-md038-md047-5-findings.md](../issues/508-codacy-misc-markdownlint-singles-md012-md025-md036-md038-md047-5-findings.md)

## Overview

Five independent, single-rule markdownlint findings across 5 files. Four are pure one-line mechanical fixes owned by `architect` (root-level/architecture files). The fifth, `init-claude/setup_permissions.md`'s duplicate-H1 (MD025), is fixed by splitting the file into two — `setup_permissions.md` (kept) and a new `setup_specialist_dispatch_permissions.md` — which is `skill-writer`'s work, and ripples into `scripter`-owned comments that reference the old single-file name.

## Agents involved

- [architect](architect.md)
- [scripter](scripter.md)
- [skill-writer](skill-writer.md)

## Shared contracts

- New file name: `init-claude/setup_specialist_dispatch_permissions.md` — the file `skill-writer` creates to hold the "Common Specialist-Dispatch Permission Exemption" procedure split out of `init-claude/setup_permissions.md`. `architect` updates `docs/agents/architecture/dispatch-permissions.md`'s two references to this exact new filename; `scripter` updates the "Used by" comment bullets in `arcanum/_lib/permission_grant.sh` and `arcanum/_lib/permission_grant_shell.sh` to mention both `init-claude/setup_permissions.md` and this new filename.
- `init-claude/setup_permissions.md` keeps its original H1 (`# Setup the \`shipit\`-Merge Permission Exemption`) and content unchanged apart from the split — every other reference to it by name (`docs/agents/architecture/issue-tags.md`, `auto-fix-all/scripts/wait_ci_and_merge_shell.sh`) is already scoped to the `shipit`-merge procedure specifically and needs no change.

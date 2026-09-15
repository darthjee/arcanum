# Plan: Fix SC2004 in init-claude/scripts/lib/label_config.sh: unnecessary `$`/`{}` on arithmetic array index

Issue: [480-fix-sc2004-in-init-claude-scripts-lib-label-config-sh-unnecessary-on-arithmetic-array-index.md](../../issues/480-fix-sc2004-in-init-claude-scripts-lib-label-config-sh-unnecessary-on-arithmetic-array-index.md)

## Overview
Drop the redundant `$` on the array-index lvalue at `init-claude/scripts/lib/label_config.sh:228` to clear the single `ErrorProne`-category `SC2004` finding in the Codacy Warning backlog. No behavior change.

See [scripter.md](scripter.md) for the full plan.

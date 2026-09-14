# Plan: Fix 6 standalone SC2034 findings across scripts and libs

Issue: [475-fix-6-standalone-sc2034-findings-across-scripts-and-libs.md](../../issues/475-fix-6-standalone-sc2034-findings-across-scripts-and-libs.md)

## Overview

Resolve 6 unrelated, standalone ShellCheck SC2034 ("appears unused") findings, one per file/script family. Three are genuinely dead assignments to remove; three are read by a documented sourcing caller (or, in one case, kept for a documented signature convention) and must be suppressed in place with a comment explaining why. All 6 fixes live under `<skill>/scripts/` or `arcanum/_lib/`, squarely within the `scripter` agent's scope.

See [scripter.md](scripter.md) for the full plan.

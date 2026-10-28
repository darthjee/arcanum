# Plan: Fix migrationsCliInstall spec left pointing at next/ after the 2.3.0 bump

Issue: [892-fix-migrationscliinstall-spec-left-pointing-at-next-after-the-2-3-0-bump.md](../../issues/892-fix-migrationscliinstall-spec-left-pointing-at-next-after-the-2-3-0-bump.md)

## Overview
Make `core/spec/bin/migrationsCliInstall_spec.js` derive every migration path from its versioned `SCRIPT` literal, so the core suite goes green again. Then add a CI-time convention spec, plus a doc rule, so a spec can't be left pointing at `repos/next/` after a version bump again.

See [node.md](node.md) for the full plan.

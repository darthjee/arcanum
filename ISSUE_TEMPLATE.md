# Deprecate /auto-monitor-pr skill

## Overview

The `/auto-monitor-pr` skill is no longer needed. The `/auto-fix-all` skill has been enhanced to skip directly into PR monitoring, making this dedicated skill redundant.

## Context

Previously, users had to:
1. Run `/auto-fix-all` to fix issues
2. Then separately run `/auto-monitor-pr` to monitor the created PR

With the updated `/auto-fix-all` workflow, PR monitoring is now integrated directly into the fix-all process, eliminating the need for the separate `/auto-monitor-pr` skill.

## What needs to be done

- [ ] Update documentation to reflect that `/auto-monitor-pr` is deprecated
- [ ] Redirect users to use `/auto-fix-all` instead, which now includes PR monitoring
- [ ] Mark the skill as deprecated in the codebase
- [ ] Consider removing the skill in a future release after a deprecation period

## Migration path

Users currently using `/auto-monitor-pr` should switch to `/auto-fix-all`, which now provides the same functionality as part of its workflow.
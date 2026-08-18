# Plan: Auto-fix-all: architect bypasses blocked specialist dispatch instead of escalating

Issue: [200-auto-fix-all--architect-bypasses-blocked-specialist-dispatch-instead-of-escalating.md](../../issues/200-auto-fix-all--architect-bypasses-blocked-specialist-dispatch-instead-of-escalating.md)

## Overview

Adds a distinct `OUTCOME=blocked` path to the `auto-fix-all` pipeline: when a specialist dispatch is blocked by Claude Code's own permission classifier, the pipeline stops and hands the decision back to the coordinator/user instead of the architect silently performing the blocked action itself.

See [skill-writer.md](skill-writer.md) for the full plan.

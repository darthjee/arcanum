# Issue: Ensure auto-fix-all Uses Architect

## Description

All decisions and skill invocations made by `auto-fix-all`, `auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`, `auto-monitor-pr`, and `auto-monitor-issue-pr` should be delegated to the architect agent, which spawns other specialist agents as needed.

## Problem

- Currently these skills run in the general (coordinator) context
- When looping, the general context accumulates tool output and history from previous iterations, polluting subsequent runs
- Similarly, the architect's context can bleed into the general context across iterations
- This cross-contamination degrades decision quality over time

## Expected Behavior

- Each of the listed skills delegates its core logic to the architect agent
- The architect spawns specialist agents as needed for sub-tasks
- The architect's context remains isolated from the general coordinator context
- Loop iterations stay clean — no context pollution between cycles

## Solution

- Refactor `auto-fix-all`, `auto-new-issue`, `auto-plan-issue`, `auto-fix-issue`, `auto-monitor-pr`, and `auto-monitor-issue-pr` to invoke the architect agent as the primary decision-maker
- The coordinator (general context) only handles orchestration (passing arguments, reading results)
- The architect handles all skill logic and spawns further agents as needed

## Benefits

- Cleaner context boundaries between loop iterations
- More consistent decision quality across long-running pipelines
- Architect context and general context no longer cross-contaminate

---
See issue for details: https://github.com/darthjee/arcanum/issues/45

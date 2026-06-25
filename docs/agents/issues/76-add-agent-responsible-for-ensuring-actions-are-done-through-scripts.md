# Issue: Add agent responsible for ensuring actions are done through scripts

## Description
A new agent responsible for reviewing skills (SKILL.md and step files) in the current PR to ensure that deterministic logic and commands are extracted into scripts rather than embedded as raw inline instructions for the agent to discover and run.

## Problem
When skills embed complex bash logic inline in markdown instead of calling named scripts, agents must figure out commands themselves — which is error-prone, less deterministic, and harder to maintain. The existing architect/scripter pair enforces this during skill creation, but there is no dedicated agent for reviewing compliance on changes.

## Expected Behavior
A new agent that:
- Is triggered by the architect during auto-fix-all, auto-monitor-pr, or auto-monitor-issue-pr flows
- Reviews skill files (SKILL.md and step files) touched in the current PR
- Flags violations: bash commands too complex to be inline that should be extracted to a named script
- Simple, explicit one-liner commands in a code block are acceptable; complex logic is not
- Reports findings back to the architect, which then decides whether to trigger the scripter or other agents to act

## Solution
Create a new specialist agent (e.g. skill-reviewer or script-enforcer) that:
- Receives a list of changed skill files from the architect
- Reads each file and identifies inline bash blocks with complex logic
- Reports violations and their locations to the architect
- Does not fix violations itself — delegates to the architect to coordinate scripter and other agents

## Benefits
- Consistent skill quality enforced on every PR that touches skills
- Reduced agent errors caused by overly complex or undiscoverable inline commands
- Clear separation of concerns: detect (this agent) → fix (scripter) → coordinate (architect)

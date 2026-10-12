# Record the decision in the docker.md index

Update `docs/agents/specs/docker.md`:

1. **Status** (line 5): "Phase 1 (spec) is done except #733" becomes "Phase 1 (spec) is done". Add one sentence: #733 gave every non-dispatched script a final kind, and the two non-dispatched entrypoints move to dispatched `host-only` commands in #760.
2. **Line 45** (under the parts table): replace "how they behave under docker is decided in #733" with a one-line summary and a link to dispatch.md's new non-dispatched section (step 02).
3. **Sub-issue map**:
   - #733 status becomes `Done`.
   - Add a row: `| #760 | Docker engine: migrate next_step_prompt.sh and auto_next.sh to dispatched host-only commands | scripter / node | #733 | Open |`.
   - The dependency-order line: replace "#733 runs alongside the spec phase." with the order #733 → #731 → #732 (#751), and add #760 (it does not block #731).
4. **Open points**:
   - TTY bullet: replace "and #733 for non-dispatched TTY scripts such as `next_step_prompt.sh`" with the outcome: it stays on the host's TTY and becomes `host-only` in #760.
   - "Non-dispatched scripts" bullet: change to "resolved." plus a summary of the four kinds, linking to dispatch.md (#733).

## Files to Change
- `docs/agents/specs/docker.md`: the status paragraph, the line under the parts table, the sub-issue map and two open-point bullets.

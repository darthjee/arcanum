# Apply the spec-status rule

The issue's "Spec status" rule says: when this issue closes and no other spec enhancement issue (#941 to #944) is still open, set the hub's `Status` to `Ready` and update the Status column of the spec's row in `docs/agents/specs.md`, in the same PR. Otherwise, leave both at `Drafting`.

At implementation time, check the sibling enhancement issues:

```bash
gh issue view 942 --json state -q .state
gh issue view 943 --json state -q .state
gh issue view 944 --json state -q .state
```

- If any of them is `OPEN` (expected, since they are being worked in parallel), change nothing. The hub stays `Drafting`, and so does the `docs/agents/specs.md` row (line 39 at planning time).
- If all three are `CLOSED`, set `- **Status:** Ready` in the hub, and change the Status cell of the `Spec-first split flow` row in `docs/agents/specs.md` from `Drafting` to `Ready`.

Mention which branch was taken in the PR description.

## Files to Change

- `docs/agents/specs/spec-first-split-flow/specs.md` — `Status` only, and only if #942 to #944 are all closed.
- `docs/agents/specs.md` — Status column of the spec's row only, and only under the same condition.

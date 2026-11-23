# "Blocked by" Ordering

Hub: [specs.md](specs.md)

**Rationale:** ordering is enforced by a real dependency mechanism respected at queue entry, not by sub-issue hierarchy, which does not block execution. Because automation fails on `not_ready` (see [dialogue.md](dialogue.md)), ordering is what keeps a flow from failing one round per implementation issue.

## Mechanism

- GitHub native issue dependencies ("blocked by"), created by the split through the REST API (`/repos/{owner}/{repo}/issues/{n}/dependencies/blocked_by`).
- Nothing is added to the issue body, so the push guard has no second line to protect (see [guard.md](guard.md)). The order is also visible in GitHub's UI.

## Edges per flow

**Flow B:**

- Each enhancement issue is blocked by the generation issue.
- Each implementation issue is blocked by the generation issue and every enhancement issue.
- The fold issue is blocked by every implementation issue.

**Flow A:**

- The enhancement issues are blocked as in Flow B.
- The implementation-split issue is blocked by the generation issue and every enhancement issue.
- The fold issue is blocked by the implementation-split issue.
- When the reentrant split creates the implementation issues, it adds each one as a blocker of the fold issue. The reentrancy details are an open point (#941).

**Flow C:** no edges, as today.

## Queue entry

`push-issue-to-queue` applies this rule:

- An issue is accepted when every *open* blocker is already queued ahead of it, or comes earlier in the same push.
- Otherwise the push is refused with `#<id> is blocked by #<b> — queue #<b> first`, the same way Epics are refused.
- A whole split can still be queued in order with one command.

## Pop time

This applies to `auto-fix-all` at pop and to `auto-resolve-issue` on start:

- If any blocker is still open (for example, the spec issue's PR was closed without merging), the item fails explicitly with `blocked by #<b>`. It leaves the queue, with no requeue and no retry.
- The resolver's `not_ready` check stays as a second line of defence.

## Fetch failure

A failure to fetch dependencies is treated like a label-fetch failure. It never blocks the push, and the pop-time check decides.

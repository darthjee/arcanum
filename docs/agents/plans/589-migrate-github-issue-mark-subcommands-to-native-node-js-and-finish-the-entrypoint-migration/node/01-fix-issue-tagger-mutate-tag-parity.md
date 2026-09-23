# Fix IssueTagger#mutateTag parity (Error line + shipit guard)

`IssueTagger#mutateTag` (`core/lib/utils/issue/IssueTagger.js`) says it mirrors `tag_mutate_add_label` / `tag_mutate_remove_label` exactly, but it has two gaps:

1. **Missing `Error:` line.** `tag_mutate.sh` prints `Error: could not fetch issue #<id> from <repo_ref>` to stderr when the label fetch fails, and `Error: could not update issue #<id> on <repo_ref>` when the add/remove fails. Only then does the caller print its `Warning:`. `mutateTag` currently prints only the warning. In each catch, write the matching `Error:` line to stderr first, then call `warnMutationFailure`. Use the method's own `repoRef` parameter in both lines, not the `IssueClient` error message, so the two lines stay consistent with each other and with the shell caller's `$repo_ref`.
2. **Missing shipit guard.** `tag_mutate.sh` refuses `shipit` (`Error: shipit is human-only; scripts must not add or remove it` to stderr, return 1), and the caller then warns. Add the same check at the top of `mutateTag`: print that error line, then `warnMutationFailure(action, 'shipit', id, repoRef)`, then return without any API call. No current table entry uses `shipit`, but the guard is part of the contract.

Update the JSDoc so it describes the stderr sequence accurately.

This fixes the method in place, as decided on the issue, and also changes the native output of its existing caller, `markEnqueued` (`auto-fix-all` / `auto-fix-issue` queue flows). That brings them closer to shell parity. Search for every spec that asserts on `mutateTag` / `markEnqueued` stderr and update it: at least `IssueTaggerMutateTag_spec.js` and `IssueTaggerMarkEnqueued_spec.js`, plus any parity spec under `core/spec/bin/autoFixAllQueueParity/` or `autoFixIssueGithubParity/` that exercises a failing mutation. Where such a parity spec compares stderr, it should now match the shell more closely. Don't loosen assertions.

## Files to Change
- `core/lib/utils/issue/IssueTagger.js` — add the `Error:` lines and the shipit guard to `mutateTag`, and update the JSDoc.
- `core/spec/lib/utils/issue/IssueTaggerMutateTag_spec.js` — cover the fetch-failure pair, the update-failure pair, and the shipit guard (no client calls).
- `core/spec/lib/utils/issue/IssueTaggerMarkEnqueued_spec.js` — update the stderr expectations.
- Any other spec asserting `mutateTag` / `markEnqueued` stderr — update to match.

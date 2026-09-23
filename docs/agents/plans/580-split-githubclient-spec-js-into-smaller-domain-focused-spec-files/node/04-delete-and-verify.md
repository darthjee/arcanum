# Delete the original spec and verify
Delete `core/spec/lib/utils/github/GitHubClient_spec.js`, then in `core/`:
- Run `yarn test`. The total spec count must equal the baseline from step 01, with 0 failures. Running the six new files alone must add up to the old file's count.
- Run `yarn lint`. It must be clean.
- Run `wc -l` on the new files. Each must be at most ~200 lines.
- Optionally, run `yarn duplication` to confirm no new clone groups were introduced.

## Files to Change
- `core/spec/lib/utils/github/GitHubClient_spec.js`: deleted

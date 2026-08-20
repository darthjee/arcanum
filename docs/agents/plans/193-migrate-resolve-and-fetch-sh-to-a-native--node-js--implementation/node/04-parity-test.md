# Parity test

Write the required parity test: run `arcanum/_lib/resolve_and_fetch_shell.sh` (`scripter`'s Step 02 output, invoked directly — not through the shim, so this test isn't circular) and `core/bin/arcanum resolve-and-fetch` with identical inputs, against a real (or realistically faked, e.g. a local bare git repo + a stubbed GitHub response reachable by both sides — your call on the exact harness) fixture, and assert byte-identical stdout and exit code for each of:

- A valid `#<id>` matching an existing local file.
- A valid `#<id>` requiring a fresh GitHub fetch (success case).
- Every malformed-input variant from Step 03.
- A GitHub fetch failure.

Follow `arcanum/_lib/test_engine_dispatch.sh`'s existing pattern for shell/native parity assertions (see its Case 2) as the reference shape, adapted to a real entrypoint instead of the `dispatch-fixture` throwaway. Decide the concrete home for this test (a Jasmine spec under `core/spec/`, or a standalone script alongside `test_engine_dispatch.sh` — either is fine as long as it actually runs in CI) and note the choice in this plan folder's `## Notes` if it's not the Jasmine-spec default.

## Files to Change

- New parity-test file — location per the above.

# Parity test

Write the required parity test: run `arcanum/_lib/resolve_id_and_file_shell.sh` (`scripter`'s Step 01 output, invoked directly — not through the shim, so this test isn't circular) and `core/bin/arcanum resolve-id-and-file` with identical inputs, against a real temp `issues_folder` fixture, and assert byte-identical stdout and exit code for each of:

- Scenario A with and without an existing-file match.
- Scenario B.
- Scenario C with and without an existing-file match.
- The non-numeric-id hard-failure case (assert both sides exit non-zero with no `STATUS=` line and the same stderr message).

Follow `arcanum/_lib/test_engine_dispatch.sh`'s existing pattern for shell/native parity assertions (see its Case 2, and `node/04-parity-test.md` from #193's plan) as the reference shape. Put this as a Jasmine spec under `core/spec/`, consistent with #193's choice.

## Files to Change

- New parity-test file under `core/spec/`.

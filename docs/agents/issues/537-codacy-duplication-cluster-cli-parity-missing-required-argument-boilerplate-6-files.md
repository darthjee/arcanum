# Codacy: duplication cluster — CLI parity "missing required argument" boilerplate (6 files)

## Context

Six CLI-parity spec files repeat the identical "no id given → usage error on both shell and native" test block:

- `core/spec/bin/arcanumSplitIssueCreateSubIssueFileParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssueCreateSubIssueParity/argument_validation_spec.js`
- `core/spec/bin/arcanumSplitIssuePushSubIssuesParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllCheckoutFromMainParity/argument_validation_spec.js`
- `core/spec/bin/autoFixAllWaitCiParity/preconditions_spec.js`
- `core/spec/bin/autoFixAllWaitCiAndMergeParity/preconditions_spec.js`

Each file repeats a byte-for-byte identical ~13-17 line block (e.g. lines 28-45 in each), and each file additionally self-duplicates that block 2-3 times for different missing-argument scenarios. Codacy's duplication report for these files covers roughly 350 duplicated lines across the six files.

## What needs to be done

- Factor a single `itRejectsMissingArgument(argName, usage)` shared example.
- Add a common CLI-usage-error fixture builder that all six parity suites call instead of hand-copying the scenario.
- Apply the shared example/fixture to all six files listed above, replacing their repeated missing-argument blocks.

## Acceptance criteria

- [ ] A shared `itRejectsMissingArgument(argName, usage)` example (or equivalent) exists and is used by all six listed spec files.
- [ ] The hand-copied missing-argument scenarios in each file are replaced by calls to the shared example/fixture.
- [ ] All six specs pass with unchanged coverage after the refactor.
- [ ] Codacy's duplication score for these six files drops substantially after the fix lands.

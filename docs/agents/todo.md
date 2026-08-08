# Todo

Larger follow-ups noted along the way that don't belong inside a single issue.

- **No test framework for this repo's shell scripts.** Skills under this repo rely entirely on manual verification and one-off regression scripts (e.g. the one added for [#111](https://github.com/darthjee/arcanum/issues/111)) — there's no shared harness (e.g. bats) for running/asserting against `_lib/*.sh` or per-skill `scripts/*.sh` behavior. Worth setting up so regression scripts like that one aren't ad hoc and undiscoverable.

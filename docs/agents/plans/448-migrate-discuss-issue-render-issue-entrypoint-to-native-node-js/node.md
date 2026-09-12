# node Plan: Migrate discuss-issue-render-issue entrypoint to native Node.js

Main plan: [plan.md](plan.md)

## Shared contracts

See [plan.md](plan.md)'s "Shared contracts" section — in particular: the method signature `run(outputFile, title, description, problem, expectedBehavior, solution, benefits)`, the template path (`<repoPath>/discuss-issue/templates/issue.tmpl.md`), the blank-line-collapsing behavior, and the plain-`Error`-on-missing-argument contract (no `DispatchFailure` needed here). `scripter` owns the shim and the `migration-status.json` flag that decides when this command is actually reached at runtime — this agent's work is self-contained otherwise.

## Steps

- [01 — Create the native command](node/01-create-command.md)
- [02 — Register the command](node/02-register-command.md)
- [03 — Unit tests](node/03-unit-tests.md)
- [04 — Parity test](node/04-parity-test.md)

## CI Checks

- `core`: `yarn test` (CircleCI job `test`) and `yarn lint` (CircleCI job `checks`).

## Notes

- Read `discuss-issue/scripts/render_issue.sh` and `discuss-issue/templates/issue.tmpl.md` in full before writing the native module — do not re-derive the placeholder list or the collapsing regex from memory.
- Bash's `${content/pattern/replacement}` is a single-occurrence replace; each placeholder occurs exactly once in the template, so `String.prototype.replace` (not `replaceAll`) is the faithful equivalent — using `replaceAll` would also work here but diverges from the shell script's actual semantics if the template ever grows a duplicate placeholder, so prefer matching the shell script's behavior exactly.
- Follow the existing `core/lib/` layering: this is a `commands/` module with zero collaborators beyond built-in `node:fs`/`node:path` — no `context/` or `services/` module is needed for a single read-template/write-file command this small.

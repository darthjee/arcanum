# node Plan: Investigate Codacy suppression for ESLint detect-non-literal-fs-filename false positives across core/spec test fixtures

Main plan: [plan.md](plan.md)

## Steps

- [01 — Confirm the exact Codacy finding(s)](node/01-confirm-codacy-findings.md)
- [02 — Apply suppression via Codacy's ignore mechanism](node/02-apply-codacy-suppression.md)
- [03 — Document the rationale in representative fixture files](node/03-document-rationale-in-fixtures.md)
- [04 — Verify the finding no longer appears](node/04-verify-suppression.md)

## CI Checks

- `core`: `yarn lint` (CI job: `checks`)
- `core`: `yarn test` (CI job: `test`)

## Notes

- A prior attempt in this session to query Codacy's SRM findings via the `mcp__codacy__codacy_search_repository_srm_items` tool failed with "fetch failed" — retry it (and `codacy_get_file_issues`/`codacy_list_repository_issues`) at the start of Step 1; if it keeps failing, fall back to the Codacy web dashboard (`https://app.codacy.com/gh/darthjee/arcanum/dashboard`) or `codacy_setup_repository` to (re-)link the repo for the MCP integration.
- There is no `.codacy.yml` or any other Codacy config file in this repo today — all Codacy configuration currently lives in Codacy's hosted dashboard (confirmed: `find . -iname "*.codacy*"` returns nothing). Prefer keeping the suppression there (a path-scoped pattern ignore) rather than introducing a new root-level config file; if a repo-level Codacy config file turns out to be unavoidable, that decision needs sign-off from `architect` per this repo's "root-level files" ownership convention (see `AGENTS.md`), since it isn't `core/`-scoped.
- No MCP tool in this session can *write* a Codacy ignore rule (only `get`/`list`/`search`/`setup_repository`/`cli_analyze`/`cli_install` are available) — Step 2 is a manual action on Codacy's dashboard/API by whoever has admin access to the `darthjee/arcanum` Codacy project, not something scriptable from this repo.
- `core/spec/` has dozens of occurrences of the same `writeFile(path.join(<trusted-dir>, ...), ...)` shape (see Step 1); Step 3 only adds documentation comments to a handful of representative files, not all of them — exhaustive comment coverage isn't the goal, the Codacy-side pattern ignore is what actually suppresses the noise.

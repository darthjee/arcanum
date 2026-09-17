# Node Plan: Codacy: verify unencoded prUrl in HTML context in fakeGithubApiFetchPreload.js (XSS, 2 findings)

Main plan: [plan.md](plan.md)

## Context

- `core/spec/support/utils/fakeGithubApiFetchPreload.js` lines 112 and 171 assign a fixture `prUrl` string (sourced from `FAKE_FETCH_PR_URL`) to an `html_url` field. Codacy's SRM ESLint scan (`ESLint8_xss_no-mixed-html`) flags both as unencoded input in an HTML context.
- Issue #461 (PR #469, commit `dc45e41`) already investigated these exact two lines, confirmed they are false positives (the value is never rendered as HTML or assigned to the DOM — the finding only fires because the field name mirrors GitHub's REST `html_url` field), and added explanatory comments above both lines.
- `no-mixed-html` is not a rule enabled in this repo's own `core/eslint.config.mjs` — it is Codacy's own SRM-side scanner rule, so a local `eslint-disable` comment has no effect on it. The only real suppression path is marking the finding "Ignored" through Codacy's own API/dashboard, which #461 explicitly skipped ("no Codacy API/MCP credentials were available" at the time) — so the finding stayed live and resurfaced as this new issue.
- This session has `mcp__codacy__*` MCP tools available, which #461 did not have. That is the new lever this plan should try before falling back to the same no-op outcome as #461.

## Implementation Steps

### Step 1 — Check whether Codacy MCP can actually mark a finding Ignored

Enumerate the available `mcp__codacy__*` tools (e.g. via `codacy_list_tools`, `codacy_list_repository_issues`, `codacy_search_repository_srm_items`, `codacy_get_issue`) and locate the SRM/issue entries corresponding to these two findings (file `core/spec/support/utils/fakeGithubApiFetchPreload.js`, lines 112 and 171, pattern `ESLint8_xss_no-mixed-html`).

As of this plan being written, the available Codacy MCP tool set is entirely read/list/search (`codacy_get_issue`, `codacy_list_repository_issues`, `codacy_list_pull_request_issues`, `codacy_search_repository_srm_items`, `codacy_search_organization_srm_items`, `codacy_get_file_issues`, plus `codacy_cli_analyze`/`codacy_cli_install`/`codacy_setup_repository`) — none of these mutate an issue's status (no "ignore"/"resolve"/"update status" action observed). Confirm this is still the case at implementation time; tool availability may have changed.

- If a mutation capability **does** exist: proceed to Step 2's "suppress" branch.
- If no mutation capability exists (the expected outcome based on the tool roster above): proceed to Step 2's "document" branch — do not spend further effort searching for a workaround.

### Step 2 — Apply the resolution

- **Suppress branch** (only if Step 1 found a working mutation tool): mark both SRM findings Ignored via that tool, with a reason referencing issue #461/#495 and the false-positive rationale already present in the code comments. Do not duplicate or rewrite the existing comments in `fakeGithubApiFetchPreload.js` — they remain accurate.
- **Document branch** (expected outcome): make no code changes — the explanatory comments added by #461 already stand and are still accurate. Instead, record in the issue/PR that a functional Codacy-side suppression is not currently achievable through available tooling, and that this finding is expected to keep resurfacing until either a mutation capability becomes available or a human manually marks it Ignored in the Codacy dashboard.

## Files to Change

- None expected. This issue resolves through a Codacy API call (if available) or a documentation decision recorded on the issue/PR — not a change to `fakeGithubApiFetchPreload.js` itself, since its explanatory comments from #461 are already correct and sufficient.

## Notes

- Do not re-add or reword the explanatory comments above lines 112 and 171 — they already correctly document the false positive from #461's resolution.
- If the "document" branch is taken, still leave a clear note on the GitHub issue/PR explaining the outcome and why no code change was made, so a future re-flag doesn't restart this same investigation from scratch a third time.

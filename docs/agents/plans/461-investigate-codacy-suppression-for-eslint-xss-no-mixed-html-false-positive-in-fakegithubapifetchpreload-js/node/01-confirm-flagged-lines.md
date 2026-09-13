# Confirm the exact flagged lines

Before touching anything, confirm which two `html_url: <non-literal>` assignments in `core/spec/support/utils/fakeGithubApiFetchPreload.js` correspond to the two open Codacy SRM findings (both titled "Unencoded input 'prUrl' used in HTML context").

Open the two dashboard links from [node.md](../node.md)'s Notes section, or query Codacy's API (e.g. via the `codacy` MCP tools — `codacy_search_repository_srm_items` with `categories: ["XSS"]` narrows to these two, though it does not return line numbers directly; the dashboard link per finding does).

Both open findings name `prUrl` specifically, not `prCreateUrl`, so the most likely candidates are:
- The `wait-ci` mode's `html_url: prUrl` (inside the `pulls?head=` response array).
- The `github` mode's `html_url: prUrl` (inside the `pulls?head=` response array that also carries `state`/`merged`/`merged_at`).

The two remaining `html_url` sites in `auto-fix-issue-github` mode (`prCreateUrl`, and a second `prUrl` occurrence) are not currently flagged — confirm they're excluded before proceeding to Step 02/03, and do not touch them if so.

## Files to Change

- None — this step is investigation only, confirming line numbers/scope for Steps 02 and 03.

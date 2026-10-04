# Replace FinishReport's local alias map

In `core/lib/commands/shared/FinishReport.js`, remove `WEB_DOMAIN_ALIASES` and its comment. In `_baseUrl()`, compute the web domain with `Origin.normalizeDomain(domain)` (import `Origin` from `../../utils/git/Origin.js`). The rendered output must stay byte-identical: existing `FinishReport_spec.js` cases and `core/spec/bin/finishReportParity_spec.js` (which already cover `ssh.github.com`) must pass without changes.

## Files to Change
- `core/lib/commands/shared/FinishReport.js` — use `Origin.normalizeDomain` and drop the duplicated alias map

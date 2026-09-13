# Confirm the exact Codacy finding(s)

Use the Codacy MCP tools (`codacy_get_file_issues` for `core/spec/support/fixtures/engineDispatchFixtures.js`, then `codacy_search_repository_srm_items` with `categories: ["FileAccess"]` or `codacy_list_repository_issues` with `patternIds` for `detect-non-literal-fs-filename`) against `darthjee/arcanum` on GitHub to pull the exact rule/pattern id, file paths, and line numbers Codacy currently reports for this rule.

If the MCP call fails (as it did once during discussion of this issue, with a plain "fetch failed"), retry it — if it keeps failing, use `codacy_setup_repository` to (re-)link the repo, or fall back to reading the finding directly from the Codacy web dashboard.

Cross-reference the result against the repo-wide `writeFile(path.join(<dir>, ...), ...)` pattern search done during the issue discussion (occurrences in `core/spec/support/fixtures/`, `core/spec/support/factories/`, `core/spec/support/utils/`, and various `*_spec.js` files) to determine which of those Codacy is actually flagging today, versus which are only theoretically susceptible to the same rule.

## Files to Change

- None — this step only gathers information; record the confirmed finding list for use in Steps 2–4.

# Apply suppression via Codacy's ignore mechanism

Because `eslint-plugin-security` isn't a dependency of `core/package.json` and isn't wired into `core/eslint.config.mjs`, an inline `// eslint-disable-next-line` comment would have no effect on Codacy's own scan — Codacy runs this rule from its own bundled analysis, independent of the repo's local lint config.

Given how widespread the pattern is (per Step 1's findings), apply the suppression as a **scoped ignore rule** rather than one finding at a time: in Codacy's repository settings (`app.codacy.com` → `darthjee/arcanum` → Code Patterns), ignore the `detect-non-literal-fs-filename` pattern for the `core/spec/**` path glob, or, if Codacy's UI only supports per-file/per-finding ignores here, mark each confirmed finding from Step 1 as ignored/false-positive individually.

This is a manual action on Codacy's dashboard/API by whoever has admin access to the `darthjee/arcanum` Codacy project — no MCP tool available in this session can write an ignore rule (only read/search/setup tools exist).

## Files to Change

- None — this step is performed entirely in Codacy's dashboard/API, not in this repository.

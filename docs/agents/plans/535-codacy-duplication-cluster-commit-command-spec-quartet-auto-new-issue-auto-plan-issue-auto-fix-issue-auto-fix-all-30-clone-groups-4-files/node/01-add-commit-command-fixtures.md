# Add commitCommandFixtures factory and assertion helper

Add a new support factory that builds the shared repo/git-mock bootstrap used by all four commit-command specs, plus a plain assertion helper for the repeated "find the commit call and assert on its message" logic used by three of them. Follow the existing convention in `core/spec/support/factories/` (plain exported functions, e.g. `autoFixIssueGithub.js`/`repoContextFactory.js`) rather than introducing a shared-example/shared-context mechanism — this Jasmine setup has no built-in equivalent.

The setup builder must be parameterized over:
- which git subcommands `fakeExecFileAsync` stubs — `add`/`commit`/`branch`/`push` (used by `AutoNewIssueCommitIssue_spec.js`, `AutoPlanIssueCommitPlan_spec.js`), the same minus `add` (`AutoFixIssueCommitChange_spec.js`), or `ls-files`/`rm`/`diff`/`commit`/`branch`/`push` (`AutoFixAllCleanupArtifacts_spec.js`)
- whether a `fakeConfigChain` is involved at all — optional, since `AutoFixAllCleanupArtifacts_spec.js` has none and always hardcodes the `"architect"` agent
- the repo/fixture shape each spec's `beforeEach`/`afterEach` needs (e.g. `filePath`/`planDir` vs. a `PLAN_DIR`)

The assertion helper must be parameterized over:
- `fakeConfigChain` inputs (`agentEmail`, `omitModelCoauthor`)
- whether a template file is written to disk before running the command
- the matcher to apply (`toEqual` vs. `toContain`) and the expected value/pattern
- an optional extra assertion on `configChain.read`'s call args

Keep both exports in the same new file so the four specs have a single new import to reason about.

## Files to Change
- `core/spec/support/factories/commitCommandFixtures.js` (new) — parameterized setup builder + commit-assertion helper, following the existing factory-function convention.

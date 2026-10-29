# Refactor the three commit commands onto it

In `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan` and `AutoFixIssueCommitChange`, replace the trailer part of `_buildMessage` with `await this._coauthorTrailers.lines(repoPath, <agent>, modelName, modelEmail)` and delete the now-unused private `_commitTemplateEngineGet` / `_modelCoauthorOmitted` / `_fileExists` copies (keep any that are still used for something else, e.g. `_isFile`). Emit the blank separator line before the trailers only when the list is non-empty. Add the optional `coauthorTrailers` constructor dep (default built from the injected `configChain`/`agentEmail`).

Update their unit specs (`core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js`, `.../auto-plan-issue/AutoPlanIssueCommitPlan_spec.js`, `.../auto-fix-issue/AutoFixIssueCommitChange_spec.js`) and any tests that spy on the removed private methods (e.g. `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js`, `core/spec/support/factories/commitCommandFixtures.js`) to go through the helper instead. Add a drop-case example to each command spec and to the matching parity spec (`core/spec/bin/autoNewIssueCommitIssueParity_spec.js`, `autoPlanIssueCommitPlanParity_spec.js`, `autoFixIssueCommitChangeParity_spec.js`): `omit_model_coauthor: true` with no agent email → no trailers, byte-identical between engines.

## Files to Change
- `core/lib/commands/auto-new-issue/AutoNewIssueCommitIssue.js` — use `CoauthorTrailers`.
- `core/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan.js` — use `CoauthorTrailers`.
- `core/lib/commands/auto-fix-issue/AutoFixIssueCommitChange.js` — use `CoauthorTrailers`.
- `core/spec/lib/commands/auto-new-issue/AutoNewIssueCommitIssue_spec.js` — adapt + drop case.
- `core/spec/lib/commands/auto-plan-issue/AutoPlanIssueCommitPlan_spec.js` — adapt + drop case.
- `core/spec/lib/commands/auto-fix-issue/AutoFixIssueCommitChange_spec.js` — adapt + drop case.
- `core/spec/lib/utils/config/KeyRegistryDefaults_spec.js` — point `git.omit_model_coauthor` default probe at the helper if it used a removed method.
- `core/spec/support/factories/commitCommandFixtures.js` — adapt if it stubs removed methods.
- `core/spec/bin/autoNewIssueCommitIssueParity_spec.js`, `core/spec/bin/autoPlanIssueCommitPlanParity_spec.js`, `core/spec/bin/autoFixIssueCommitChangeParity_spec.js` — add the drop case.

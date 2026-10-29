# Add the CoauthorTrailers helper

Create `core/lib/utils/git/CoauthorTrailers.js` holding the logic currently copied privately in `AutoNewIssueCommitIssue`, `AutoPlanIssueCommitPlan` and `AutoFixIssueCommitChange` (`_commitTemplateEngineGet`, `_modelCoauthorOmitted`, `_fileExists`, and the trailer part of `_buildMessage`), plus the new drop rule: when `omit` is set and the resolved agent email equals the model email, the agent line is omitted too.

`lines(repoPath, agent, modelName, modelEmail)` returns the ordered trailer lines (`Co-Authored-By: <modelName> <<modelEmail>>`, `Co-Authored-By: <agent> agent <<agentEmail>>`), possibly empty. Reuse `shared/lib/config/AgentEmail.js` and `shared/lib/config/ConfigChain.js`; follow the JSDoc density of the surrounding `core/lib/utils/git/*.js` files.

Spec it in `core/spec/lib/utils/git/CoauthorTrailers_spec.js`: omit unset/false/`true`/`"true"`; agent email configured vs falling back to the model email; new vs old template engine (and neither file present → new); the drop case yielding `[]`.

## Files to Change
- `core/lib/utils/git/CoauthorTrailers.js` — new helper.
- `core/spec/lib/utils/git/CoauthorTrailers_spec.js` — new unit spec.

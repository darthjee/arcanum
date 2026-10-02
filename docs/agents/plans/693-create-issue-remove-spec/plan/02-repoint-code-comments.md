# Repoint code comments
Change every comment that points to `docs/agents/specs/arcanum-create-issue.md` so it points to `docs/agents/architecture/arcanum-create-issue.md`. Keep the section name quoted in each comment ("Native commands", "Label rules", "Edge cases", "Draft file", or the `arcanum-create-issue-start`/`-publish` subsection) only if the new doc has a section with that name; otherwise change it to the matching section. This changes comments only, not behavior.

The header comments in both shims also point to `docs/agents/plans/690-create-issue-native-command/plan.md`, which no longer exists. Remove that dead reference in the same edit, because the new architecture doc replaces it.

## Files to Change
- `arcanum-create-issue/scripts/start.sh`: header comment (spec link and dead 690 plan link)
- `arcanum-create-issue/scripts/publish.sh`: header comment (spec link and dead 690 plan link)
- `core/lib/commands/arcanum-create-issue/ArcanumCreateIssueStart.js`: class JSDoc
- `core/lib/commands/arcanum-create-issue/ArcanumCreateIssuePublish.js`: class JSDoc
- `core/lib/commands/arcanum-create-issue/IssueLabels.js`: class JSDoc
- `core/lib/commands/arcanum-create-issue/DraftStore.js`: class JSDoc

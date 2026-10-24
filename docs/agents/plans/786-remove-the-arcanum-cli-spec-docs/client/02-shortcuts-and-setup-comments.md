# Shortcut and setup wizard comments

Repoint the comments that cite `specs/arcanum-cli/shortcuts-and-setup.md` to the `## Shortcuts` and `## Setup wizard` sections of `docs/agents/architecture/arcanum-cli.md`, choosing the subsection whose content each comment describes.

## Files to Change
- `cli/lib/booleanToken.js` → `#design-rules`, the section with the on/off token rule. Verify it, or use `#shortcuts`.
- `cli/lib/commands/config/shortcuts/index.js` (`#shortcut-set`) → `#shortcuts`
- `cli/lib/commands/config/shortcuts/common.js` → `#design-rules`
- `cli/lib/commands/config/shortcuts/singleValue.js` → `#shortcut-output`
- `cli/lib/commands/config/shortcuts/defaultTier.js` (`#per-setting-flow`) → `#per-setting-flow`
- `cli/lib/commands/config/shortcuts/nextStep.js` → `#shortcuts`
- `cli/lib/commands/config/shortcuts/agentsEmail.js` → `#agents-email`
- `cli/lib/commands/config/shortcuts/ignoreChecks.js` → `#ignore-checks`
- `cli/lib/commands/config/setup.js` → `#setup-wizard`. Use `#coverage-and-order` if the comment is about section order.
- `cli/lib/commands/config/setup/setting.js` → `#per-setting-flow`
- `cli/lib/commands/config/setup/identity.js` → `#coverage-and-order`, or `#setup-wizard`
- `cli/lib/commands/config/setup/ci.js` → `#setup-wizard`, or `#ignore-checks` where it describes the list semantics
- `cli/lib/commands/config/setup/summary.js` → `#errors-interrupts-and-summary`
- `cli/lib/prompter.js` → `#terminal`

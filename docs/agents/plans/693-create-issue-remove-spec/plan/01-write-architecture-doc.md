# Write the architecture doc
Create `docs/agents/architecture/arcanum-create-issue.md`. It is a standalone description of what has shipped, in the style of the sibling architecture docs. Write it in the present tense, without "Proposed", "Implemented in #..." or references to the epic's sub-issues. Use `docs/agents/specs/arcanum-create-issue.md` as the source, and check each rule against the code (`core/lib/commands/arcanum-create-issue/*.js`, `arcanum-create-issue/scripts/*.sh`, `arcanum-create-issue/steps/*.md`). Where the code and the spec differ, document what the code does.

Sections:
- **Overview**: what `/arcanum-create-issue` does (an interview modeled on `enhance-issue`, then it creates a new GitHub issue with labels). Steps: start/resume, explore, dialogue with the fixed **Epic?** and **Labels** items, publish. It never touches git and never spawns issues.
- **Draft file**:
  - location `.claude/state/create-issue/<timestamp>.md` (git-ignored)
  - the first `# Title` heading is the title and the rest is the body
  - deleted only after a successful create, and kept on abandon or failure
  - resume prompt, and no automatic cleanup
- **Native commands**: `arcanum-create-issue-start` (`scripts/start.sh <repo_path> [--new | --resume <draft>]`) and `arcanum-create-issue-publish` (`scripts/publish.sh <repo_path> <draft> "<title>" [--confirmed] [--shipit-confirmed] <label>...`). Cover:
  - native-only, `context: 'repo'`, `engine_dispatch --native-only`, with a link to Script Engine
  - the GitHub preflight
  - the exit-code table (`0`/`1`/`2`/`4`)
  - the output-key table
  - the `publish` behavior: validation, single REST create with labels, the declined path, success and failure
- **Label rules**:
  - any label is allowed
  - the default is `Writting`, and the suggestions are `Documentation`, `Feature`, `Refactor`, `Bug`, `Epic` and `shipit`
  - type labels are suggested by the AI, and `Epic` is set through the Epic? item
  - `shipit` is opt-in only and confirmed at its own prompt, otherwise it is dropped. `tag_mutate.sh` still refuses it, and publish never goes through it.
  - labels are matched case-insensitively with duplicates removed, and missing labels are created (`Epic` `fbca04`, others `ededed`) with a `WARNING=` line
  - removing every label is allowed
- **Edge cases**: a short table, taken from the spec's Edge cases.
- **See also**: Issue Tags (`epic` and `shipit`), Skill Finish (closing report and next step), Script Engine, Per-Repo Migrations, and `docs/agents/issue-enhancement.md`. Point to `arcanum-create-issue/steps/*.md` for the exact prompt wording instead of copying it.

Then add a row to the table in `docs/agents/architecture.md`, after Issue Tags:
`| [arcanum-create-issue](architecture/arcanum-create-issue.md) | The /arcanum-create-issue contract: draft file lifecycle, the native start/publish commands (output keys and exit codes), and label rules. |`

## Files to Change
- `docs/agents/architecture/arcanum-create-issue.md`: new file
- `docs/agents/architecture.md`: new row in the index table

# Setup Contributing Guide

Create or update `docs/agents/contributing.md` adapted to the project's language and stack.

## Step 1 — Gather information from all sources

Collect context from the following sources, in order:

1. **Existing file:** If `docs/agents/contributing.md` already exists, read it. Its content is the baseline — preserve any project-specific rules already documented.
2. **README.md:** If present, read it. It may mention testing commands, linting tools, or contribution conventions.
3. **Project files:** Look for `package.json`, `Makefile`, `Gemfile`, `pyproject.toml`, etc. to determine the actual test and lint commands.
4. **`.circleci/config.yml`:** If present, read it to extract the folder-to-job mapping — which jobs run for which top-level folders (via path filters or job names). Extract the local commands for each job (e.g. `cd <folder> && yarn coverage && yarn lint`). This information will be used to generate a concrete CI Checks table.

## Step 2 — Determine the project language

Infer the main language from the project files (e.g. `package.json` → JavaScript/Node.js, `Gemfile` → Ruby, `pyproject.toml` → Python, `go.mod` → Go, `Cargo.toml` → Rust, `pom.xml` → Java).

If the language cannot be confidently determined, ask the user:

```
What is the main programming language of this project? (needed to write the contributing guide with relevant code examples)
```

Wait for the answer before proceeding.

## Step 3 — Read the sample contributing guide

Read [sample-contributing.md](sample-contributing.md). This is the reference template — it contains all the sections and guidelines to include, with JavaScript/Node.js examples.

## Step 4 — Draft the contributing guide

Produce a draft of `docs/agents/contributing.md` based on the sample, with the following adaptations:

- Replace all code examples with equivalent examples in the project's language and idiomatic style
- Adjust file naming conventions to match the language (e.g. `snake_case.rb` for Ruby, `PascalCase.java` for Java)
- Replace tooling references (e.g. `yarn test` / `yarn lint`) with the project's actual commands if found; otherwise use placeholders
- Preserve all sections and their intent — do not remove or summarise guidelines
- Remove the entrypoints table if not applicable, or update it to reflect the project's actual entrypoints if known
- If the existing file already has project-specific rules not in the sample, include them
- **CI Checks table:** If `.circleci/config.yml` was found in Step 1, replace the dynamic instructions in the CI Checks section with a concrete table mapping each modified folder to its CircleCI job names and local commands to run. If the config was not found, keep the dynamic instructions as-is.

## Step 5 — Present draft and ask for confirmation

Show the drafted content to the user and ask:

```
This is the proposed docs/agents/contributing.md (adapted for <language>). Shall I write it, or would you like to make changes?
```

Wait for the user's response.

- If the user confirms: proceed to write the file.
- If the user requests changes: apply them and ask again before writing.

## Step 6 — Write docs/agents/contributing.md

Write (or overwrite) the file with the confirmed content.

## Step 7 — Update AGENTS.md documentation table

Add a row for the contributing guide in the `## Documentation` table inside `AGENTS.md` if not already present:

```
| [Contributing](docs/agents/contributing.md) | Commit guidelines, PR standards, code organization, and refactoring rules. |
```

## Step 8 — Confirm

Tell the user:

```
docs/agents/contributing.md written and adapted for <language>.
AGENTS.md updated.
```

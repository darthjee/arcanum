# Setup Contributing Guide

Create `docs/agents/contributing.md` adapted to the project's language and stack.

## Step 1 — Determine the project language

Check the project files to infer the main language (e.g. look for `package.json`, `Gemfile`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, etc.).

If the language cannot be confidently determined from the files, ask the user:

```
What is the main programming language of this project? (needed to write the contributing guide with relevant code examples)
```

Wait for the answer before proceeding.

## Step 2 — Read the sample contributing guide

Read [sample-contributing.md](sample-contributing.md). This is the reference template — it contains all the sections and guidelines to include, with JavaScript/Node.js examples.

## Step 3 — Rewrite for the project's language

Produce a new `docs/agents/contributing.md` based on the sample, with the following adaptations:

- Replace all code examples with equivalent examples in the project's language and idiomatic style
- Adjust file naming conventions to match the language (e.g. `snake_case.rb` for Ruby, `PascalCase.java` for Java)
- Adjust tooling references (e.g. replace `yarn test` / `yarn lint` with the project's actual test and lint commands if known, otherwise use placeholders)
- Preserve all sections and their intent — do not remove or summarise guidelines
- Remove the entrypoints table if not applicable, or update it to reflect the project's actual entrypoints if known

Keep the tone concise and direct.

## Step 4 — Update AGENTS.md documentation table

Add a row for the contributing guide in the `## Documentation` table inside `AGENTS.md`:

```
| [Contributing](docs/agents/contributing.md) | Commit guidelines, PR standards, code organization, and refactoring rules. |
```

## Step 5 — Confirm

Tell the user:

```
docs/agents/contributing.md created and adapted for <language>.
AGENTS.md updated.
```

# Process Log

Throughout the entire fix process, maintain a living log in the `prs` folder. This log is for the user to follow your reasoning step by step.

## Folder structure

The `prs` folder lives alongside the `issues` and `plans` folders (look for it documented in `AGENTS.md` / `CLAUDE.md`, or infer it as a sibling). Create it if it does not exist.

Inside `prs`, create a folder named after the issue:

    <prs_folder>/<id>_<issue_name>/

For example: `docs/prs/05_add_tables/`

## Log files

Write one or more markdown files inside the log folder. Split by concern — do not cram everything into a single file. Suggested files:

| File | Purpose |
|------|---------|
| `reasoning.md` | Why you are approaching the fix this way; trade-offs considered |
| `files.md` | Relevant files found during codebase exploration |
| `steps.md` | The concrete actions to be executed, in order |

Add more files if the issue warrants it (e.g., `database.md`, `api.md`).

## When to write

- **Before acting:** write your reasoning and the list of relevant files as soon as you finish codebase exploration, before making any changes.
- **As you act:** update `steps.md` in real time — mark each step as done when completed and add the next step before starting it.
- **After acting:** append any observations, surprises, or deviations from the plan.

## Content guidelines

Write in English. Be concise but specific. Each entry should let the user reconstruct what you did and why.

### `reasoning.md` — example structure

```markdown
# Reasoning: <Issue Title>

## Approach
<Why this approach was chosen over alternatives>

## Constraints
<Any limitations discovered during exploration>
```

### `files.md` — example structure

```markdown
# Relevant Files: <Issue Title>

## Files to change
- `app/models/client.rb:42` — add `connect` method here; this is where all connection logic lives

## Files to read (context only)
- `app/services/connection_pool.rb` — understand existing pooling before implementing connect
```

### `steps.md` — example structure

```markdown
# Steps: <Issue Title>

## [ ] Step 1 — Add `connect` method to Client
File: `app/models/client.rb`

Add after line 41:

```ruby
def connect(host, port)
  @connection = Connection.new(host, port)
  @connection.open
end
```

## [ ] Step 2 — Write unit test
File: `spec/models/client_spec.rb`
...
```

Mark steps as `[x]` when done.

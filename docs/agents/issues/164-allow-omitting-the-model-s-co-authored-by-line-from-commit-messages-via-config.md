# Allow omitting the model's Co-Authored-By line from commit messages via config

## Context

When a repo has opted into the "new" commit message template (detected by the
presence of `.github/commit_message_template-2.0.md`, via
`arcanum/_lib/commit_template.sh`'s `commit_template_engine_get`), every commit
produced by `auto-fix-issue`, `auto-new-issue`, and `auto-plan-issue` emits two
`Co-Authored-By:` trailers:

- one for the AI model, e.g. `Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>`
- one for the acting agent, e.g. `Co-Authored-By: ${AGENT} agent <${AGENT_EMAIL}>`
  (whose email is resolved by `arcanum/_lib/agent_email.sh`'s `agent_email_get`,
  itself layered on top of `arcanum/_lib/repo_config.sh`'s local-then-repo
  `git.email` config lookup)

The model's line is currently a literal, unconditional
`echo "Co-Authored-By: ${MODEL_NAME} <${MODEL_EMAIL}>"` hardcoded identically
in three scripts: `auto-fix-issue/scripts/commit_change.sh`,
`auto-new-issue/scripts/commit_issue.sh`, and
`auto-plan-issue/scripts/commit_plan.sh`. There is no way to disable it today.

Some maintainers/orgs don't want the model attributed as a co-author on every
commit and would rather keep only the agent's line. Editing the *content* of
`.github/commit_message_template-2.0.md` doesn't help: per `commit_template.sh`'s
own comments, only that file's presence is checked to pick the "new" vs "old"
template engine — its content is purely human-facing documentation and is
never parsed at runtime.

Arcanum already has a config precedence pattern for exactly this kind of
per-repo/per-checkout toggle (`git.email`, `git.safe_branch`): a local override
in `.claude/state/arcanum-config.json` wins over a repo-wide default in
`.claude/configuration/arcanum-repo-config.json`, both read through
`repo_config_read` in `arcanum/_lib/repo_config.sh`. This issue extends that
pattern to let the model co-author line be omitted.

## What needs to be done

- Define a new `git` namespace config key (e.g. `git.omit_model_coauthor`,
  final naming up to whoever implements this) resolved with the same
  local-overrides-repo precedence already used by `git.email` — likely via a
  new small helper (mirroring `agent_email_get`'s shape) in
  `arcanum/_lib/agent_email.sh` or a new sibling lib under `arcanum/_lib/`.
- Update `auto-fix-issue/scripts/commit_change.sh`,
  `auto-new-issue/scripts/commit_issue.sh`, and
  `auto-plan-issue/scripts/commit_plan.sh` to consult that config and skip
  emitting the model's `Co-Authored-By:` line when it's set, while always
  still emitting the agent's line.
- Keep the existing default (both lines emitted) unchanged when the config key
  is absent, so this is purely opt-in and backward compatible.
- Document the new key in `docs/guides/arcanum-repo-config.md` alongside
  `git.email`/`git.safe_branch`.
- Update the human-facing comments/docs in
  `.github/commit_message_template-2.0.md` (and any other
  `commit_message_template*.md`) to mention the new toggle, keeping in mind
  their content is documentation only and never parsed at runtime.

## Acceptance criteria

- [ ] TODO

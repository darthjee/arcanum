# Node Plan: discuss-issue render_issue expands $ patterns in section text

Main plan: [plan.md](plan.md)

## Shared contracts

Implements the native side of the plan's **Substitution semantics** for both
placeholder sets, and owns all specs (`core/spec/`), including the shell-vs-native
parity specs that run scripter's `render_issue_shell.sh` / `reply_comment_shell.sh`
with the hostile fixture.

## Steps

- [01 — Single-pass render in DiscussIssueRenderIssue](node/01-discuss-issue-render-single-pass.md)
- [02 — Single-pass render in AutoFixAllReplyComment](node/02-reply-comment-single-pass.md)
- [03 — Harden the {agent} replaceAll calls](node/03-harden-agent-replace.md)
- [04 — Specs: verbatim output and parity with hostile input](node/04-specs.md)

## CI Checks

- `core`: `cd core && yarn test` (CI job: test), `cd core && yarn lint` (CI job: lint)

## Notes

- If a shared helper fits better than two local implementations, add a tiny util under
  `core/lib/utils/` (e.g. `fillTemplate(template, values)`). It must stay clean
  under `yarn duplication`.

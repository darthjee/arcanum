# skill-writer Plan: Codacy: misc markdownlint singles — MD012/MD025/MD036/MD038/MD047 (5 findings)

Main plan: [plan.md](plan.md)

## Shared contracts

- Produces the new filename `init-claude/setup_specialist_dispatch_permissions.md` (see [plan.md](plan.md)'s Shared contracts) — `architect` and `scripter` both update references to it, so keep this exact name.

## Implementation Steps

### Step 1 — Split init-claude/setup_permissions.md and update SKILL.md

`init-claude/setup_permissions.md` currently bundles two independent, self-contained onboarding procedures under one file with two H1 headings (line 1 and line 33), which is what markdownlint's MD025 flags. Split it:

- Keep lines 1-31 ("Setup the `shipit`-Merge Permission Exemption", including its own Step 1/2/3) in `init-claude/setup_permissions.md`, unchanged content-wise.
- Move lines 33-65 ("Setup the Common Specialist-Dispatch Permission Exemption", including its own Step 1/2/3) into a new file, `init-claude/setup_specialist_dispatch_permissions.md`, with the same content and its own single H1.
- Update `init-claude/SKILL.md`'s Step 11 (currently "After the repository labels are set up, read and follow [setup_permissions.md](setup_permissions.md).") to read and follow both files.

### Step 2 — Fix MD036 in reply.tmpl.md

`auto-fix-all/templates/reply.tmpl.md` line 3, `_Replied by: %%AGENT%% agent (%%MODEL_NAME%% %%MODEL_EMAIL%%)_`, is an intentional italic attribution/signature line rendered at the end of an agent's PR reply comment — not a mislabeled heading. Per the issue's resolved discussion, suppress MD036 for that line inline (e.g. an HTML comment such as `<!-- markdownlint-disable-line MD036 -->` on the preceding line) rather than converting it to a real heading, since a real `#`/`##` heading would render oddly inside an actual GitHub PR comment.

## Files to Change

- `init-claude/setup_permissions.md` — keep only the `shipit`-Merge Permission Exemption procedure (lines 1-31).
- `init-claude/setup_specialist_dispatch_permissions.md` (new) — the Common Specialist-Dispatch Permission Exemption procedure (former lines 33-65), with its own H1.
- `init-claude/SKILL.md` — update Step 11 to read and follow both `setup_permissions.md` and `setup_specialist_dispatch_permissions.md`.
- `auto-fix-all/templates/reply.tmpl.md` — suppress MD036 inline on the `_Replied by: ..._` line instead of converting it to a heading.

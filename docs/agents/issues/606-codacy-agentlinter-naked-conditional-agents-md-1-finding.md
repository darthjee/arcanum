# Issue: Codacy: Agentlinter naked-conditional — AGENTS.md (1 finding)

## Description

Codacy (tool **Agentlinter**, pattern `Agentlinter_clarity_naked-conditional`, category BestPractice, severity **Warning**) flags a vague conditional in the **Boundaries** section of `AGENTS.md` (reported at line 36 in the 2026-09-24 snapshot, commit `3408937`; currently line 42):

```markdown
- **Never embed deterministic logic in skill markdown, unless it is trivial enough that AI misinterpretation risk is negligible.** Otherwise, extract it into `<skill>/scripts/*.sh` or `arcanum/_lib/` instead of prose relying on AI judgment. See [Script Preference](docs/agents/architecture/script-preference.md) for how to judge that risk.
```

> Vague conditional: "- **Never embed deterministic logic in skill markdown, unless it is trivial enou". Specify exact threshold or trigger.

## Problem

"Trivial enough that AI misinterpretation risk is negligible" has no concrete threshold. The linked `docs/agents/architecture/script-preference.md` doesn't define one either: its guideline is just the question "could this step produce a wrong result due to AI misinterpretation?".

The repo already has concrete criteria, but only in `.claude/agents/skill-reviewer.md`:

- **Allowed inline:** a single command with flags; two commands chained with `&&`/`||` in an obvious way; a call to an existing `<skill>/scripts/` script; a command that only prints or reads a variable.
- **Must be extracted:** a multi-stage pipeline doing non-trivial parsing or transformation; a loop or conditional with a multi-line body; process substitution or a heredoc used for data manipulation; a command sequence with intermediate variables for validation or parsing.

The Boundaries rule and the reviewer's checklist can drift apart because nothing connects them.

A similar vague rule sits in **Conventions** (currently line 21): "Whenever possible, extract skill logic into scripts". Codacy didn't flag it, but it has the same missing threshold.

## Expected Behavior

- Codacy reports zero `Agentlinter_clarity_naked-conditional` findings in `AGENTS.md`.
- The Boundaries rule states a concrete threshold inline for when inline logic is allowed, instead of "trivial enough".
- The Conventions bullet "Whenever possible, extract skill logic into scripts" uses the same threshold instead of "whenever possible".
- The canonical definition of "trivial" lives in `docs/agents/architecture/script-preference.md`.
- `.claude/agents/skill-reviewer.md` links to that definition instead of keeping its own copy.

## Solution

1. **`docs/agents/architecture/script-preference.md`:** add an "Allowed inline vs. must extract" section, moved from the `skill-reviewer` checklist, as the single source of truth:
   - **Allowed inline:** a single command with flags; two commands chained with `&&`/`||` in an obvious way; a call to an existing `<skill>/scripts/` or `arcanum/_lib/` script; a command that only prints or reads a variable.
   - **Must be extracted:** a multi-stage pipeline doing non-trivial parsing or transformation; a loop or conditional with a multi-line body; process substitution or a heredoc used for data manipulation; a command sequence with intermediate variables for validation or parsing.
2. **`AGENTS.md` Boundaries:** rewrite the bullet so the threshold is written out inline, with a link to the full criteria, e.g.:
   > **Never embed deterministic logic in skill markdown beyond a single command (optionally one `&&`/`||` chain), a call to an existing script, or reading/printing a variable.** Extract anything with loops, conditionals, multi-stage parsing pipelines, data-manipulating heredocs or process substitution, or intermediate validation/parsing variables into `<skill>/scripts/*.sh` or `arcanum/_lib/`. See [Script Preference](docs/agents/architecture/script-preference.md) for the full criteria.
3. **`AGENTS.md` Conventions:** replace "Whenever possible, extract skill logic into scripts…" with wording tied to the same threshold. For example: "Extract any skill logic beyond the inline threshold in [Script Preference](docs/agents/architecture/script-preference.md) into scripts, to make behavior deterministic and reduce token consumption." Avoid introducing new "unless"/"whenever possible" phrasing.
4. **`.claude/agents/skill-reviewer.md`:** replace its inline "Examples of complex logic" / "Do not flag" lists with a link to the new `script-preference.md` section, keeping the review procedure and report format unchanged.

Owner: `architect`. `AGENTS.md`, `docs/agents/`, and `.claude/agents/` are all root-level or documentation files.

## Benefits

- Clears the Codacy warning and pre-empts a similar one on the Conventions bullet.
- Gives agents and the `skill-reviewer` one concrete, shared threshold, defined in one place, instead of a judgment call.

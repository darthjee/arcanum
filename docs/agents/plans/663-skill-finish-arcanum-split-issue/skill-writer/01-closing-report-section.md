# Closing report section and planning label change

Add a single canonical "Closing report" section (placed in `steps/push.md`, since that is where the skill normally ends; other steps link to it) mirroring `enhance-issue/steps/publish.md`:

- The call shape: `../../arcanum/_lib/finish_report.sh "$REPO_PATH" --skill arcanum-split-issue --status success|declined|failed --summary "<one line>" --issue <id> [--sub-issue <id>]... [--label-change <before>:<after>]...`.
- Rules: relay stdout verbatim as the last thing printed before any next-step offer; never hand-format; pass only links/label changes that actually happened; no offer after `declined`/`failed`; if the script exits non-zero, say so in one line and end.
- A "Failed exits" procedure: release the working tree (`checkout_safe_branch.sh`), keep local draft/sub-issue files, leave the `Planning` label in place, print the `failed` report naming the step, end.

Also update `SKILL.md`'s Step 5 heading/text if needed so it reflects "push, report, and next step", and mention in `SKILL.md` that every exit ends with the closing report defined in `steps/push.md`.

## Files to Change
- `arcanum-split-issue/steps/push.md` — new "Closing report" and "Failed exits" sections.
- `arcanum-split-issue/SKILL.md` — Step 5 wording; pointer to the closing report rule.

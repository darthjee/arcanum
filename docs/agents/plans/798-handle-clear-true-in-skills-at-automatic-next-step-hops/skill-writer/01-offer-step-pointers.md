# Pointers in the interactive offer steps

Each auto-keyed offer gets a one-line `CLEAR=true` rule next to its
`CHOICE=yes` with `AUTO=true` bullet: "With `CLEAR=true`, after relaying the
notice, hand off `<cmd>` per [Clearing](<rel>/skill-finish.md#clearing) instead of
invoking it inline." Also add `CLEAR=true` to the contract blockquote.

- enhance-issue publish step: `<cmd>` = `/discuss-issue <id>`.
- plan-issue offer: `<cmd>` = `/loop /auto-resolve-issue <id>`.
- discuss-issue **second** offer (step 8.8): `<cmd>` =
  `/loop /auto-resolve-issue <id>`. The working tree was already released in
  step 6 of the plan-it path, so nothing else changes.

## Files to Change
- `enhance-issue/steps/publish.md` — CLEAR rule + blockquote.
- `plan-issue/steps/write_and_confirm.md` — CLEAR rule + blockquote.
- `discuss-issue/steps/discuss_and_save.md` — second offer's CLEAR rule + blockquote.

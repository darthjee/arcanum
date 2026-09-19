# Fix MD038 in script-engine.md

`docs/agents/architecture/script-engine.md` line 48 ends with the sentence `` ...**without** the `arcanum: ` stderr line.`` — the code span `` `arcanum: ` `` has a stray trailing space inside the backticks. It refers to the literal `arcanum: ` stderr-line prefix conceptually, not as text immediately followed by more prose, so simply move the space outside the backticks (or drop it, since the sentence already ends right after): `` the `arcanum:` stderr line.``

## Files to Change

- `docs/agents/architecture/script-engine.md` — remove the trailing space inside the `` `arcanum: ` `` code span on line 48.

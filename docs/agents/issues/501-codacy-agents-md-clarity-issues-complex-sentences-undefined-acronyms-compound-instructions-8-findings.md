## Description

Codacy's Agentlinter tool flags 8 clarity findings in `AGENTS.md`: overly complex sentences, undefined acronyms, and compound instructions bundling multiple actions into one bullet.

**Source:** Codacy quality issues, category Comprehensibility, severity **Info**, tool Agentlinter.

## Findings

| Line | Pattern | Message |
|------|---------|---------|
| 7 | `Agentlinter_clarity_sentence-complexity` | Overly complex sentence (68 words). Break into shorter instructions. |
| 7 | `Agentlinter_clarity_undefined-term` | Undefined acronym "JSCPD" — define on first use or add to glossary. |
| 13 | `Agentlinter_clarity_sentence-complexity` | Overly complex sentence (50 words). Break into shorter instructions. |
| 35 | `Agentlinter_clarity_undefined-term` | Undefined acronym "AUTO" — define on first use or add to glossary. |
| 38 | `Agentlinter_clarity_compound-instruction` | Compound instruction with 4 actions in one bullet. Split into separate items. |
| 39 | `Agentlinter_clarity_compound-instruction` | Compound instruction with 3 actions in one bullet. Split into separate items. |
| 40 | `Agentlinter_clarity_sentence-complexity` | Overly complex sentence (41 words). Break into shorter instructions. |
| 49 | `Agentlinter_clarity_no-vague-instructions` | Vague instruction flagged in the architecture docs table row. |

## Expected Behavior

- The long sentences on lines 7, 13, and 40 are split into shorter, single-idea instructions.
- "JSCPD" (line 7) and "AUTO" (line 35, from the `AUTO-GENERATED` boundary bullets) are spelled out or briefly defined on first use.
- The 3-4 action bullets on lines 38-39 (the `Boundaries` list) are split so each bullet states one action.
- Re-running Agentlinter/Codacy on `AGENTS.md` shows zero findings among these 8 locations.

## Solution

Edit `AGENTS.md` bullet-by-bullet: shorten the flagged sentences, spell out "JSCPD" (jscpd, the duplication tool) and clarify "AUTO-GENERATED" isn't an undefined acronym but reads as one out of context, and split the multi-action Boundaries bullets on lines 38-39 into one action per line.


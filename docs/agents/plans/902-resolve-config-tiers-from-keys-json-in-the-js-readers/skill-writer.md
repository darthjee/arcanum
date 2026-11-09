# Skill-writer Plan: Resolve config tiers from keys.json in the JS readers

Main plan: [plan.md](plan.md)

## Shared contracts

You rely on (from node): a tier object in the `/arcanum-check-config` JSON may carry `"allowed": false, "ignored": "tier not allowed"`, and `final` never comes from such a tier.

## Implementation Steps

### Step 1 — Explain ignored tiers in the check-config report

In `arcanum-check-config/SKILL.md` step 3, after the "final value comes from" sentence, add one rule: for each tier whose object has `"ignored": "tier not allowed"`, add one sentence: "`<tier>` sets `<key>`, but arcanum does not read it from that tier (see `shared/lib/config/keys.json`)." Mention the `tiers` field. Keep the JSON relayed verbatim.

## Files to Change

- `arcanum-check-config/SKILL.md`: the ignored-tier sentence.

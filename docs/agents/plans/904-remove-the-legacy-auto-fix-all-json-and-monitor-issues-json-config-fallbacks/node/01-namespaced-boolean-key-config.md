# NamespacedBooleanKeyConfig and its subclasses

- **`NamespacedBooleanKeyConfig`:**
  - Remove the `legacyFileName` constructor option, `_legacyFileName` and `_legacyFileForKey`.
  - `_readValue` returns `JSON.stringify(value)` from `_readNewValue`, or `undefined`. There is no legacy step.
  - `_buildUpdate` no longer seeds: a missing namespace starts as `{}` (`{ ...base, [ns]: { ...(base[ns] ?? {}), [key]: value } }`).
  - Update the class and method JSDoc.
- **`AutoFixAllConfig` / `MonitorIssuesConfig`:** stop passing `legacyFileName`, and fix their JSDoc.
- **Specs:**
  - `NamespacedBooleanKeyConfig_spec.js`: drop `legacyFileName` from the constructions, and remove or rewrite the legacy cases.
  - `AutoFixAllConfig_spec.js` and `MonitorIssuesConfig_spec.js`: replace the "falls back to the legacy …" / "seeds from legacy" cases with "ignores a legacy file that is present" for get, is-enabled and set.

## Files to Change

- `core/lib/utils/config/NamespacedBooleanKeyConfig.js`: remove the legacy option, the read fallback and the write seed.
- `core/lib/commands/auto-fix-all/AutoFixAllConfig.js`: drop `legacyFileName`, and update the JSDoc.
- `core/lib/commands/monitor-issues/MonitorIssuesConfig.js`: drop `legacyFileName`, and update the JSDoc.
- `core/spec/lib/utils/config/NamespacedBooleanKeyConfig_spec.js`: update the constructions and cases.
- `core/spec/lib/commands/auto-fix-all/AutoFixAllConfig_spec.js`: change the legacy cases to "ignored" cases.
- `core/spec/lib/commands/monitor-issues/MonitorIssuesConfig_spec.js`: change the legacy cases to "ignored" cases.

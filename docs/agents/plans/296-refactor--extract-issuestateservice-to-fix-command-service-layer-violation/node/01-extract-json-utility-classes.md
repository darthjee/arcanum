# Extract JSON utility classes

Pull `IssueState`'s 3 JSON-handling private methods out into their own classes under a new `core/lib/utils/json/` folder. These are framed as generic JSON operations (not state-file-specific), even though `IssueStateService` (Step 03) is currently their only caller:

- `_parseJson(jsonValue)` → `JsonParser#parse(jsonValue)` — try/catch `JSON.parse`, returning `{ ok: true, value }` on success, `{ ok: false }` on invalid JSON. Keep the exact same return shape so callers don't need to change.
- `_formatValue(value)` → `JsonValueFormatter#format(value)` — mirrors `jq -r '.[$field] // empty'`: `null`/`undefined`/`false` → `''`, strings pass through raw, anything else → `JSON.stringify(value, null, 2)`.
- `_read(stateFile)` → `JsonReader#read(stateFile)` — reads and parses a JSON file, returning `{}` for any failure (missing file, empty content, invalid JSON) — never throws.

Copy each method's body verbatim (same logic, same edge-case handling) into its new class as a public instance method; do not change behavior. Write a full spec for each class with 100% coverage — every branch in the current `IssueState_spec.js` that exercises these behaviors indirectly (e.g. corrupt-JSON degrade, missing-file read, jq-style formatting of objects/arrays/strings/`null`/`false`) should have a direct, focused unit test on the new class instead.

## Files to Change

- `core/lib/utils/json/JsonParser.js` — new, `parse(jsonValue)`.
- `core/lib/utils/json/JsonValueFormatter.js` — new, `format(value)`.
- `core/lib/utils/json/JsonReader.js` — new, `read(stateFile)`.
- `core/spec/lib/utils/json/JsonParser_spec.js` — new.
- `core/spec/lib/utils/json/JsonValueFormatter_spec.js` — new.
- `core/spec/lib/utils/json/JsonReader_spec.js` — new.

# Bundle smoke spec

Add a case to the bundle smoke spec: `arcanum self-update --help` exits `0` from the built bundle (temp copy), and its stdout starts with `Usage: arcanum self-update`. It installs nothing and makes no npm call.

## Files to Change
- `cli/spec/smoke/bundle_spec.js` — the `self-update --help` case.

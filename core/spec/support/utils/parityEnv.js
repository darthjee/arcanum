/**
 * Build a matched pair of env objects (shell-side `FAKE_GH_*`, native-side
 * `FAKE_FETCH_*`) from one shared scenario object, so both sides of a
 * comparison are seeded identically without repeating every field twice.
 * @param {object} fakeGhEnv - base env (PATH-prepended fake `gh`).
 * @param {object} [scenario] - the scenario's shell/native env var overrides.
 * @param {object} [scenario.ghVars] - `FAKE_GH_*` overrides, for the shell side.
 * @param {object} [scenario.fetchVars] - `FAKE_FETCH_*` overrides, for the native side.
 * @returns {{shellEnv: object, nativeEnv: object}} the two env objects.
 */
export function seedEnv(fakeGhEnv, { ghVars = {}, fetchVars = {} } = {}) {
  return {
    shellEnv: { ...fakeGhEnv, ...ghVars },
    nativeEnv: { ...fakeGhEnv, ARCANUM_TEST_FAKE_FETCH: 'github', ...fetchVars }
  };
}

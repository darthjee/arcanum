/**
 * Trivial validation class proving the `core/` toolchain works end-to-end
 * (lint, test, coverage). Temporary — scheduled for removal once #193
 * lands the first real migrated entrypoint.
 */
class Greeter {
  /**
   * Build a greeting for the given name.
   * @param {string} name - the name to greet, may be falsy.
   * @returns {string} the greeting.
   */
  greet(name) {
    if (name) {
      return `Hello, ${name}!`;
    }

    return 'Hello, stranger!';
  }
}

export default Greeter;

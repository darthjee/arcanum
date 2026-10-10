// Preload module (meant to be loaded via `node --import <fileURL>`,
// before `core/bin/arcanum` itself is imported) that stubs
// `Dispatcher#dispatch` to reject with a `DispatchFailure` whose exit
// code comes from `ARCANUM_TEST_DISPATCH_FAILURE_CODE` and whose stdout
// payload is `STATUS=failed\n`. Used by core/spec/bin/arcanum_spec.js to
// prove core/bin/arcanum's exit-code contract (125-127 -> 1) without
// adding a fixture command to the production registry. Left inert when
// the variable is unset.
import Dispatcher from '../../../lib/core/dispatcher.js';
import DispatchFailure from '../../../lib/utils/errors/DispatchFailure.js';

const code = process.env.ARCANUM_TEST_DISPATCH_FAILURE_CODE;

if (code !== undefined && code !== '') {
  Dispatcher.prototype.dispatch = async function dispatch() {
    throw new DispatchFailure('STATUS=failed\n', Number(code));
  };
}

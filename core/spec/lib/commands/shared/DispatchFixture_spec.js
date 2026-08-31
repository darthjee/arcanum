import DispatchFixture from '../../../../lib/commands/shared/DispatchFixture.js';

describe('DispatchFixture', () => {
  let fixture;

  beforeEach(() => {
    fixture = new DispatchFixture();
  });

  describe('#crash', () => {
    it('always throws, simulating a native-side crash', () => {
      expect(() => fixture.crash()).toThrowError();
    });
  });
});

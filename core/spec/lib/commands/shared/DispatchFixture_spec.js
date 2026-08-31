import DispatchFixture from '../../../../lib/commands/shared/DispatchFixture.js';

describe('DispatchFixture', () => {
  let fixture;

  beforeEach(() => {
    fixture = new DispatchFixture();
  });

  describe('#run', () => {
    it('returns the fixture success line, byte-identical to the shell fixture', () => {
      expect(fixture.run()).toEqual('dispatch-fixture: ok\n');
    });
  });

  describe('#crash', () => {
    it('always throws, simulating a native-side crash', () => {
      expect(() => fixture.crash()).toThrowError();
    });
  });
});

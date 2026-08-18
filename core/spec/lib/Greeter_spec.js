import Greeter from '../../lib/Greeter.js';

describe('Greeter', () => {
  let greeter;

  beforeEach(() => {
    greeter = new Greeter();
  });

  describe('#greet', () => {
    it('greets the given name', () => {
      expect(greeter.greet('Arcanum')).toEqual('Hello, Arcanum!');
    });

    it('falls back to a generic greeting when name is falsy', () => {
      expect(greeter.greet('')).toEqual('Hello, stranger!');
    });
  });
});

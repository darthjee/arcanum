import ConfigError from '../../../../lib/shared/config/ConfigError.js';

describe('ConfigError', () => {
  it('sets code, message and file', () => {
    const error = new ConfigError('NOT_AN_OBJECT', 'Cannot index /x: not a JSON object', { file: '/x' });

    expect(error.code).toEqual('NOT_AN_OBJECT');
    expect(error.message).toEqual('Cannot index /x: not a JSON object');
    expect(error.file).toEqual('/x');
  });

  it('is an Error named ConfigError', () => {
    const error = new ConfigError('INVALID_JSON', 'bad');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ConfigError);
    expect(error.name).toEqual('ConfigError');
  });

  it('leaves file undefined when no options are given', () => {
    const error = new ConfigError('UNREGISTERED_KEY', 'key');

    expect(error.file).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it('keeps the cause when given', () => {
    const cause = new SyntaxError('boom');
    const error = new ConfigError('INVALID_JSON', 'boom', { cause });

    expect(error.cause).toBe(cause);
  });
});

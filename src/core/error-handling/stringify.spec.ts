import { stringify } from './stringify';

describe('stringify', () => {
  it('returns the message of an Error instance', () => {
    expect(stringify(new Error('boom'))).toBe('boom');
  });

  it('returns the message of a subclass of Error', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    expect(stringify(new CustomError('custom boom'))).toBe('custom boom');
  });

  it('stringifies a non-Error value', () => {
    expect(stringify('plain string')).toBe('plain string');
    expect(stringify(42)).toBe('42');
    expect(stringify({ a: 1 })).toBe('[object Object]');
  });

  it('stringifies null and undefined', () => {
    expect(stringify(null)).toBe('null');
    expect(stringify(undefined)).toBe('undefined');
  });
});

import { TruncatePipe } from './truncate.pipe';

/**
 * TruncatePipe is a pure pipe — no Angular runtime needed. Instantiate it
 * directly and call `transform` to test the pure transformation logic. (Pure
 * pipes are the cheapest thing in Angular to test: no TestBed, no fixture.)
 */
describe('TruncatePipe', () => {
  let pipe: TruncatePipe;

  beforeEach(() => {
    pipe = new TruncatePipe();
  });

  it('returns the full string when under the limit', () => {
    expect(pipe.transform('short', 30)).toBe('short');
  });

  it('returns the full string when exactly at the limit', () => {
    expect(pipe.transform('1234567890', 10)).toBe('1234567890');
  });

  it('truncates and appends the default ellipsis when over the limit', () => {
    expect(pipe.transform('Hello world this is long', 11)).toBe('Hello world…');
  });

  it('accepts a custom ellipsis argument', () => {
    expect(pipe.transform('Hello world this is long', 5, '...')).toBe('Hello...');
  });

  it('uses the default limit of 30 when only the value is passed', () => {
    const value = 'a'.repeat(40);
    expect(pipe.transform(value)).toBe(`${'a'.repeat(30)}…`);
  });

  it('trims trailing whitespace before appending the ellipsis', () => {
    // "Hello   " sliced to 8 → "Hello   ".trimEnd() → "Hello" + "…"
    expect(pipe.transform('Hello   world', 8)).toBe('Hello…');
  });

  it('returns empty string for empty input', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('returns empty string for a falsy input', () => {
    // The guard `if (!value)` covers null/undefined at runtime (typed callers
    // never pass those, but the guard exists for template safety).
    expect(pipe.transform('', 5)).toBe('');
  });
});

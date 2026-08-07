import { success, failed, type Result } from './result';
import { NetworkFailure, type Failure } from './error-handling/failure';

describe('Result', () => {
  it('success carries a value and is ok', () => {
    const r: Result<number> = success(42);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe(42);
    expect(r.ok && r.warning).toBeUndefined();
  });

  it('success can carry a non-blocking warning', () => {
    const warning: Failure = new NetworkFailure('stale cache shown');
    const r = success([1, 2], warning);
    if (r.ok) expect(r.warning).toBe(warning);
  });

  it('failed carries a failure and is not ok', () => {
    const failure = new NetworkFailure('offline');
    const r: Result<number> = failed(failure);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe(failure);
  });

  it('narrows via the ok discriminant', () => {
    const respond = (r: Result<string>): string =>
      r.ok ? `value:${r.value}` : `fail:${r.failure.message}`;
    expect(respond(success('hi'))).toBe('value:hi');
    expect(respond(failed(new NetworkFailure('offline')))).toBe('fail:offline');
  });
});

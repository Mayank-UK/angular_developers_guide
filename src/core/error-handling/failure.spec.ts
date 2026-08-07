import {
  FailureSeverity,
  NetworkFailure,
  ServerFailure,
  CacheFailure,
  AuthFailure,
  DatabaseFailure,
  UnknownFailure,
  Failure,
} from './failure';

describe('Failure subclasses', () => {
  it('each concrete failure fixes the kind/severity the UI switches on', () => {
    expect(new NetworkFailure().kind).toBe('network');
    expect(new NetworkFailure().severity).toBe(FailureSeverity.Critical);

    expect(new ServerFailure().kind).toBe('server');
    expect(new ServerFailure().severity).toBe(FailureSeverity.Critical);

    expect(new DatabaseFailure().kind).toBe('database');
    expect(new DatabaseFailure().severity).toBe(FailureSeverity.Critical);

    expect(new AuthFailure().kind).toBe('auth');
    expect(new AuthFailure().severity).toBe(FailureSeverity.Warning);

    expect(new UnknownFailure().kind).toBe('unknown');
    expect(new UnknownFailure().severity).toBe(FailureSeverity.Critical);
  });

  it('CacheFailure defaults to Warning but can be raised to Critical', () => {
    expect(new CacheFailure().severity).toBe(FailureSeverity.Warning);
    expect(new CacheFailure('last resort', undefined, FailureSeverity.Critical).severity).toBe(
      FailureSeverity.Critical,
    );
  });

  it('uses the default message when none is given', () => {
    expect(new NetworkFailure().message).toBe('No internet connection');
    expect(new ServerFailure().message).toBe('Server error');
    expect(new AuthFailure().message).toBe('Authentication failed');
    expect(new DatabaseFailure().message).toBe('Database error');
    expect(new UnknownFailure().message).toBe('Something went wrong');
  });
});

describe('Failure message + chain rendering', () => {
  it('message is just the raw message when there is no cause', () => {
    expect(new NetworkFailure('offline').message).toBe('offline');
  });

  it('message joins the whole cause chain with " + "', () => {
    const root = new NetworkFailure('no internet');
    const mid = new CacheFailure('cache miss', root);
    const top = new ServerFailure('server down', mid);
    expect(top.message).toBe('no internet + cache miss + server down');
  });

  it('chain renders a multi-line "caused by" trace for logs', () => {
    const failure: Failure = new CacheFailure(
      'cache read failed',
      new NetworkFailure('no internet'),
    );
    const lines = failure.chain.split('\n');
    expect(lines[0]).toBe('cache read failed');
    expect(lines[1]).toContain('caused by: no internet');
    expect(lines).toHaveLength(2);
  });

  it('a three-deep chain lists every link in order', () => {
    const failure: Failure = new ServerFailure(
      '500',
      new CacheFailure('cache miss', new NetworkFailure('offline')),
    );
    const lines = failure.chain.split('\n');
    expect(lines).toEqual([
      '500',
      '  → caused by: cache miss',
      '  → caused by: offline',
    ]);
  });
});

describe('FailureSeverity', () => {
  it('is a const-object + literal union, never an enum', () => {
    expect(FailureSeverity.Info).toBe('info');
    expect(FailureSeverity.Warning).toBe('warning');
    expect(FailureSeverity.Critical).toBe('critical');
  });
});

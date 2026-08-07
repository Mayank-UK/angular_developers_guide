import {
  AppException,
  NetworkException,
  ServerException,
  TimeoutException,
  AuthException,
  AppDatabaseException,
} from './exceptions';

describe('AppException', () => {
  it('is an Error subclass (so try/catch + .name work everywhere)', () => {
    const e = new NetworkException('offline');
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(AppException);
    expect(e.message).toBe('offline');
  });

  it('sets .name to the concrete class name automatically', () => {
    expect(new NetworkException().name).toBe('NetworkException');
    expect(new ServerException().name).toBe('ServerException');
    expect(new TimeoutException().name).toBe('TimeoutException');
    expect(new AuthException().name).toBe('AuthException');
    expect(new AppDatabaseException().name).toBe('AppDatabaseException');
  });

  it('preserves .cause across construction (useDefineForClassFields-safe)', () => {
    const root = new Error('underlying');
    const e = new ServerException('500', { cause: root });
    expect(e.cause).toBe(root);
  });

  it('cause is optional and undefined when not passed', () => {
    expect(new NetworkException().cause).toBeUndefined();
  });

  it('uses the default message when none is provided', () => {
    expect(new NetworkException().message).toBe('No internet connection');
    expect(new ServerException().message).toBe('Server error');
    expect(new TimeoutException().message).toBe('Request timed out');
    expect(new AuthException().message).toBe('Authentication error');
    expect(new AppDatabaseException().message).toBe('Database error');
  });
});

describe('TimeoutException', () => {
  it('is a subclass of NetworkException (timeout is a network failure)', () => {
    const e = new TimeoutException('slow');
    expect(e).toBeInstanceOf(NetworkException);
    expect(e).toBeInstanceOf(AppException);
  });

  it('retains its own concrete name despite the Network parent', () => {
    expect(new TimeoutException().name).toBe('TimeoutException');
  });
});

describe('cause chaining', () => {
  it('preserves a multi-level cause chain for log reconstruction', () => {
    const root = new NetworkException('no internet');
    const db = new AppDatabaseException('cache read failed', { cause: root });
    expect(db.cause).toBe(root);
    expect((db.cause as AppException).message).toBe('no internet');
  });
});

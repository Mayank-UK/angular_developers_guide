import type { HttpErrorResponse } from '@angular/common/http';
import {
  AppException,
  NetworkException,
  ServerException,
  AuthException,
  AppDatabaseException,
  TimeoutException,
} from './exceptions';
import {
  NetworkFailure,
  ServerFailure,
  DatabaseFailure,
  AuthFailure,
  UnknownFailure,
  FailureSeverity,
} from './failure';
import {
  httpErrorToException,
  mapExceptionToFailure,
} from './guards';

describe('mapExceptionToFailure', () => {
  it('maps a network exception to a critical network failure', () => {
    const failure = mapExceptionToFailure(new NetworkException('offline'));
    expect(failure).toBeInstanceOf(NetworkFailure);
    expect(failure.severity).toBe(FailureSeverity.Critical);
    expect(failure.kind).toBe('network');
    expect(failure.message).toBe('offline');
  });

  it('maps a server exception to a critical server failure', () => {
    const failure = mapExceptionToFailure(new ServerException('500'));
    expect(failure).toBeInstanceOf(ServerFailure);
    expect(failure.severity).toBe(FailureSeverity.Critical);
  });

  it('maps a database exception to a critical database failure', () => {
    const failure = mapExceptionToFailure(
      new AppDatabaseException('read failed'),
    );
    expect(failure).toBeInstanceOf(DatabaseFailure);
    expect(failure.severity).toBe(FailureSeverity.Critical);
  });

  it('maps an auth exception to a warning auth failure', () => {
    const failure = mapExceptionToFailure(new AuthException('no token'));
    expect(failure).toBeInstanceOf(AuthFailure);
    expect(failure.severity).toBe(FailureSeverity.Warning);
  });

  it('maps a timeout exception to a network failure', () => {
    const failure = mapExceptionToFailure(new TimeoutException('slow'));
    expect(failure).toBeInstanceOf(NetworkFailure);
    expect(failure.message).toBe('slow');
  });

  it('chains nested causes into a single failure trail', () => {
    const network = new NetworkException('no internet');
    const dbError = new AppDatabaseException('cache read failed', {
      cause: network,
    });

    const failure = mapExceptionToFailure(dbError);

    expect(failure.message).toBe('no internet + cache read failed');
    expect(failure.cause).toBeInstanceOf(NetworkFailure);
    expect(failure.cause?.message).toBe('no internet');

    expect(failure.chain).toContain('caused by: no internet');
    expect(failure.chain).toContain('cache read failed');
  });
});

describe('httpErrorToException', () => {
  function httpError(status: number, message = 'err'): HttpErrorResponse {
    return { name: 'HttpErrorResponse', status, message } as HttpErrorResponse;
  }

  it('maps status 0 to NetworkException', () => {
    expect(httpErrorToException(httpError(0))).toBeInstanceOf(NetworkException);
  });

  it('maps 408 to TimeoutException', () => {
    expect(httpErrorToException(httpError(408))).toBeInstanceOf(TimeoutException);
  });

  it('maps 401/403 to AuthException', () => {
    expect(httpErrorToException(httpError(401))).toBeInstanceOf(AuthException);
    expect(httpErrorToException(httpError(403))).toBeInstanceOf(AuthException);
  });

  it('maps 5xx to ServerException', () => {
    expect(httpErrorToException(httpError(500))).toBeInstanceOf(ServerException);
    expect(httpErrorToException(httpError(503))).toBeInstanceOf(ServerException);
  });

  it('maps other statuses to ServerException (server answered)', () => {
    expect(httpErrorToException(httpError(404))).toBeInstanceOf(ServerException);
  });

  it('extracts the server-provided message from the body when present', () => {
    const e = {
      name: 'HttpErrorResponse',
      status: 500,
      message: 'fail',
      error: { message: 'boom from server' },
    } as unknown as HttpErrorResponse;
    expect(httpErrorToException(e).message).toBe('boom from server');
  });

  it('a mapped 5xx becomes a ServerFailure via mapExceptionToFailure', () => {
    const failure = mapExceptionToFailure(httpErrorToException(httpError(500)));
    expect(failure).toBeInstanceOf(ServerFailure);
    expect(failure.kind).toBe('server');
  });

  it('a mapped auth error becomes an AuthFailure (warning)', () => {
    const failure = mapExceptionToFailure(httpErrorToException(httpError(401)));
    expect(failure).toBeInstanceOf(AuthFailure);
    expect(failure.severity).toBe(FailureSeverity.Warning);
  });

  it('a subclass of NetworkException still maps via the network branch', () => {
    class WeirdTimeout extends TimeoutException {}
    expect(
      mapExceptionToFailure(new WeirdTimeout('x')),
    ).toBeInstanceOf(NetworkFailure);
  });

  it('a novel AppException (no specific branch) surfaces as UnknownFailure', () => {
    class NovelException extends AppException {}
    expect(
      mapExceptionToFailure(new NovelException('novel')),
    ).toBeInstanceOf(UnknownFailure);
  });
});

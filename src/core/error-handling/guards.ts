import type { HttpErrorResponse } from '@angular/common/http';
import {
  AppDatabaseException,
  AppException,
  AuthException,
  NetworkException,
  ServerException,
  TimeoutException,
} from './exceptions';
import {
  AuthFailure,
  CacheFailure,
  DatabaseFailure,
  Failure,
  FailureSeverity,
  NetworkFailure,
  ServerFailure,
  UnknownFailure,
} from './failure';
import { failed, type Failed, type Result } from '../result';
import type { Logger } from '../config/logger';

/**
 * Guards — the heart of the error pipeline. Mirrors the React/Flutter guide's
 * `guards.dart`.
 *
 *  1. `guardedApiCall`        : wraps a raw data-source call and upgrades thrown
 *                               engine errors (HttpClient / fetch / JSON) into
 *                               typed `AppException`s.
 *  2. `httpErrorToException`  : single source of truth for the Angular
 *                               `HttpErrorResponse → AppException` mapping
 *                               (replaces the React/axios `axiosErrorToException`).
 *  3. `mapExceptionToFailure` : turns an `AppException` into a user-facing
 *                               `Failure`, recursively chaining any nested cause.
 *  4. `safeRepositoryCall`    : wraps a repository method and returns a `Result`,
 *                               allowing per-error-type fallbacks (e.g. serve
 *                               cache on network error).
 *
 * The Angular-only change vs. the React guide is the HTTP error mapper: we
 * branch on `HttpErrorResponse.status` instead of axios error codes. The
 * cause-chain logic, severity mapping, and cache-fallback semantics are
 * identical.
 *
 * `HttpErrorResponse` is imported type-only so this module stays runtime-free
 * of Angular and unit-testable in plain vitest.
 */

/** Wrap a low-level data-source operation. Re-throws typed AppExceptions. */
export async function guardedApiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw toAppException(e);
  }
}

/** Convert any thrown value into a typed AppException (idempotent if already one). */
export function toAppException(error: unknown): AppException {
  if (error instanceof AppException) return error;

  // Angular HttpClient surfaces non-2xx and network failures as HttpErrorResponse.
  if (isHttpErrorResponse(error)) return httpErrorToException(error);

  if (error instanceof TypeError) {
    // fetch()/network failures can surface as TypeError ("Failed to fetch").
    return new NetworkException(error.message, { cause: error });
  }
  if (error instanceof SyntaxError) {
    return new ServerException('Invalid response format', { cause: error });
  }

  return new ServerException('Unexpected error', { cause: error });
}

/**
 * Map an Angular `HttpErrorResponse` to a typed AppException. Single source of
 * truth for the status→exception mapping, used by `guardedApiCall`/
 * `toAppException` and by the retry interceptor (which converts an exhausted
 * transient error before re-throwing).
 *
 *   status 0   → NetworkException   (no response / connectivity / cert / DNS)
 *   408        → TimeoutException
 *   401 / 403  → AuthException
 *   5xx        → ServerException
 *   anything else with a status → ServerException (the server answered)
 *
 * (The React guide's axios branch used ServerException as the response default
 * too; an HTTP response always means the server spoke, even for unusual 4xx.)
 */
export function httpErrorToException(e: HttpErrorResponse): AppException {
  const status = e.status;

  if (status === 0) {
    return new NetworkException(e.message || 'Network error', { cause: e });
  }
  if (status === 408) {
    return new TimeoutException('Request timed out', { cause: e });
  }
  if (status === 401 || status === 403) {
    return new AuthException(`Authentication failed (${status})`, { cause: e });
  }
  if (status >= 500 && status <= 599) {
    return new ServerException(serverMessage(e) ?? `Server returned ${status}`, {
      cause: e,
    });
  }

  // Any other status: the server answered, so surface as a ServerException
  // carrying the body's message if we can find one.
  return new ServerException(serverMessage(e) ?? `Server returned ${status}`, {
    cause: e,
  });
}

/** Best-effort extraction of a server-provided message from the response body. */
function serverMessage(e: HttpErrorResponse): string | undefined {
  const data: unknown = e.error;
  if (typeof data === 'object' && data !== null) {
    const raw = (data as Record<string, unknown>)['message'];
    if (typeof raw === 'string') return raw;
  }
  return undefined;
}

/** Structural runtime test for an Angular HttpErrorResponse (no runtime import). */
function isHttpErrorResponse(value: unknown): value is HttpErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number' &&
    'name' in value &&
    (value as { name: unknown }).name === 'HttpErrorResponse'
  );
}

/** Recursively map an AppException to a Failure, preserving the cause chain. */
export function mapExceptionToFailure(e: AppException): Failure {
  const innerCause =
    e.cause instanceof AppException ? mapExceptionToFailure(e.cause) : undefined;

  if (e instanceof TimeoutException) {
    return new NetworkFailure(e.message, innerCause);
  }
  if (e instanceof NetworkException) {
    return new NetworkFailure(e.message, innerCause);
  }
  if (e instanceof ServerException) {
    return new ServerFailure(e.message, innerCause);
  }
  if (e instanceof AuthException) {
    return new AuthFailure(e.message, innerCause);
  }
  if (e instanceof AppDatabaseException) {
    return new DatabaseFailure(e.message, innerCause);
  }

  return new UnknownFailure(e.message, innerCause);
}

interface SafeRepositoryCallOptions<TResult> {
  call: () => Promise<TResult>;
  logger: Logger;
  /** Fallback when the remote/network throws (e.g. serve local cache). */
  onNetworkError?: (cause: NetworkException) => Promise<Result<TResult>>;
  /** Fallback when the server returns an error status. */
  onServerError?: (cause: ServerException) => Promise<Result<TResult>>;
}

/** Wrap a repository method and return a Result, with optional per-error fallbacks. */
export async function safeRepositoryCall<TResult>({
  call,
  logger,
  onNetworkError,
  onServerError,
}: SafeRepositoryCallOptions<TResult>): Promise<Result<TResult>> {
  try {
    const value = await call();
    return { ok: true, value };
  } catch (e) {
    if (e instanceof NetworkException) {
      if (onNetworkError) return onNetworkError(e);
      return failed(mapExceptionToFailure(e));
    }
    if (e instanceof ServerException) {
      if (onServerError) return onServerError(e);
      return failed(mapExceptionToFailure(e));
    }
    if (e instanceof AppException) {
      // AppException is the base of AppDatabaseException / AuthException (and
      // the Network/Server branches above), so this single branch subsumes
      // every typed data-layer exception without special-case routing.
      return failed(mapExceptionToFailure(e));
    }
    logger.error('Unexpected repository error', e);
    return failed(new UnknownFailure());
  }
}

/** Convenience: a Result representing a cache miss that should surface the upstream failure. */
export function forwardNetworkFailure(cause: AppException): Failed {
  return failed(mapExceptionToFailure(cause));
}

/**
 * Used by the cache fallback: chain a CacheFailure on top of an upstream
 * failure. Marked Critical because the cache was the last resort and it
 * failed — there is nothing left to show the user.
 */
export function chainedCacheFailure(
  dbError: AppDatabaseException,
  upstream: Failure,
): Failed {
  return failed(
    new CacheFailure(dbError.message, upstream, FailureSeverity.Critical),
  );
}

import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Observable, concatMap, catchError, throwError, timer } from 'rxjs';
import {
  AppException,
  NetworkException,
  TimeoutException,
} from '../../core/error-handling/exceptions';
import { httpErrorToException } from '../../core/error-handling/guards';

/**
 * retryInterceptor — functional Angular HTTP interceptor that retries
 * idempotent requests which fail due to transient network/timeout errors.
 * Mirrors the React/Flutter guide's `RetryInterceptor`, adapted to Angular's
 * `HttpInterceptorFn` + RxJS pipeline.
 *
 * Safety (same invariants as the React guide):
 *  - Only **idempotent** methods are retried (GET/HEAD/OPTIONS/PUT/DELETE). A
 *    non-idempotent verb (POST/PATCH) whose request reached the server but
 *    whose response was lost is NOT retried, to avoid duplicate writes.
 *  - Backoff is exponential with full jitter to avoid thundering-herd retries
 *    against a recovering server: `random(0, base * 2^(attempt-1))`.
 *  - Errors that are already `AppException`s (e.g. typed failures thrown by an
 *    upstream interceptor or injected by the fake path) are never retried —
 *    they are intentional, not transient.
 *
 * On exhaustion (or a non-retryable response), the error is mapped to a typed
 * `AppException` via the single shared `httpErrorToException` mapping in
 * `guards.ts`, so the data layer only ever handles typed exceptions.
 */
const IDEMPOTENT_METHODS = new Set([
  'get',
  'head',
  'options',
  'put',
  'delete',
]);

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 200;

/** True for transient, no-response failures safe to retry (when idempotent). */
function isTransient(exception: AppException): boolean {
  // TimeoutException extends NetworkException, so this covers both.
  return (
    exception instanceof NetworkException ||
    exception instanceof TimeoutException
  );
}

/** Exponential backoff with full jitter: uniform in [0, base * 2^(attempt-1)]. */
function jitteredDelay(attempt: number): number {
  const ceiling = BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.random() * ceiling;
}

export const retryInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next,
): Observable<HttpEvent<unknown>> => {
  let attempt = 0;

  const attemptRequest = (
    currentReq: HttpRequest<unknown>,
  ): Observable<HttpEvent<unknown>> =>
    next(currentReq).pipe(
      catchError((error: unknown) => {
        // A typed AppException thrown upstream is intentional — never retry.
        if (error instanceof AppException) {
          return throwError(() => error);
        }
        // Non-HTTP throws (programmer errors) pass straight through.
        if (!(error instanceof HttpErrorResponse)) {
          return throwError(() => error);
        }

        const exception = httpErrorToException(error);
        const method = currentReq.method.toLowerCase();
        const retryable =
          IDEMPOTENT_METHODS.has(method) && isTransient(exception);

        if (retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          return timer(jitteredDelay(attempt)).pipe(
            concatMap(() => attemptRequest(currentReq)),
          );
        }

        // Exhausted retries, non-transient, or non-idempotent → surface the
        // typed AppException so the data layer handles a single error shape.
        return throwError(() => exception);
      }),
    );

  return attemptRequest(req);
};

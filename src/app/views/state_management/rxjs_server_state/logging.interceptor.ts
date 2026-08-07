import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { DemoRequestLog } from './demo-api.interceptor';

/**
 * loggingInterceptor — a FUNCTIONAL HttpInterceptorFn that logs every request
 * to the console AND to this screen's on-screen request log.
 *
 * This is the canonical "logging interceptor" shape: wrap `next(req)` with a
 * `tap` that records the request on the way out, the response on the way back,
 * and any error that blew the stream. `tap` is the right operator because it
 * observes WITHOUT transforming or terminating the stream.
 *
 * Functional-style notes:
 *  - Registered with `withInterceptors([loggingInterceptor])`, NOT via a class
 *    with `HTTP_INTERCEPTORS`. No DI boilerplate.
 *  - It runs in an injection context, so `inject(DemoRequestLog)` resolves the
 *    COMPONENT-scoped instance registered in this screen's providers. Outside
 *    this screen the token isn't provided, so `optional: true` keeps the
 *    interceptor harmless if it were ever reused.
 *
 * Ordering: interceptors run in array order, the FIRST being the OUTERMOST
 * (its `next(req)` calls into the next). So `[loggingInterceptor,
 * demoApiInterceptor]` means logging wraps the fake API — it sees the request
 * on the way in and the canned response on the way out, including the simulated
 * latency in its measured ms.
 */
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  // Optional: the on-screen log only exists within this screen's providers.
  const log = inject(DemoRequestLog, { optional: true });
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  const elapsed = () =>
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
    started;

  return next(req).pipe(
    tap({
      next: (event: HttpEvent<unknown>) => {
        if (event instanceof HttpResponse) {
          log?.record(req.method, req.urlWithParams, 'ok', elapsed(), event.status);
          // eslint-disable-next-line no-console
          console.log(
            `[http] ${req.method} ${req.urlWithParams} → ${event.status}`,
          );
        }
      },
      error: (error: unknown) => {
        const code =
          error instanceof HttpErrorResponse ? error.status : 'ERR';
        log?.record(req.method, req.urlWithParams, 'error', elapsed(), code);
        // eslint-disable-next-line no-console
        console.error(
          `[http] ${req.method} ${req.urlWithParams} → FAILED`,
          error,
        );
      },
    }),
  );
};

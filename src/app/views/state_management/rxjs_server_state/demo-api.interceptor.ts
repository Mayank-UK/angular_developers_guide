import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import type { CreateTodoPayload, Todo, UpdateTodoPayload } from './todo.model';

/**
 * demoApiInterceptor — a FUNCTIONAL HttpInterceptorFn that stands in for a real
 * REST server at `/api/todos`. It keeps an in-memory list, simulates network
 * latency, and can be flipped into a failing mode so the screen can demonstrate
 * error handling (catchError / retry / finalize) and the loading → error → data
 * states without needing a backend.
 *
 * SCOPE: this interceptor is registered ONLY in this screen's component
 * `providers` via `provideHttpClient(withInterceptors([loggingInterceptor,
 * demoApiInterceptor]))`. It does NOT touch the app's global HttpClient wiring
 * (`provideHttpClient(withInterceptors([retryInterceptor]))` in app.config.ts),
 * so the rest of the app is unaffected. Keep the demo self-contained.
 *
 * Functional-style notes:
 *  - A functional interceptor is just a function `(req, next) => Observable`.
 *    No class, no `@Injectable`, no `implements HttpInterceptor`. Angular's
 *    modern recommendation — register it with `withInterceptors([fn])`.
 *  - It runs in an injection context, so `inject(...)` works inside it (the
 *    loggingInterceptor uses that to reach the on-screen request log).
 *
 * In a real app this file would not exist — requests would hit the network and
 * the data layer (`data/remote/PostApiService` + the retry interceptor) would
 * own transport concerns. This is purely a teaching fixture so the demo is
 * offline-capable.
 */

const API_PREFIX = '/api/todos';
const LATENCY_MS = 450;

/* -------------------------------------------------------------------------- */
/* In-memory "server" state (module-level — the interceptor is a function).    */
/* -------------------------------------------------------------------------- */

let nextId = 4;
const db: Todo[] = [
  { id: 1, text: 'Fetch the list with HttpClient + toSignal', done: true },
  { id: 2, text: 'Add one with a POST', done: false },
  { id: 3, text: 'Toggle with PUT, delete with DELETE', done: false },
];

/** When true, every request fails with a 503 — flip from the UI to demo errors. */
let failRequests = false;

export function setDemoApiFailing(v: boolean): void {
  failRequests = v;
}
export function isDemoApiFailing(): boolean {
  return failRequests;
}

/** Reset the in-memory store to the seed (used by the "reset demo" button). */
export function resetDemoApiStore(): void {
  db.length = 0;
  db.push(
    { id: 1, text: 'Fetch the list with HttpClient + toSignal', done: true },
    { id: 2, text: 'Add one with a POST', done: false },
    { id: 3, text: 'Toggle with PUT, delete with DELETE', done: false },
  );
  nextId = 4;
  failRequests = false;
}

function fail<T>(): Observable<T> {
  // Return a real HttpErrorResponse so retry/catchError handle a realistic
  // shape (the same shape the global retryInterceptor keys off in the real app).
  return throwError(
    () =>
      new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable (demo)',
        url: API_PREFIX,
      }),
  ) as Observable<T>;
}

function ok<T>(body: T): Observable<HttpEvent<T>> {
  // Simulated latency, then a full HttpResponse with 200. We never call next():
  // this short-circuits the chain so no real XHR is attempted.
  return of(
    new HttpResponse<T>({ status: 200, body, url: API_PREFIX }),
  ).pipe(delay(LATENCY_MS));
}

function parseId(url: string): number | undefined {
  const rest = url.slice(url.indexOf(API_PREFIX) + API_PREFIX.length);
  const match = rest.match(/^\/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

/**
 * demoApiInterceptor — routes the CRUD verbs against the in-memory store.
 * Anything not under `/api/todos` passes through untouched.
 */
export const demoApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes(API_PREFIX)) {
    return next(req);
  }

  if (failRequests) return fail<HttpEvent<unknown>>();

  const id = parseId(req.url);
  const method = req.method.toUpperCase();

  switch (method) {
    case 'GET': {
      return ok<readonly Todo[]>([...db]);
    }
    case 'POST': {
      const payload = req.body as CreateTodoPayload | null;
      if (!payload || !payload.text?.trim()) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              statusText: 'Bad Request (demo): text required',
              url: req.url,
            }),
        );
      }
      const created: Todo = {
        id: nextId++,
        text: payload.text.trim(),
        done: false,
      };
      db.push(created);
      return ok<Todo>(created);
    }
    case 'PUT': {
      const payload = req.body as UpdateTodoPayload | null;
      const existing = id == null ? undefined : db.find((t) => t.id === id);
      if (id == null || !existing || !payload) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              statusText: 'Not Found (demo)',
              url: req.url,
            }),
        );
      }
      const updated: Todo = { ...existing, done: payload.done };
      const idx = db.findIndex((t) => t.id === id);
      db[idx] = updated;
      return ok<Todo>(updated);
    }
    case 'DELETE': {
      const idx = id == null ? -1 : db.findIndex((t) => t.id === id);
      if (idx < 0) {
        return throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              statusText: 'Not Found (demo)',
              url: req.url,
            }),
        );
      }
      db.splice(idx, 1);
      // 204 No Content — empty body.
      return ok<null>(null);
    }
    default:
      return next(req);
  }
};

/* -------------------------------------------------------------------------- */
/* On-screen request log — shared between the loggingInterceptor (writer) and  */
/* the todo demo (reader). Provided at the COMPONENT level so it never leaks.  */
/* -------------------------------------------------------------------------- */

export interface RequestLogEntry {
  readonly order: number;
  readonly method: string;
  readonly url: string;
  readonly outcome: 'ok' | 'error';
  readonly code: number | string;
  readonly ms: number;
  readonly at: string;
}

/**
 * DemoRequestLog — the on-screen HTTP request log. The loggingInterceptor
 * writes one entry per request (success or error); the todo demo renders them.
 *
 * It is `@Injectable` so it can be listed in the component `providers` and
 * injected by both the component and by the functional loggingInterceptor
 * (which runs inside an injection context). The reactive cell is a SIGNAL so
 * the demo's OnPush template updates the moment an entry lands.
 */
@Injectable()
export class DemoRequestLog {
  private readonly _entries = signal<readonly RequestLogEntry[]>([]);
  /** Latest entry first, capped at 40. */
  readonly entries = this._entries.asReadonly();
  private order = 0;

  reset(): void {
    this._entries.set([]);
    this.order = 0;
  }
  record(
    method: string,
    url: string,
    outcome: 'ok' | 'error',
    ms: number,
    code: number | string = outcome === 'ok' ? 200 : 'ERR',
  ): void {
    const entry: RequestLogEntry = {
      order: ++this.order,
      method,
      url,
      outcome,
      code,
      ms: Math.round(ms),
      at: new Date().toLocaleTimeString(),
    };
    this._entries.update((list) => [entry, ...list].slice(0, 40));
  }
}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';
import { ShowError } from '../../../../ui/components/show-error/show-error';
import { TodoDemo } from './todo-demo';
import { CachingDemo } from './caching-demo';

/**
 * RxjsServerStateView — SERVER state with RxJS + Angular HttpClient.
 *
 * This is the "which state are you managing?" hub's SERVER-state answer. The
 * first three state screens (Signals, NgRx Store, NgRx SignalStore) held state
 * the app OWNS. This screen holds state the app BORROWS from a server: lists,
 * records, search results — data that is asynchronous (loading matters), can
 * fail (errors matter), and can change on the server while you hold it
 * (staleness + caching matter). HttpClient + RxJS is Angular's native toolkit
 * for that problem: one Verb per REST operation, Observables for the async
 * stream, interceptors for cross-cutting transport concerns, and operators
 * (switchMap / retry / catchError / shareReplay) for caching, retries, and
 * error handling.
 *
 * The CENTERPIECE is a fully functional todo app whose source of truth lives
 * on a SIMULATED server (a component-scoped HttpInterceptorFn that returns
 * canned responses) — load, add, toggle, delete, with visible loading / error
 * / data states and an on-screen HTTP request log.
 *
 * Coverage: HttpClient (GET/POST/PUT/DELETE), the functional HttpInterceptorFn
 * style (with this app's real retry.interceptor.ts as the canonical example
 * plus a logging + a caching interceptor here), bridging Observables → signals
 * via toSignal (and the async-pipe alternative), error handling
 * (catchError / retry / finalize), and caching strategies (shareReplay +
 * time-based).
 *
 * NOTE: the exported `RxjsServerStateView` is declared at the BOTTOM of this
 * file. Its `imports` reference local helper components (TodoDemo, CachingDemo)
 * that are block-scoped declarations — the main component must come AFTER every
 * helper it names so its decorator does not read an uninitialized binding at
 * module-evaluation time. The helpers live in their own files (todo-demo.ts,
 * caching-demo.ts) because each owns component-scoped `providers`.
 */

@Component({
  selector: 'app-rxjs-server-state-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    ShowError,
    TodoDemo,
    CachingDemo,
  ],
  templateUrl: './rxjs_server_state_view.html',
  styleUrl: './rxjs_server_state_view.scss',
})
export class RxjsServerStateView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;

  /** Drives the little ShowError demo's retry-output readout. */
  private readonly _retryOut = signal('—');
  readonly retryOut = this._retryOut.asReadonly();

  demoRetry(): void {
    this._retryOut.set(`retry fired at ${new Date().toLocaleTimeString()}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  when: `// "Which state are you managing?" — pick the lightest tool that fits.
//
//   LOCAL / COMPONENT state    → signals (one component, ~90% of UI state)
//   SHARED / GLOBAL state      → NgRx SignalStore (light) or NgRx Store (Redux)
//   SERVER state (THIS screen) → HttpClient + RxJS
//
// Server state is DIFFERENT in kind from UI state. It is:
//   • asynchronous — loading matters; the data is not there yet
//   • fallible     — the network can fail; errors are first-class
//   • stale        — someone else can change the server copy while you hold it
//
// So a signal/store is the wrong tool: they cache a value you already own. For
// server state you want HttpClient (the verbs) + RxJS (the async machinery) +
// a cache keyed by request, with explicit invalidation on writes.`,
  client: `import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';

// HttpClient returns Observables, not Promises. An Observable is a LAZY stream:
// nothing happens until you subscribe (or hand it to toSignal / the async pipe).
// That laziness is what lets operators compose (retry, switchMap, shareReplay).
@Injectable()
class TodosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/todos';

  list(): Observable<readonly Todo[]> {
    return this.http.get<readonly Todo[]>(this.base);          // GET
  }
  create(p: { text: string }): Observable<Todo> {
    return this.http.post<Todo>(this.base, p);                  // POST
  }
  update(id: number, p: { done: boolean }): Observable<Todo> {
    return this.http.put<Todo>(\`\${this.base}/\${id}\`, p);        // PUT
  }
  remove(id: number): Observable<void> {
    return this.http.delete<unknown>(\`\${this.base}/\${id}\`)       // DELETE
      .pipe(map(() => undefined));
  }
}`,
  fnInterceptor: `import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

// Modern Angular interceptors are FUNCTIONS, not classes. Register them with
// withInterceptors([fn]) inside provideHttpClient(...). No @Injectable, no
// HTTP_INTERCEPTORS multi-provider token. The function runs inside an
// injection context, so inject(...) works.
export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const started = performance.now();
  // 'next(req)' hands the (possibly cloned) request to the next handler and
  // returns the response stream. tap() observes WITHOUT transforming it.
  return next(req).pipe(
    tap({
      next: ev => { /* log response + ms */ },
      error: err => { /* log failure */ },
    }),
  );
};

// Wiring (global, in app.config.ts OR scoped to a component's providers):
//   provideHttpClient(withInterceptors([loggingInterceptor, retryInterceptor]))`,
  realRetry: `// This app's REAL retry interceptor — src/data/remote/retry.interceptor.ts.
// (Functional, idempotent-only, exponential full-jitter — referenced here as
// the canonical example; NOT modified by this screen.)
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  let attempt = 0;
  const attemptRequest = (currentReq) =>
    next(currentReq).pipe(
      catchError((error: unknown) => {
        if (error instanceof AppException) return throwError(() => error);
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
        const exception = httpErrorToException(error);
        const retryable =
          IDEMPOTENT_METHODS.has(currentReq.method.toLowerCase()) &&
          isTransient(exception);
        if (retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          return timer(jitteredDelay(attempt)).pipe(concatMap(() => attemptRequest(currentReq)));
        }
        return throwError(() => exception); // typed AppException → data layer
      }),
    );
  return attemptRequest(req);
};`,
  toSignal: `import { toSignal } from '@angular/core/rxjs-interop';
import { switchMap, retry, catchError, startWith, map } from 'rxjs';

// toSignal bridges Observable → signal so an OnPush template reacts with NO
// async pipe and NO manual subscribe. Requires an initialValue (a signal always
// has a value to render). The subscription is tied to the component lifetime.

const kick = signal(0); // bump to refetch

type State = { status: 'loading' } | { status: 'success'; data: Todo[] }
           | { status: 'error'; message: string };

const state = toSignal(
  toObservable(kick).pipe(
    // switchMap cancels the in-flight request when a new kick lands — no stale
    // responses can ever overwrite fresh data.
    switchMap(() => api.list().pipe(
      retry({ count: 2, delay: (e, n) => e.status >= 500 ? timer(300 * n) : throwError(() => e) }),
      map(data => ({ status: 'success', data }) as State),
      catchError(err => of({ status: 'error', message: messageFor(err) }) as State),
      startWith({ status: 'loading' } as State),
    )),
  ),
  { initialValue: { status: 'loading' } as State },
);`,
  asyncPipe: `// The async pipe is the OTHER way to consume an Observable in a template.
// It subscribes on init, unsubscribes on destroy, and marks for check on each
// emission — the pre-signals idiom. It still works, but a signal (via toSignal)
// is now preferred: it is a plain value in the template (no | async), composes
// with computed/effect, and works anywhere (not just templates).

@Component({
  template: \`
    @if (state$ | async; as s) {
      @switch (s.status) {
        @case ('loading') { <loader /> }
        @case ('error')   { <err [msg]="s.message" /> }
        @case ('success') { <list [todos]="s.data" /> }
      }
    }
  \`,
})
class TodoPage {
  // Manual subject + switchMap, exposed via async pipe.
  readonly state$: Observable<State> = this.refresh$.pipe(switchMap(/* … */));
}`,
  errors: `import { retry, catchError, finalize, throwError, timer } from 'rxjs';

// retry — re-subscribe on error, with a per-attempt delay. Use it for TRANSIENT
// failures (5xx, network). Re-throw non-retryable errors immediately so 4xx is
// surfaced at once.
source$.pipe(
  retry({
    count: 2,
    delay: (err, attempt) =>
      err instanceof HttpErrorResponse && err.status >= 500
        ? timer(300 * attempt)        // backoff before next try
        : throwError(() => err),      // 4xx / non-HTTP → do not retry
  }),
);

// catchError — catch a terminal error and CONTINUE the stream with a fallback
// value (or re-throw). Without it, an errored stream is dead and later kicks
// could not recover it. catchError returns a new Observable so the stream stays
// alive for the next switchMap emission.
source$.pipe(catchError(err => of(fallbackValue)));

// finalize — runs a callback when the stream TERMINATES (success, error, OR
// unsubscribe). The right place for "stop the spinner no matter what", closing
// handles, or logging. It runs exactly once per subscription.
source$.pipe(finalize(() => (this.loading = false)));`,
  caching: `import { shareReplay, timer } from 'rxjs';

// shareReplay turns a cold Observable into a hot, replaying one: ONE network
// request is shared across concurrent subscribers, and the last emission is
// replayed to late subscribers. This is the atom of every RxJS HTTP cache.
const todos$ = http.get<Todo[]>('/api/todos').pipe(
  shareReplay({ bufferSize: 1, refCount: true }), // 1 cached value, refCounted
);

// TIME-BASED invalidation — refetch after a TTL. Wrap the source so that after
// the TTL elapses the next subscriber triggers a fresh fetch.
function cachedFor<T>(source$: Observable<T>, ttlMs: number) {
  return timer(0, ttlMs).pipe(
    switchMap(() => source$.pipe(shareReplay({ bufferSize: 1, refCount: true }))),
  );
}`,
  cacheInterceptor: `// A caching INTERCEPTOR (cross-cutting) vs a caching SERVICE (per-query).
// The interceptor caches EVERY GET by URL+method globally — simple, but the
// cache is shared app-wide and invalidation is by TTL only. The service-level
// shareReplay (above) caches ONE endpoint with whatever invalidation logic you
// want (mutate then refetch, manual clear, key-based). Most apps end up with the
// per-query shape; the interceptor shape is shown for completeness.

export const cachingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') return next(req);      // never cache writes
  const key = \`\${req.method} \${req.urlWithParams}\`;
  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) return hit.stream;   // serve from cache
  const stream = next(req).pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  cache.set(key, { expiry: Date.now() + TTL_MS, stream });
  return stream;
};`,
  demoInterceptor: `// This screen's DEMO interceptor — stands in for a real server so the todo
// demo works offline. Registered ONLY in the TodoDemo component's providers via
// provideHttpClient(withInterceptors([loggingInterceptor, demoApiInterceptor])),
// so it NEVER affects the rest of the app (the global retryInterceptor in
// app.config.ts stays untouched). It keeps an in-memory list, adds latency, and
// can be flipped into a failing mode to demo error handling.
export const demoApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/todos')) return next(req);   // pass-through
  if (failRequests) return throwError(() => new HttpErrorResponse({ status: 503 }));
  switch (req.method) {
    case 'GET':    return of(new HttpResponse({ status: 200, body: [...db] })).pipe(delay(450));
    case 'POST':   /* create + push */ ...
    case 'PUT':    /* update */ ...
    case 'DELETE': /* remove */ ...
  }
};`,
  seam: `// ARCHITECTURE NOTE — this demo imports HttpClient in the view ON PURPOSE
// because the screen IS teaching HttpClient. In the real app, views NEVER
// import HttpClient. They resolve data through the DI seam, and only the DATA
// layer talks to the network. See src/data/remote/PostApiService + the retry
// interceptor + the AppException → Failure → Result pipeline.

@Injectable()
export class PostApiService implements PostRemoteDataSource {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  getPosts(): Promise<PostDTO[]> {
    return guardedApiCall(async () => {        // → AppException on HttpErrorResponse
      const data = await firstValueFrom(
        this.http.get<unknown>(\`\${this.config.apiBaseUrl}/posts\`),
      );
      return (data as Record<string, unknown>[]).map(postDtoFromJson);
    });
  }
}

// A view resolves the USE CASE (not the service):
const posts = inject(GET_POSTS_USE_CASE); // → Result<Post[]> (Success | Failed)`,
};

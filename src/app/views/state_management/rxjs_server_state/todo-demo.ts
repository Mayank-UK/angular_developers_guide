import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  delay,
  finalize,
  map,
  of,
  retry,
  startWith,
  switchMap,
  throwError,
  timer,
} from 'rxjs';
import {
  TODO_FILTERS,
  TODO_FILTER_LABELS,
  type Todo,
  type TodoFilter,
} from './todo.model';
import { QUERY_STATUS, TodosApiService, type QueryState } from './todos-api.service';
import {
  DemoRequestLog,
  isDemoApiFailing,
  resetDemoApiStore,
  setDemoApiFailing,
} from './demo-api.interceptor';
import { loggingInterceptor } from './logging.interceptor';
import { demoApiInterceptor } from './demo-api.interceptor';
import { provideScopedHttpClient } from './scoped-http-client';
import { DemoRequestLogView } from './request-log';

/**
 * TodoDemo — the CENTERPIECE of the RxJS / server-state screen.
 *
 * A fully functional todo app whose source of truth lives on a (simulated)
 * server. Every read is an HttpClient GET; every write is a POST/PUT/DELETE
 * followed by a refetch so the server truth is always what is rendered. The
 * state machine is loading → (success | error), bridged to the template via
 * `toSignal` so OnPush updates with no async pipe and no manual subscribe.
 *
 * The pipeline below composes the operators the screen teaches:
 *   - switchMap — a refresh-kick signal cancels the in-flight request and
 *     starts a new one (no stale responses can land).
 *   - retry({ count, delay }) — re-attempts transient (5xx) failures, surfaces
 *     4xx immediately.
 *   - catchError — converts a terminal error into an `error` QueryState (the
 *     stream stays alive; switchMap can still react to the next kick).
 *   - startWith(loading) — flips to loading on every kick before data lands.
 *   - finalize — cleanup hook (here: a console breadcrumb; in a real app,
 *     hide spinners, close handles, etc.).
 *
 * COMPONENT-SCOPED providers: `provideHttpClient(withInterceptors([...]))`
 * layers the demo + logging interceptors ONLY for this subtree (it never
 * touches the app's global retryInterceptor). TodosApiService + DemoRequestLog
 * live here too.
 *
 * NOTE: declared in its own file (not inline in the view) because it owns its
 * `providers`, and a component with component-level providers must be a proper
 * standalone declaration that other components can `imports`.
 */
@Component({
  selector: 'app-rxjs-todo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DemoRequestLogView],
  template: `
    <div class="demo">
      <!-- Controls -->
      <div class="controls">
        <button type="button" class="btn ghost" (click)="refresh()">
          ↻ refetch
        </button>
        <button
          type="button"
          class="btn ghost"
          (click)="toggleFailing()"
          [class.danger]="failing()"
        >
          {{ failing() ? '● failing requests on' : 'force server errors' }}
        </button>
        <button type="button" class="btn ghost" (click)="resetDemo()">
          reset demo
        </button>
        @if (fetching()) {
          <span class="pulse" aria-live="polite">fetching…</span>
        }
      </div>

      <!-- Add row -->
      <div class="add-row">
        <input
          #box
          class="todo-input"
          [value]="draft()"
          (input)="draft.set(box.value)"
          (keydown.enter)="add(box.value)"
          placeholder="Add a todo (POST /api/todos)…"
          aria-label="Add a todo"
        />
        <button
          type="button"
          class="btn primary"
          (click)="add(box.value)"
          [disabled]="pending()"
        >
          {{ pending() ? '…' : 'Add' }}
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar" role="group" aria-label="Filter todos">
        @for (opt of filterOptions; track opt) {
          <button
            type="button"
            class="chip"
            [class.active]="filter() === opt"
            (click)="filter.set(opt)"
          >
            {{ labels[opt] }}
          </button>
        }
      </div>

      <!-- State-driven body. @let gives the type-checker a stable reference to
           narrow the QueryState discriminated union per @case. -->
      @let s = state();
      @switch (s.status) {
        @case ('loading') {
          <div class="state loading" role="status" aria-live="polite">
            <span class="spinner" aria-hidden="true"></span>
            <span>Loading todos from the server…</span>
          </div>
        }
        @case ('error') {
          <div class="state error" role="alert">
            <div class="error-head">
              <span class="glyph">⚠</span>
              <div>
                <p class="err-title">{{ s.message }}</p>
                <p class="err-sub">{{ s.statusText }}</p>
              </div>
            </div>
            <button type="button" class="btn retry" (click)="refresh()">
              retry now
            </button>
          </div>
        }
        @case ('success') {
          @if (visible().length === 0) {
            <p class="empty">Nothing here — add one above.</p>
          } @else {
            <ul class="list">
              @for (t of visible(); track t.id) {
                <li class="item" [class.done]="t.done">
                  <label class="tick">
                    <input
                      type="checkbox"
                      [checked]="t.done"
                      (change)="toggle(t)"
                    />
                    <span class="text">{{ t.text }}</span>
                  </label>
                  <button
                    type="button"
                    class="remove"
                    [attr.aria-label]="'Remove ' + t.text"
                    (click)="remove(t)"
                  >
                    ✕
                  </button>
                </li>
              }
            </ul>
          }
          <p class="counts">
            <strong>{{ remaining() }}</strong> remaining ·
            <strong>{{ s.data.length }}</strong> on server
          </p>
        }
      }

      <!-- On-screen request log (written by the loggingInterceptor) — extracted
           into its own component so the demo's query pipeline and the log's
           markup/styles each stay focused (see request-log.ts). -->
      <app-demo-request-log [log]="log" />
    </div>
  `,
  styleUrl: './todo-demo.scss',
  providers: [
    // COMPONENT-SCOPED HttpClient — layers the demo + logging interceptors so
    // they never affect the rest of the app. The global retryInterceptor from
    // app.config.ts is intentionally NOT in this chain (this subtree owns its
    // own HttpClient). Order: logging (outermost, wraps) → demoApi (innermost,
    // short-circuits with a canned response). provideScopedHttpClient builds
    // the child-scope HttpClient type-safely via a child EnvironmentInjector
    // (see scoped-http-client.ts) — no EnvironmentProviders→Provider cast.
    provideScopedHttpClient([loggingInterceptor, demoApiInterceptor]),
    TodosApiService,
    DemoRequestLog,
  ],
})
export class TodoDemo {
  /** The transport + on-screen log — both component-scoped. */
  private readonly api = inject(TodosApiService);
  readonly log = inject(DemoRequestLog);

  /** Refresh kick — each increment cancels the in-flight request (switchMap). */
  private readonly _kick = signal(0);

  /** UI draft for the add box. */
  readonly draft = signal('');

  /** Active filter (client-side view of the server list). */
  readonly filter = signal<TodoFilter>(TODO_FILTERS.all);

  /** Failing switch (drives the demo's error path). */
  readonly failing = signal(isDemoApiFailing());

  /** Mutation in flight (disables the Add button). */
  readonly pending = signal(false);

  readonly filterOptions: readonly TodoFilter[] = [
    TODO_FILTERS.all,
    TODO_FILTERS.active,
    TODO_FILTERS.done,
  ];
  readonly labels = TODO_FILTER_LABELS;

  /**
   * The query: kick → switchMap to GET → retry transient failures → catchError
   * into an error state → startWith(loading). Bridged to a signal with toSignal
   * so the template is signal-native + OnPush.
   */
  readonly state = toSignal(this.buildQuery$(), {
    initialValue: { status: QUERY_STATUS.loading } as QueryState,
  });

  /** True while the GET is in flight (drives the "fetching…" pill). */
  readonly fetching = computed(
    () => this.state().status === QUERY_STATUS.loading,
  );

  /** Visible list after the client-side filter. */
  readonly visible = computed(() => {
    const s = this.state();
    if (s.status !== QUERY_STATUS.success) return [] as readonly Todo[];
    const f = this.filter();
    if (f === TODO_FILTERS.active) return s.data.filter((t) => !t.done);
    if (f === TODO_FILTERS.done) return s.data.filter((t) => t.done);
    return s.data;
  });

  readonly remaining = computed(() => {
    const s = this.state();
    return s.status === QUERY_STATUS.success
      ? s.data.filter((t) => !t.done).length
      : 0;
  });

  constructor() {
    // Trigger the first load.
    this.refresh();
  }

  refresh(): void {
    this._kick.update((n) => n + 1);
  }

  toggleFailing(): void {
    const next = !this.failing();
    this.failing.set(next);
    setDemoApiFailing(next);
    this.refresh();
  }

  resetDemo(): void {
    resetDemoApiStore();
    this.failing.set(false);
    this.log.reset();
    this.refresh();
  }

  add(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.pending()) return;
    this.pending.set(true);
    this.api
      .create({ text: trimmed })
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: () => {
          this.draft.set('');
          this.refresh();
        },
        error: () => {
          /* the request log + the next list load surface the failure */
        },
      });
  }

  toggle(todo: Todo): void {
    this.api
      .update(todo.id, { done: !todo.done })
      .subscribe({ next: () => this.refresh() });
  }

  remove(todo: Todo): void {
    this.api.remove(todo.id).subscribe({ next: () => this.refresh() });
  }

  /**
   * Builds the query Observable. Factored out so it reads top-to-bottom.
   * `toObservable(this._kick)` re-emits on every refresh; `switchMap` cancels
   * the prior request and starts the new one.
   */
  private buildQuery$(): Observable<QueryState> {
    return toObservable(this._kick).pipe(
      switchMap(() =>
        this.api.list().pipe(
          // Retry transient (5xx) failures with backoff before giving up; 4xx
          // (client errors) are surfaced immediately via the throwError.
          retry({
            count: 2,
            delay: (err: unknown, count: number) =>
              err instanceof HttpErrorResponse && err.status >= 500
                ? timer(300 * count)
                : throwError(() => err),
          }),
          map(
            (data) =>
              ({ status: QUERY_STATUS.success, data }) as QueryState,
          ),
          catchError((err: unknown) =>
            of<QueryState>({
              status: QUERY_STATUS.error,
              message: messageFor(err),
              statusText: statusTextFor(err),
            }),
          ),
          startWith({ status: QUERY_STATUS.loading } as QueryState),
          finalize(() => {
            // eslint-disable-next-line no-console
            console.log('[todo] request finalized');
          }),
        ),
      ),
    );
  }
}

/* ---- tiny helpers kept module-local to keep the pipeline readable ------ */

function messageFor(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return err.status === 0
      ? 'Network error — the server is unreachable.'
      : `Request failed with status ${err.status}.`;
  }
  return 'An unexpected error occurred.';
}

function statusTextFor(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    return err.statusText || (err.status === 0 ? 'offline' : 'error');
  }
  return 'error';
}

import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { ShowError } from '../../../ui/components/show-error/show-error';
import { GET_POSTS_USE_CASE } from '../../../core/di/tokens';
import { ScenarioService } from '../../../core/scenario/scenario.service';
import { FailureScenario } from '../../../core/scenario/failure-scenario';
import {
  httpErrorToException,
  mapExceptionToFailure,
} from '../../../core/error-handling/guards';
import {
  AuthFailure,
  CacheFailure,
  DatabaseFailure,
  Failure,
  FailureSeverity,
  NetworkFailure,
  ServerFailure,
  UnknownFailure,
} from '../../../core/error-handling/failure';
import type { Post } from '../../../domain/models/post';
import type { Result } from '../../../core/result';

/**
 * ExceptionHandlingView — documentation-by-example of THIS APP's own error
 * pipeline (the worked example of ARCHITECTURE.md's "The error pipeline").
 *
 * The app splits "something went wrong" into two deliberately decoupled stages:
 *
 *   AppException   (data-layer only; typed, technical, chained via `.cause`)
 *       │  httpErrorToException   — HttpErrorResponse → AppException (status-based)
 *       │  mapExceptionToFailure  — recursive over the cause chain
 *       ▼
 *   Failure        (domain/presentation; kind + severity + user message)
 *       │
 *       ▼
 *   Result<T>      (Success<T, warning?> | Failed) — the value the UI consumes
 *
 * The UI reasons only about Failure.kind / severity — never about HTTP status
 * codes or engine errors. Severity drives presentation mechanically: critical →
 * full-screen <ui-show-error/> (blocking); warning/info → non-blocking banner.
 *
 * This screen reads the REAL source (src/core/error-handling + src/data/remote)
 * and drives the REAL pipeline three ways live: (1) the use-case seam produces
 * real Result<Post[]> values for each failure scenario, (2) the real
 * httpErrorToException + mapExceptionToFailure functions map a chosen HTTP
 * status to a typed Failure right in the browser, and (3) the real Failure
 * classes are rendered through the real severity-driven presentation.
 *
 * NOTE: the exported `ExceptionHandlingView` is declared at the BOTTOM of this
 * file. Its `imports` reference local helper components (PipelineDemo,
 * MappingDemo, SeverityDemo) that are block-scoped declarations — the main
 * component must come AFTER every helper it names so its decorator does not
 * read an uninitialized binding at module-evaluation time (the TDZ rule every
 * view screen follows).
 */

/* -------------------------------------------------------------------------- */
/* Local live demos — declared BEFORE the exported view (TDZ rule).            */
/* Each uses REAL types from src/core/error-handling.                          */
/* -------------------------------------------------------------------------- */

/**
 * The status codes the mapping demo can synthesise. Covers every branch of
 * httpErrorToException: 0 (network), 408 (timeout), 401/403 (auth), 5xx
 * (server), and "any other status" (404 not-found → server, because the server
 * answered). Each entry carries the canned HttpErrorResponse fields the real
 * mapper reads.
 */
interface StatusOption {
  readonly value: number;
  readonly label: string;
  readonly statusText: string;
  readonly body: unknown;
  readonly note: string;
}

const STATUS_OPTIONS: readonly StatusOption[] = [
  {
    value: 0,
    label: '0 · network (no response)',
    statusText: 'Unknown',
    body: null,
    note: 'Connectivity / DNS / cert — status 0 → NetworkException.',
  },
  {
    value: 408,
    label: '408 · timeout',
    statusText: 'Request Timeout',
    body: null,
    note: '408 → TimeoutException (which extends NetworkException).',
  },
  {
    value: 401,
    label: '401 · unauthorized',
    statusText: 'Unauthorized',
    body: { message: 'Token expired' },
    note: '401/403 → AuthException → AuthFailure (warning, non-blocking).',
  },
  {
    value: 404,
    label: '404 · not found',
    statusText: 'Not Found',
    body: { message: 'Post not found' },
    note: 'The server answered → ServerException (the response default).',
  },
  {
    value: 500,
    label: '500 · server error',
    statusText: 'Internal Server Error',
    body: { message: 'Database is down' },
    note: '5xx → ServerException, carrying the body message if present.',
  },
  {
    value: 503,
    label: '503 · service unavailable',
    statusText: 'Service Unavailable',
    body: null,
    note: '5xx → ServerException; retry interceptor would have retried this.',
  },
];

/**
 * PipelineDemo — drives the REAL use-case seam. inject(GET_POSTS_USE_CASE)
 * .execute() → Result<Post[]> → render. Scenario chips write to ScenarioService,
 * which the wired FakeApiService (dev) reads on the next fetch — so flipping to
 * "server error" then refetching drives the genuine Result.Failed path through
 * the real error pipeline. This is the same seam the API-handling screen
 * exercises; here it is the live evidence that AppException → Failure → Result
 * produces a blocking <ui-show-error/> for every failure scenario.
 */
const SCENARIO_OPTIONS: readonly {
  readonly value: FailureScenario;
  readonly label: string;
  readonly hint: string;
}[] = [
  {
    value: FailureScenario.None,
    label: 'success',
    hint: 'No failure — Result.Success<Post[]>.',
  },
  {
    value: FailureScenario.NetworkFailure,
    label: 'network error',
    hint: 'NetworkException → NetworkFailure (critical, blocking).',
  },
  {
    value: FailureScenario.Timeout,
    label: 'timeout',
    hint: 'TimeoutException → NetworkFailure (critical, blocking).',
  },
  {
    value: FailureScenario.ServerFailure,
    label: 'server error (500)',
    hint: 'ServerException → ServerFailure (critical, blocking).',
  },
];

type DemoStatus = 'idle' | 'loading' | 'success' | 'error';

interface DemoState {
  readonly status: DemoStatus;
  readonly posts: readonly Post[];
  /** Non-blocking warning carried by Result.Success (offline-first pattern). */
  readonly warning?: Failure;
  /** Blocking failure carried by Result.Failed. */
  readonly failure?: Failure;
}

@Component({
  selector: 'app-exception-pipeline-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShowError],
  template: `
    <div class="demo">
      <div class="controls">
        <fieldset class="scenarios">
          <legend>API scenario (written to ScenarioService)</legend>
          @for (opt of scenarioOptions; track opt.value) {
            <label class="chip" [class.is-active]="selected() === opt.value">
              <input
                type="radio"
                name="exc-scenario"
                [value]="opt.value"
                [checked]="selected() === opt.value"
                (change)="selectScenario(opt.value)"
              />
              <span>{{ opt.label }}</span>
            </label>
          }
        </fieldset>

        <button type="button" class="btn primary" (click)="run()">
          ↻ run pipeline
        </button>
        <button type="button" class="btn" (click)="resetScenario()">
          reset
        </button>
      </div>

      <p class="hint">
        {{ activeHint() }}
      </p>

      @switch (state().status) {
        @case ('loading') {
          <p class="status loading">
            <span class="spinner" aria-hidden="true"></span>
            Running through the pipeline…
          </p>
        }
        @case ('error') {
          <div class="err-frame">
            <ui-show-error
              [message]="state().failure?.message ?? 'Unknown error'"
              [severity]="state().failure?.severity ?? 'critical'"
              [kind]="state().failure?.kind ?? 'unknown'"
              (retry)="run()"
            />
          </div>
          <p class="detail">
            <code>{{ failureClass() }}</code> · severity
            <strong>{{ state().failure?.severity }}</strong> · rendered blocking
            because severity is critical.
          </p>
        }
        @case ('success') {
          @if (state().warning) {
            <p class="status warning">
              ⚠ {{ state().warning?.message }} — non-blocking
              <code>Result.Success</code> warning (offline-first).
            </p>
          }
          @if (state().posts.length === 0) {
            <p class="status empty">No posts returned.</p>
          } @else {
            <ul class="posts">
              @for (p of state().posts; track p.id) {
                <li class="post">
                  <p class="title">{{ p.title }}</p>
                  <p class="body">{{ p.body }}</p>
                </li>
              }
            </ul>
          }
          <p class="detail">
            Result&lt;Post[]&gt; → <strong>Success</strong>
            {{ state().warning ? ' + warning' : '' }} ·
            {{ state().posts.length }} post(s).
          </p>
        }
        @default {
          <p class="status idle">
            Press <em>run pipeline</em> — the view calls
            <code>inject(GET_POSTS_USE_CASE).execute()</code> and the returned
            <code>Result&lt;Post[]&gt;</code> is rendered below.
          </p>
        }
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .scenarios {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        padding: var(--space-xxs) var(--space-xs);
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-xxs);
      }
      .scenarios legend {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        padding: 0 var(--space-xxs);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xxs);
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        cursor: pointer;
      }
      .chip input {
        accent-color: var(--color-primary);
      }
      .chip.is-active {
        border-color: var(--color-primary);
        color: var(--color-on-surface);
        background: var(--color-surface-variant);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .status {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .status.warning {
        border-color: var(--color-warning);
        color: var(--color-on-surface);
      }
      .status.idle code {
        font-family: var(--font-mono);
      }
      .err-frame {
        max-height: 320px;
        overflow: auto;
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
      }
      .posts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .post {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .post .title {
        margin: 0;
        font-size: var(--text-body-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .post .body {
        margin: var(--space-xxs) 0 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .detail {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .detail strong {
        color: var(--color-on-surface);
      }
      .detail code {
        font-family: var(--font-mono);
      }
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-outline);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        display: inline-block;
        animation: exc-spin 0.8s linear infinite;
      }
      @keyframes exc-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
class PipelineDemo {
  /** The DI-token seam — the ONLY data dependency the view declares. */
  private readonly useCase = inject(GET_POSTS_USE_CASE);
  private readonly scenario = inject(ScenarioService);

  readonly state = signal<DemoState>({ status: 'idle', posts: [] });
  readonly scenarioOptions = SCENARIO_OPTIONS;

  /** Reflects the live ScenarioService priority (timeout > network > server). */
  readonly selected = computed<FailureScenario>(() => this.scenario.apiScenario());

  readonly activeHint = computed(() => {
    const match = SCENARIO_OPTIONS.find((o) => o.value === this.selected());
    return match ? match.hint : '';
  });

  readonly failureClass = computed(
    () => this.state().failure?.constructor.name ?? '—',
  );

  /** Drive the real pipeline: use case → repository → remote/cache → Result. */
  async run(): Promise<void> {
    this.state.set({ status: 'loading', posts: [] });
    const result: Result<Post[]> = await this.useCase.execute();
    if (result.ok) {
      this.state.set({
        status: 'success',
        posts: result.value,
        warning: result.warning,
      });
    } else {
      this.state.set({ status: 'error', posts: [], failure: result.failure });
    }
  }

  /** Write exactly one scenario into the ScenarioService signals. */
  selectScenario(s: FailureScenario): void {
    this.scenario.injectNetworkFailure.set(s === FailureScenario.NetworkFailure);
    this.scenario.injectTimeout.set(s === FailureScenario.Timeout);
    this.scenario.injectServerFailure.set(s === FailureScenario.ServerFailure);
  }

  resetScenario(): void {
    this.scenario.reset();
    this.state.set({ status: 'idle', posts: [] });
  }
}

/**
 * MappingDemo — synthesises a real HttpErrorResponse for a chosen status code
 * and runs it through the REAL httpErrorToException + mapExceptionToFailure
 * (the exact functions in src/core/error-handling/guards.ts). The result is a
 * typed AppException chained into a user-facing Failure; the demo prints both,
 * so the status → exception → failure → severity mapping is visible end to end.
 * This is the single source of truth for the "404 maps to what?" question.
 */
@Component({
  selector: 'app-exception-mapping-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo">
      <div class="controls">
        <label class="pick">
          HTTP response status
          <select
            [value]="selected().value"
            (change)="onSelect($event)"
            aria-label="HTTP response status"
          >
            @for (opt of statusOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>
      </div>

      <div class="pipeline">
        <div class="step">
          <p class="step-label">HttpErrorResponse</p>
          <pre class="code">{{ httpErrorText() }}</pre>
        </div>
        <p class="arrow" aria-hidden="true">▼ httpErrorToException</p>
        <div class="step">
          <p class="step-label">AppException (technical, never shown)</p>
          <pre class="code">{{ exceptionText() }}</pre>
        </div>
        <p class="arrow" aria-hidden="true">▼ mapExceptionToFailure</p>
        <div class="step result">
          <p class="step-label">Failure (semantic, what the UI switches on)</p>
          <pre class="code">{{ failureText() }}</pre>
        </div>
      </div>

      <p class="note">{{ selected().note }}</p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .pick {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .pick select {
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .pipeline {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      .step {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: var(--space-xs) var(--space-md);
      }
      .step.result {
        border-color: var(--color-primary);
        background: var(--color-surface-variant);
      }
      .step-label {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .arrow {
        margin: 0;
        text-align: center;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-primary);
      }
      .code {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        line-height: 1.5;
        color: var(--color-on-surface);
        white-space: pre-wrap;
        word-break: break-word;
      }
      .note {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class MappingDemo {
  readonly statusOptions = STATUS_OPTIONS;
  readonly selected = signal<StatusOption>(STATUS_OPTIONS[0]);

  /** Build a real HttpErrorResponse from the selected option. */
  private readonly httpError = computed<HttpErrorResponse>(() => {
    const opt = this.selected();
    return new HttpErrorResponse({
      status: opt.value,
      statusText: opt.statusText,
      url: '/api/posts',
      error: opt.body,
    });
  });

  /** Run the REAL mapper: HttpErrorResponse → typed AppException. */
  private readonly exception = computed(() =>
    httpErrorToException(this.httpError()),
  );

  /** Run the REAL mapper: AppException → user-facing Failure (with chain). */
  private readonly failure = computed<Failure>(() =>
    mapExceptionToFailure(this.exception()),
  );

  readonly httpErrorText = computed(() => {
    const e = this.httpError();
    return `HttpErrorResponse {
  status: ${e.status},
  statusText: '${e.statusText}',
  url: '${e.url ?? '/api/posts'}',
  error: ${JSON.stringify(e.error)},
  name: '${e.name}'
}`;
  });

  readonly exceptionText = computed(() => {
    const ex = this.exception();
    return `${ex.constructor.name} {
  message: '${ex.message}',
  cause: ${describeCause(ex.cause)}
}`;
  });

  readonly failureText = computed(() => {
    const f = this.failure();
    return `${f.constructor.name} {
  kind: '${f.kind}',
  severity: '${f.severity}',
  message: '${f.message}'
}
// Failure.chain trace:
${indent(f.chain)}`;
  });

  onSelect(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    const match = STATUS_OPTIONS.find((o) => o.value === value);
    if (match) this.selected.set(match);
  }
}

/** SeverityDemo — pick a Failure kind, see the REAL severity-driven UI choice.
 * Uses the REAL Failure classes from src/core/error-handling/failure.ts. The
 * template branches on `failure.severity` exactly the way a consuming view
 * does: critical → blocking <ui-show-error/>; warning/info → non-blocking
 * banner. Includes the chained CacheFailure (warning by default, critical when
 * the cache was the last resort) so the offline-first path is visible. */
interface KindOption {
  readonly value: string;
  readonly label: string;
  readonly build: () => Failure;
}

const KIND_OPTIONS: readonly KindOption[] = [
  {
    value: 'network',
    label: 'NetworkFailure',
    build: () => new NetworkFailure('No internet connection'),
  },
  {
    value: 'server',
    label: 'ServerFailure',
    build: () => new ServerFailure('Server returned 500'),
  },
  {
    value: 'auth',
    label: 'AuthFailure (warning)',
    build: () => new AuthFailure('Authentication failed (401)'),
  },
  {
    value: 'cache-warn',
    label: 'CacheFailure (warning, warm cache)',
    build: () =>
      new CacheFailure(
        'No cached data available',
        new NetworkFailure('No internet connection'),
        FailureSeverity.Warning,
      ),
  },
  {
    value: 'cache-critical',
    label: 'CacheFailure (critical, cache was last resort)',
    build: () =>
      new CacheFailure(
        'No cached data available',
        new NetworkFailure('No internet connection'),
        FailureSeverity.Critical,
      ),
  },
  {
    value: 'database',
    label: 'DatabaseFailure',
    build: () => new DatabaseFailure('Database error'),
  },
  {
    value: 'unknown',
    label: 'UnknownFailure',
    build: () => new UnknownFailure('Something went wrong'),
  },
];

@Component({
  selector: 'app-exception-severity-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShowError],
  template: `
    <div class="demo">
      <div class="controls">
        <label class="pick">
          Failure kind
          <select
            [value]="selected().value"
            (change)="onSelect($event)"
            aria-label="Failure kind"
          >
            @for (opt of kindOptions; track opt.value) {
              <option [value]="opt.value">{{ opt.label }}</option>
            }
          </select>
        </label>
        <span class="badge" [attr.data-severity]="failure().severity">
          {{ failure().kind }} · {{ failure().severity }}
        </span>
      </div>

      @switch (failure().severity) {
        @case ('critical') {
          <div class="err-frame">
            <ui-show-error
              [message]="failure().message"
              [severity]="failure().severity"
              [kind]="failure().kind"
              (retry)="rebuild()"
            />
          </div>
          <p class="treatment">
            severity is <strong>critical</strong> → blocking
            <code>&lt;ui-show-error/&gt;</code> (full-screen).
          </p>
        }
        @default {
          <div class="banner" [attr.data-severity]="failure().severity" role="status">
            <span class="glyph" aria-hidden="true">⚠</span>
            <span class="banner-msg">{{ failure().message }}</span>
            <button
              type="button"
              class="dismiss"
              (click)="dismiss()"
              aria-label="Dismiss warning"
            >
              ✕
            </button>
          </div>
          <p class="treatment">
            severity is <strong>{{ failure().severity }}</strong> → non-blocking
            banner (the screen keeps rendering; a toast would auto-dismiss).
          </p>
        }
      }

      @if (!dismissed()) {
        <pre class="chain">{{ failure().chain }}</pre>
      } @else {
        <p class="treatment">
          <em>(warning dismissed — re-select to bring it back)</em>
        </p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .pick {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .pick select {
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .badge {
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-size: var(--text-overline);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .badge[data-severity='critical'] {
        border-color: var(--color-critical);
        color: var(--color-critical);
      }
      .badge[data-severity='warning'] {
        border-color: var(--color-warning);
        color: var(--color-warning);
      }
      .badge[data-severity='info'] {
        border-color: var(--color-info);
        color: var(--color-info);
      }
      .err-frame {
        max-height: 320px;
        overflow: auto;
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
      }
      .banner {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-warning);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .banner[data-severity='info'] {
        border-color: var(--color-info);
      }
      .banner .glyph {
        font-size: 1rem;
      }
      .banner-msg {
        flex: 1;
      }
      .dismiss {
        border: none;
        background: transparent;
        color: var(--color-on-surface-variant);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .treatment {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .treatment strong {
        color: var(--color-on-surface);
      }
      .treatment code {
        font-family: var(--font-mono);
      }
      .chain {
        margin: 0;
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        line-height: 1.5;
        color: var(--color-on-surface);
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ],
})
class SeverityDemo {
  readonly kindOptions = KIND_OPTIONS;
  readonly selected = signal<KindOption>(KIND_OPTIONS[0]);
  readonly dismissed = signal<boolean>(false);

  /** A fresh Failure instance built from the REAL constructors. */
  readonly failure = computed<Failure>(() => this.selected().build());

  onSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const match = KIND_OPTIONS.find((o) => o.value === value);
    if (match) {
      this.selected.set(match);
      this.dismissed.set(false);
    }
  }

  /** "Retry" on the blocking path rebuilds the same Failure (demo only). */
  rebuild(): void {
    this.selected.set({ ...this.selected() });
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER the demo components (TDZ rule).          */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-exception-handling-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    PipelineDemo,
    MappingDemo,
    SeverityDemo,
  ],
  templateUrl: './exception_handling_view.html',
  styleUrl: './exception_handling_view.scss',
})
export class ExceptionHandlingView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/core/error-handling + src/data.     */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  pipeline: `engine error (HttpClient / IndexedDB / JSON)
   │  PostApiService / PostDAO catch (guardedApiCall)
   ▼
AppException   (data-layer only; typed, chained via .cause)
   │  httpErrorToException      HttpErrorResponse → AppException (status-based)
   │  mapExceptionToFailure     recursive over the cause chain
   ▼
Failure        (domain/presentation; kind + severity + user message)
   │  PostRepositoryImpl        with optional cache fallback → chained CacheFailure
   ▼
Result<T>      (Success<T, warning?> | Failed)  — the value the UI consumes

   │  the UI switches on failure.severity
   ▼
critical → full-screen <ui-show-error/>      (blocking — no usable data)
warning  → non-blocking banner / toast        (data still usable, e.g. stale cache)
info     → non-blocking banner / toast        (dismissible; data still usable)`,
  exceptions: `// src/core/error-handling/exceptions.ts — the data-layer vocabulary.
// Abstract Error subclass; concrete ones name the kinds of technical failure
// the data layer can hit. Each carries an optional .cause (the original error)
// so the full chain of "what really happened" is preserved for logs. These live
// strictly in src/data + src/core/error-handling; the UI never imports them.

export type AppExceptionCause = unknown;
export interface AppExceptionOptions { cause?: AppExceptionCause }

export abstract class AppException extends Error {
  override readonly cause?: AppExceptionCause;
  constructor(message: string, options: AppExceptionOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options.cause;   // assigned after super() so it survives
  }
}

export class NetworkException     extends AppException {}   // status 0 / fetch failed
export class ServerException      extends AppException {}   // non-2xx response
export class TimeoutException     extends NetworkException {} // status 408
export class AuthException        extends AppException {}   // 401 / 403
export class AppDatabaseException extends AppException {}   // IndexedDB / Dexie`,
  httpMap: `// src/core/error-handling/guards.ts — single source of truth for the
// HttpErrorResponse → AppException mapping (used by guardedApiCall AND the retry
// interceptor, so the data layer only ever handles typed exceptions).
export function httpErrorToException(e: HttpErrorResponse): AppException {
  const status = e.status;
  if (status === 0)            return new NetworkException(e.message, { cause: e });
  if (status === 408)          return new TimeoutException('Request timed out', { cause: e });
  if (status === 401 || status === 403)
                               return new AuthException(\`Authentication failed (\${status})\`, { cause: e });
  if (status >= 500 && status <= 599)
                               return new ServerException(serverMessage(e) ?? \`Server returned \${status}\`, { cause: e });
  // Any other status: the server answered, so surface as a ServerException
  // carrying the body's message if we can find one. (404 not-found lands here.)
  return new ServerException(serverMessage(e) ?? \`Server returned \${status}\`, { cause: e });
}`,
  guardedCall: `// guardedApiCall wraps a raw data-source operation; on ANY throw it upgrades
// the unknown value into a typed AppException (idempotent if already one).
export async function guardedApiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw toAppException(e);   // → AppException (HttpErrorResponse / TypeError / …)
  }
}

// toAppException branches on the shape of the thrown value:
export function toAppException(error: unknown): AppException {
  if (error instanceof AppException) return error;          // already typed
  if (isHttpErrorResponse(error))    return httpErrorToException(error);
  if (error instanceof TypeError)    return new NetworkException(error.message, { cause: error });
  if (error instanceof SyntaxError)  return new ServerException('Invalid response format', { cause: error });
  return new ServerException('Unexpected error', { cause: error });
}`,
  mapFailure: `// The second guard maps a typed exception to its Failure, RECURSING into the
// cause so a chained exception becomes a chained Failure. Each exception type
// maps to exactly one Failure type — this is the single place that decides
// "a ServerException becomes a ServerFailure (critical)".
export function mapExceptionToFailure(e: AppException): Failure {
  const innerCause =
    e.cause instanceof AppException ? mapExceptionToFailure(e.cause) : undefined;
  if (e instanceof TimeoutException)  return new NetworkFailure(e.message, innerCause);
  if (e instanceof NetworkException)  return new NetworkFailure(e.message, innerCause);
  if (e instanceof ServerException)   return new ServerFailure(e.message, innerCause);
  if (e instanceof AuthException)     return new AuthFailure(e.message, innerCause);
  if (e instanceof AppDatabaseException) return new DatabaseFailure(e.message, innerCause);
  return new UnknownFailure(e.message, innerCause);
}`,
  failureModel: `// src/core/error-handling/failure.ts — the user-facing states the UI switches on.
// FailureSeverity is a const-object + literal union (NEVER an enum) to stay
// compatible with Angular's erasable-only TypeScript.
export const FailureSeverity = {
  Info:     'info',      // dismissible toast; data still usable
  Warning:  'warning',   // non-blocking toast (e.g. showing stale cache)
  Critical: 'critical',  // blocking — full-screen error
} as const;
export type FailureSeverity = (typeof FailureSeverity)[keyof typeof FailureSeverity];

export type FailureKind = 'network' | 'server' | 'cache' | 'auth' | 'database' | 'unknown';

export abstract class Failure {
  abstract readonly kind: FailureKind;
  abstract readonly severity: FailureSeverity;
  readonly cause?: Failure;          // chained Failure — the full story
  get message(): string { /* cause.message + this */ }
  get chain(): string   { /* multi-line trace of the chain */ }
}

// Each concrete Failure fixes its own severity, so the moment the UI has a
// Failure it also knows how urgently to surface it.
export class NetworkFailure  extends Failure { severity = 'critical' }
export class ServerFailure   extends Failure { severity = 'critical' }
export class AuthFailure     extends Failure { severity = 'warning'  }
export class DatabaseFailure extends Failure { severity = 'critical' }
export class UnknownFailure  extends Failure { severity = 'critical' }
export class CacheFailure    extends Failure {
  // Warning by default (stale cache served); Critical when the cache was the
  // last resort and it failed too (chainedCacheFailure in guards.ts).
  severity: FailureSeverity;
}`,
  severityMap: `thrown in data layer          → Failure              severity
─────────────────────────────    ────────────────────   ─────────
NetworkException / Timeout       NetworkFailure         critical
ServerException (5xx + 4xx)      ServerFailure          critical
AuthException (401 / 403)        AuthFailure            warning
AppDatabaseException (direct)    DatabaseFailure        critical
AppDatabaseException during      CacheFailure           warning   (warm cache)
  cache fallback, chained        (↑ raised to critical when the cache
                                 was the last resort and it failed too)
anything else                    UnknownFailure         critical

Severity is a PROPERTY of the Failure, not a decision left to whichever
component catches it. The UI reads failure.severity and renders mechanically.`,
  interceptor: `// src/data/remote/retry.interceptor.ts — functional HttpInterceptorFn.
// Idempotent-only, exponential full-jitter, never retries errors that are
// already typed AppExceptions (they are intentional, not transient). On
// exhaustion the error is mapped to a typed AppException via the shared
// httpErrorToException mapping, so the data layer only ever handles one shape.
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 200;

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  let attempt = 0;
  const attemptRequest = (currentReq) =>
    next(currentReq).pipe(
      catchError((error: unknown) => {
        if (error instanceof AppException)      return throwError(() => error); // never retry
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
        const exception = httpErrorToException(error);
        const retryable =
          IDEMPOTENT_METHODS.has(currentReq.method.toLowerCase()) &&
          isTransient(exception);              // NetworkException / TimeoutException only
        if (retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          return timer(jitteredDelay(attempt))  // random(0, base * 2^(attempt-1))
            .pipe(concatMap(() => attemptRequest(currentReq)));
        }
        return throwError(() => exception);     // typed → data layer
      }),
    );
  return attemptRequest(req);
};`,
  chaining: `// src/core/error-handling/guards.ts — building a chained failure during the
// repository's cache fallback. The cache was the last resort and it failed, so
// the CacheFailure is marked Critical and carries the upstream Failure as its
// .cause — the whole compound story survives in one value.
export function chainedCacheFailure(
  dbError: AppDatabaseException,
  upstream: Failure,
): Failed {
  return failed(
    new CacheFailure(dbError.message, upstream, FailureSeverity.Critical),
  );
}

// What the UI/logs then see:
const chained = chainedCacheFailure(dbError, networkFailure).failure;

chained.message;
// → "No internet connection + No cached data available"
//   (joined: cause.message + ' + ' + this.rawMessage)

chained.chain;
// → "No cached data available
//     → caused by: No internet connection"
//   (multi-line trace, one line per link — this is what gets logged)`,
  consume: `// A view consumes Result through the use-case seam, then switches on severity
// exactly the way this screen's SeverityDemo does. The view imports NEITHER
// HttpClient nor a DTO nor a repository impl — only the domain Failure type.
type DemoStatus = 'idle' | 'loading' | 'success' | 'error';

private readonly useCase = inject(GET_POSTS_USE_CASE);   // the SEAM
readonly state = signal<DemoState>({ status: 'idle', posts: [] });

async run(): Promise<void> {
  this.state.set({ status: 'loading', posts: [] });
  const result: Result<Post[]> = await this.useCase.execute();
  if (result.ok) {
    // Success — optionally carry a NON-BLOCKING warning (offline-first).
    this.state.set({ status: 'success', posts: result.value, warning: result.warning });
  } else {
    // Failed — blocking. Severity (always critical for network/server) decides
    // the treatment: full-screen <ui-show-error/> with a Retry.
    this.state.set({ status: 'error', posts: [], failure: result.failure });
  }
}

// template:
// @switch (state().status) {
//   @case ('error') {
//     <ui-show-error
//       [message]="state().failure!.message"
//       [severity]="state().failure!.severity"   // critical  → blocking
//       [kind]="state().failure!.kind"
//       (retry)="run()" />
//   }
//   @case ('success') {
//     @if (state().warning) { <warning-banner .../> }   // warning → non-blocking
//     <post-list .../>
//   }
// }`,
  reactVsAngular: `Angular vs the React sibling — the error model is identical:

• Two stages, both sides. AppException (data) → Failure (domain) → Result<T>.
  The React guide uses the same names and the same .cause chaining; this app
  ports them verbatim into src/core/error-handling/.
• HTTP mapper — Angular branches on HttpErrorResponse.status (0/408/401/403/
  5xx); the React guide branches on axios.isAxiosError + error.response.status.
  Same status→exception table; the only diff is the engine error shape.
• Severity model — identical const-object + literal union (info/warning/critical),
  never an enum on either side. Severity is fixed per Failure kind.
• Presentation — critical → <ui-show-error/> (full-screen, blocking); warning/
  info → non-blocking snackbar. React uses a useFailureSnackbar hook +
  <FailureSnackbarStack/>; Angular uses an inline banner (this screen) or a
  snackbar service. Same two treatments, picked by the same severity field.
• Result<T> — discriminated union on result.ok in both. Expected failures are
  VALUES, not throws, so every call site acknowledges them at the type level.`,
};

/* -------------------------------------------------------------------------- */
/* Local helpers for the mapping demo's printed output.                        */
/* -------------------------------------------------------------------------- */

function describeCause(cause: unknown): string {
  if (cause instanceof HttpErrorResponse) {
    return `HttpErrorResponse(status ${cause.status})`;
  }
  if (cause instanceof Error) {
    return `${cause.constructor.name}('${cause.message}')`;
  }
  return String(cause);
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.length ? `  ${line}` : line))
    .join('\n');
}

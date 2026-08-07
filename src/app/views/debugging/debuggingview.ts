import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, of, take, tap, catchError, finalize } from 'rxjs';

import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

// Real error-pipeline code — the screen documents the actual source.
import {
  AppDatabaseException,
  AuthException,
  ServerException,
  TimeoutException,
} from '../../../core/error-handling/exceptions';
import { Failure } from '../../../core/error-handling/failure';
import {
  chainedCacheFailure,
  mapExceptionToFailure,
} from '../../../core/error-handling/guards';

/**
 * DebuggingView — how to find out what is wrong when an Angular app misbehaves.
 *
 * Debugging in a browser Angular app is three toolboxes stacked:
 *   1. Angular DevTools (the browser extension) — the component tree inspector
 *      and the change-detection profiler. The thing the DOM cannot show you.
 *   2. The browser DevTools — sources + source maps + breakpoints, the Network
 *      panel, the Console. The runtime the app runs in.
 *   3. The app's own structured output — RxJS `tap`/`catchError`/`finalize`
 *      logs in the data pipeline, the `Failure.chain` cause trace the error
 *      pipeline builds for you, signal `effect` logs, and the level-gated
 *      `Logger`.
 *
 * Plus the pitfalls that are specific to Angular's reactive model:
 * `ExpressionChangedAfterItHasBeenChecked`, change-detection loops, and leaked
 * subscriptions/effects. Each is a class of bug the toolboxes above exist to
 * find.
 *
 * The screen ships THREE live demos:
 *   - a "devtools-style" component-tree inspector that mirrors what Angular
 *     DevTools' Components tab shows (the screen's own subtree, with live
 *     signal values),
 *   - an RxJS stream piped through `tap`/`catchError`/`finalize` that writes
 *     to an on-screen console,
 *   - a signal `effect` that logs each recomputation.
 *
 * NOTE: the exported `DebuggingView` is declared at the BOTTOM of this file,
 * AFTER every helper it names. Its decorator reads those bindings at module-
 * evaluation time, so they must be initialized first (the TDZ rule every other
 * view screen follows).
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

/** One line in the on-screen log panels. */
interface LogEntry {
  readonly order: number;
  readonly level: 'next' | 'error' | 'info';
  readonly text: string;
  readonly at: number;
}

/** A failure scenario the user can pick in the FailureTraceDemo. */
type FailureScenarioId =
  | 'timeout'
  | 'server-then-cache-miss'
  | 'auth';

interface FailureScenario {
  readonly id: FailureScenarioId;
  readonly label: string;
  readonly summary: string;
}

const FAILURE_SCENARIOS: readonly FailureScenario[] = [
  {
    id: 'timeout',
    label: 'Request timeout',
    summary:
      'A GET /posts times out. httpErrorToException maps status 408 → TimeoutException; mapExceptionToFailure wraps it as a NetworkFailure (critical).',
  },
  {
    id: 'server-then-cache-miss',
    label: 'Server 5xx + cache miss',
    summary:
      'The remote fails with 503, the repository falls back to the local cache, and the DAO throws AppDatabaseException — chainedCacheFailure builds a critical CacheFailure over the ServerFailure.',
  },
  {
    id: 'auth',
    label: 'Auth expired (401)',
    summary:
      'The session expired; httpErrorToException maps 401 → AuthException; mapExceptionToFailure produces an AuthFailure (warning, non-blocking).',
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Demo 1 — Angular DevTools-style component-tree inspector                   */
/* -------------------------------------------------------------------------- */

/**
 * The three "nodes" rendered inside the inspector stage. Each is a tiny
 * standalone OnPush component owning one or two signals — exactly the shape an
 * Angular DevTools Components-tab row would inspect.
 */
@Component({
  selector: 'app-inspector-counter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="node-row">
      <button type="button" class="node-btn" (click)="dec()">−</button>
      <span class="node-value">{{ count() }}</span>
      <button type="button" class="node-btn" (click)="inc()">+</button>
    </div>
  `,
  styles: [
    `
      .node-row {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .node-btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        width: 24px;
        height: 24px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-weight: 600;
      }
      .node-btn:hover {
        border-color: var(--color-primary);
      }
      .node-value {
        min-width: 2rem;
        text-align: center;
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
    `,
  ],
})
class InspectorCounterNode {
  readonly count = signal(0);
  inc(): void {
    this.count.update((c) => c + 1);
  }
  dec(): void {
    this.count.update((c) => c - 1);
  }
}

@Component({
  selector: 'app-inspector-items',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <div class="node-row">
      @for (item of items(); track item) {
        <span class="chip">{{ item }}</span>
      } @empty {
        <span class="empty">(empty)</span>
      }
      <button type="button" class="node-btn" (click)="add()" aria-label="add item">
        +
      </button>
      <button
        type="button"
        class="node-btn"
        (click)="remove()"
        aria-label="remove item"
      >
        −
      </button>
    </div>
  `,
  styles: [
    `
      .node-row {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .chip {
        background: var(--color-surface-variant);
        color: var(--color-on-surface);
        padding: 2px var(--space-sm);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: 0.75rem;
      }
      .empty {
        color: var(--color-on-surface-variant);
        font-size: 0.75rem;
      }
      .node-btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        width: 24px;
        height: 24px;
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-weight: 600;
      }
      .node-btn:hover {
        border-color: var(--color-primary);
      }
    `,
  ],
})
class InspectorItemsNode {
  readonly items = signal<string[]>(['Angular', 'DevTools']);
  add(): void {
    this.items.update((list) => [...list, `Item ${list.length + 1}`]);
  }
  remove(): void {
    this.items.update((list) => list.slice(0, -1));
  }
}

@Component({
  selector: 'app-inspector-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    <button
      type="button"
      class="toggle"
      [class.on]="on()"
      (click)="toggle()"
    >
      {{ on() ? 'ON' : 'OFF' }}
    </button>
  `,
  styles: [
    `
      .toggle {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: 2px var(--space-sm);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        cursor: pointer;
      }
      .toggle.on {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border-color: var(--color-primary);
      }
    `,
  ],
})
class InspectorToggleNode {
  readonly on = signal(false);
  toggle(): void {
    this.on.update((v) => !v);
  }
}

/**
 * A "node descriptor" the inspector renders — mirrors what the Angular DevTools
 * Components tab shows per row: the selector, the component class name, and the
 * live values of its public signals.
 */
interface InspectorRow {
  readonly selector: string;
  readonly className: string;
  readonly signals: ReadonlyArray<{ readonly name: string; readonly value: string }>;
}

/**
 * The CENTERPIECE demo #1. Renders a small live component subtree on the left,
 * and an Angular-DevTools-style inspector of that SAME subtree on the right.
 * The inspector is built from `viewChild` signal queries over the children, so
 * it updates live as you interact with the stage — exactly what the Components
 * tab does (it reads each component's reactive state after every change run).
 */
@Component({
  selector: 'app-devtools-inspector-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InspectorCounterNode, InspectorItemsNode, InspectorToggleNode],
  template: `
    <div class="inspector">
      <div class="stage">
        <span class="caption">live subtree</span>
        <div class="stage-grid">
          <div class="stage-cell">
            <span class="stage-label">app-inspector-counter</span>
            <app-inspector-counter />
          </div>
          <div class="stage-cell">
            <span class="stage-label">app-inspector-items</span>
            <app-inspector-items />
          </div>
          <div class="stage-cell">
            <span class="stage-label">app-inspector-toggle</span>
            <app-inspector-toggle />
          </div>
        </div>
        <p class="footnote">
          Interact with the controls above — buttons, add/remove, toggle. The
          inspector on the right reads the same signals the template does and
          refreshes after every change-detection pass, exactly like the
          Components tab.
        </p>
      </div>

      <div class="tree" role="tree" aria-label="Angular DevTools component tree">
        <div class="tree-head">
          <span class="caption">Angular DevTools — Components</span>
        </div>
        <ul class="tree-list">
          <li class="tree-node root" role="treeitem" aria-expanded="true">
            <span class="sel">app-devtools-inspector-demo</span>
            <span class="cls">DebuggingInspectorDemo</span>
            <ul class="tree-children">
              @for (row of rows(); track row.selector) {
                <li class="tree-node" role="treeitem" aria-expanded="true">
                  <span class="sel">{{ row.selector }}</span>
                  <span class="cls">{{ row.className }}</span>
                  <div class="signals">
                    @for (s of row.signals; track s.name) {
                      <span class="signal">
                        <span class="signal-name">{{ s.name }}</span>
                        <span class="signal-val">{{ s.value }}</span>
                      </span>
                    }
                  </div>
                </li>
              }
            </ul>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .inspector {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-md);
      }
      @media (min-width: 720px) {
        .inspector {
          grid-template-columns: 1fr 1fr;
        }
      }
      .stage,
      .tree {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        padding: var(--space-md);
      }
      .caption {
        display: block;
        font-size: var(--text-overline);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--color-on-surface-variant);
        margin-bottom: var(--space-sm);
      }
      .stage-grid {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .stage-cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-sm);
      }
      .stage-label {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--color-on-surface-variant);
      }
      .footnote {
        margin: var(--space-sm) 0 0;
        font-size: 0.78rem;
        color: var(--color-on-surface-variant);
      }
      .tree-head {
        margin-bottom: var(--space-sm);
      }
      .tree-list,
      .tree-children {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .tree-children {
        padding-left: var(--space-md);
        border-left: 1px dashed var(--color-outline);
        margin-left: var(--space-xs);
      }
      .tree-node {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-xs) 0;
      }
      .sel {
        font-family: var(--font-mono);
        font-size: 0.78rem;
        color: var(--color-primary);
      }
      .cls {
        font-size: 0.68rem;
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .signals {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: var(--space-xs);
      }
      .signal {
        display: flex;
        gap: var(--space-xs);
        font-family: var(--font-mono);
        font-size: 0.72rem;
      }
      .signal-name {
        color: var(--color-on-surface-variant);
        min-width: 4.5rem;
      }
      .signal-val {
        color: var(--color-on-surface);
        word-break: break-all;
      }
    `,
  ],
})
class DevToolsInspectorDemo {
  private readonly counter = viewChild(InspectorCounterNode);
  private readonly items = viewChild(InspectorItemsNode);
  private readonly toggle = viewChild(InspectorToggleNode);

  /** The inspector rows — derived (via computed) from the live signal queries. */
  readonly rows = computed<InspectorRow[]>(() => {
    const counter = this.counter();
    const items = this.items();
    const toggle = this.toggle();
    const out: InspectorRow[] = [];
    if (counter) {
      out.push({
        selector: 'app-inspector-counter',
        className: 'InspectorCounterNode',
        signals: [{ name: 'count', value: String(counter.count()) }],
      });
    }
    if (items) {
      out.push({
        selector: 'app-inspector-items',
        className: 'InspectorItemsNode',
        signals: [
          { name: 'items', value: this.formatArray(items.items()) },
        ],
      });
    }
    if (toggle) {
      out.push({
        selector: 'app-inspector-toggle',
        className: 'InspectorToggleNode',
        signals: [{ name: 'on', value: String(toggle.on()) }],
      });
    }
    return out;
  });

  private formatArray(values: readonly string[]): string {
    if (values.length === 0) return '[]';
    return `[${values.map((v) => `'${v}'`).join(', ')}]`;
  }
}

/* -------------------------------------------------------------------------- */
/* Demo 2 — RxJS tap/catchError/finalize stream → on-screen console           */
/* -------------------------------------------------------------------------- */

/**
 * CENTERPIECE demo #2. A button kicks off an RxJS pipeline (interval → take →
 * tap → catchError → finalize). Each operator writes to an on-screen log that
 * mirrors what your browser console would show. The "fail mid-stream" toggle
 * injects an error on the 3rd emission so the catchError + finalize branches
 * fire visibly.
 *
 * The subscription is tied to the component lifetime via takeUntilDestroyed,
 * so navigating away disposes it — the same hygiene the app's data layer
 * enforces everywhere.
 */
@Component({
  selector: 'app-rxjs-tap-log-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo">
      <div class="controls">
        <button
          type="button"
          class="btn primary"
          (click)="start()"
          [disabled]="running()"
        >
          {{ running() ? 'streaming…' : 'start stream' }}
        </button>
        <label class="toggle">
          <input
            type="checkbox"
            [checked]="failMidStream()"
            (change)="onFailToggle($event)"
          />
          throw on 3rd emission (drive catchError + finalize)
        </label>
        <button type="button" class="btn ghost" (click)="clear()">clear</button>
      </div>

      <div class="console" aria-label="on-screen RxJS console">
        <span class="console-head"># console — tap / catchError / finalize</span>
        @if (logs().length === 0) {
          <span class="empty">(empty — start the stream)</span>
        } @else {
          <div class="console-body">
            @for (l of logs(); track l.order) {
              <span class="line" [class.err]="l.level === 'error'" [class.info]="l.level === 'info'">
                <span class="ord">{{ l.order }}</span>
                <span class="op">{{ l.level }}</span>
                <span class="txt">{{ l.text }}</span>
              </span>
            }
          </div>
        }
      </div>
      <p class="footnote">
        The same lines would print to the real browser Console if you removed
        the on-screen capture. This is the exact shape the app's
        <code>retry.interceptor.ts</code> uses to narrate retry decisions.
      </p>
    </div>
  `,
  styles: [
    `
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-weight: 600;
        cursor: pointer;
      }
      .btn.primary {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border-color: var(--color-primary);
      }
      .btn.primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn.ghost {
        color: var(--color-on-surface-variant);
      }
      .toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        font-size: 0.8rem;
        color: var(--color-on-surface-variant);
        cursor: pointer;
      }
      .toggle input {
        accent-color: var(--color-primary);
      }
      .console {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
      }
      .console-head {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .console-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
      }
      .empty {
        color: var(--color-on-surface-variant);
        font-size: 0.78rem;
      }
      .line {
        display: grid;
        grid-template-columns: 2rem 5rem 1fr;
        gap: var(--space-xs);
        font-size: 0.74rem;
        color: var(--color-on-surface);
      }
      .line.err {
        color: var(--color-critical);
      }
      .line.info {
        color: var(--color-on-surface-variant);
      }
      .ord {
        text-align: right;
        color: var(--color-on-surface-variant);
      }
      .op {
        text-transform: uppercase;
        font-size: 0.68rem;
        letter-spacing: 0.04em;
        color: var(--color-primary);
      }
      .line.err .op {
        color: var(--color-critical);
      }
      .line.info .op {
        color: var(--color-on-surface-variant);
      }
      .footnote {
        margin: 0;
        font-size: 0.78rem;
        color: var(--color-on-surface-variant);
      }
      .footnote code {
        font-family: var(--font-mono);
        background: var(--color-surface-variant);
        padding: 1px var(--space-xs);
        border-radius: var(--radius-sm);
      }
    `,
  ],
})
class RxJSTapLogDemo {
  private readonly destroyRef = inject(DestroyRef);

  readonly logs = signal<LogEntry[]>([]);
  readonly running = signal(false);
  readonly failMidStream = signal(false);

  private order = 0;

  constructor() {
    // Hard stop any in-flight stream if the component is destroyed mid-run.
    this.destroyRef.onDestroy(() => this.running.set(false));
  }

  onFailToggle(event: Event): void {
    this.failMidStream.set((event.target as HTMLInputElement).checked);
  }

  clear(): void {
    this.logs.set([]);
    this.order = 0;
  }

  start(): void {
    this.clear();
    this.running.set(true);
    const failOn3 = this.failMidStream();

    interval(600)
      .pipe(
        take(6),
        // tap is the debug side-channel: it sees every value without changing it.
        tap((n) => this.append('next', `tap: emitted ${n}`)),
        // Inject an error mid-stream to exercise catchError + finalize.
        catchError((err) => {
          if (err !== '__inject') {
            // Re-throw genuine errors unchanged.
            throw err;
          }
          this.append('error', 'catchError: error caught, recovering with of(null)');
          return of(null);
        }),
        finalize(() => {
          this.append('info', 'finalize: stream terminated (cleanup hook)');
          this.running.set(false);
        }),
        // Map interval values to a chance to inject the synthetic error.
        // Implemented as a second tap that throws a sentinel value caught above.
        tap((n) => {
          if (failOn3 && n === 3) {
            this.append('error', 'tap: throwing injected error on n === 3');
            throw '__inject';
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          /* values already logged via tap */
        },
        error: (e) => {
          this.append('error', `subscribe error: ${String(e)}`);
          this.running.set(false);
        },
        complete: () => {
          this.append('info', 'subscribe: complete');
          this.running.set(false);
        },
      });
  }

  private append(level: LogEntry['level'], text: string): void {
    this.order += 1;
    this.logs.update((list) =>
      [...list, { order: this.order, level, text, at: Date.now() }].slice(-40),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Demo 3 — signal effect logging                                             */
/* -------------------------------------------------------------------------- */

/**
 * CENTERPIECE demo #3. Bump a count signal; an `effect` reads it (and its
 * `computed` double) and appends each recomputation to an on-screen log with a
 * monotonic order counter. This is the idiomatic way to "console.log a signal"
 * — the effect tracks its dependencies automatically and re-runs only when
 * they change, and it lives in the injection context so its lifetime is owned
 * by the component (no manual dispose).
 */
@Component({
  selector: 'app-effect-log-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo">
      <div class="controls">
        <button type="button" class="btn primary" (click)="bump()">
          bump count → trigger effect
        </button>
        <button type="button" class="btn" (click)="reset()">reset count</button>
        <button type="button" class="btn ghost" (click)="clearLog()">clear log</button>
      </div>

      <div class="readout">
        <span class="cell">
          <span class="label">count()</span>
          <span class="val">{{ count() }}</span>
        </span>
        <span class="cell">
          <span class="label">double() = computed</span>
          <span class="val">{{ double() }}</span>
        </span>
      </div>

      <div class="log" aria-label="effect log">
        <span class="log-head"># effect log</span>
        @if (entries().length === 0) {
          <span class="empty">(empty — bump count to fire the effect)</span>
        } @else {
          <div class="log-body">
            @for (e of entries(); track e.order) {
              <span class="line">
                <span class="ord">#{{ e.order }}</span>
                <span class="txt">
                  effect fired: count = {{ e.value }}, double = {{ e.double }}
                </span>
              </span>
            }
          </div>
        }
      </div>
      <p class="footnote">
        The effect runs during change detection after each signal write, the
        same lifecycle hook that drives the screen. Writing to other signals
        from inside an effect is disallowed by default — log, don't mutate.
      </p>
    </div>
  `,
  styles: [
    `
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-sm);
        font-family: var(--font-body);
        font-weight: 600;
        cursor: pointer;
      }
      .btn.primary {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border-color: var(--color-primary);
      }
      .btn.ghost {
        color: var(--color-on-surface-variant);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }
      .cell {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        min-width: 7rem;
      }
      .label {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .val {
        font-family: var(--font-mono);
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--color-primary);
      }
      .log {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
      }
      .log-head {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .log-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 200px;
        overflow-y: auto;
      }
      .empty {
        color: var(--color-on-surface-variant);
        font-size: 0.78rem;
      }
      .line {
        display: grid;
        grid-template-columns: 3rem 1fr;
        gap: var(--space-xs);
        font-size: 0.74rem;
        color: var(--color-on-surface);
      }
      .ord {
        color: var(--color-on-surface-variant);
      }
      .footnote {
        margin: 0;
        font-size: 0.78rem;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class EffectLogDemo {
  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);
  readonly entries = signal<
    ReadonlyArray<{ readonly order: number; readonly value: number; readonly double: number }>
  >([]);

  private order = 0;

  constructor() {
    // The effect tracks count() and double() (double itself tracks count).
    // Each fire appends a row — the canonical "log a signal" pattern.
    effect(() => {
      const value = this.count();
      const doubled = this.double();
      this.order += 1;
      this.entries.update((list) =>
        [...list, { order: this.order, value, double: doubled }].slice(-30),
      );
    });
  }

  bump(): void {
    this.count.update((c) => c + 1);
  }

  reset(): void {
    this.count.set(0);
  }

  clearLog(): void {
    this.entries.set([]);
    this.order = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Demo 4 — Failure.chain trace (real error-pipeline code)                    */
/* -------------------------------------------------------------------------- */

interface FailureTraceResult {
  readonly scenario: FailureScenario;
  readonly failureClass: string;
  readonly kind: string;
  readonly severity: string;
  readonly message: string;
  readonly chain: string;
}

/**
 * CENTERPIECE demo #4. Pick a failure scenario; the demo constructs the REAL
 * AppException(s) that scenario would produce, runs them through the REAL
 * mapExceptionToFailure / chainedCacheFailure functions, and renders the
 * resulting Failure's class, kind, severity, joined message, and the multi-line
 * `Failure.chain` cause trace. This is the exact narrative the error pipeline
 * ships to your logs for free (see the Exception-handling screen for the deep
 * dive).
 */
@Component({
  selector: 'app-failure-trace-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo">
      <div class="scenarios">
        @for (s of scenarios; track s.id) {
          <button
            type="button"
            class="chip"
            [class.active]="selected() === s.id"
            (click)="select(s.id)"
          >
            {{ s.label }}
          </button>
        }
      </div>

      @if (result(); as r) {
        <p class="summary">{{ r.scenario.summary }}</p>

        <div class="trace">
          <div class="row">
            <span class="key">Failure class</span>
            <span class="val">{{ r.failureClass }}</span>
          </div>
          <div class="row">
            <span class="key">kind</span>
            <span class="val">{{ r.kind }}</span>
          </div>
          <div class="row">
            <span class="key">severity</span>
            <span class="val" [class.crit]="r.severity === 'critical'" [class.warn]="r.severity === 'warning'">
              {{ r.severity }}
            </span>
          </div>
          <div class="row">
            <span class="key">message</span>
            <span class="val mono">{{ r.message }}</span>
          </div>
          <div class="row col">
            <span class="key">Failure.chain (what the logger prints)</span>
            <pre class="chain">{{ r.chain }}</pre>
          </div>
        </div>
      }
      <p class="footnote">
        The chain is the pre-built debugging narrative the architecture hands
        you: read it before reaching for breakpoints. Each line is one layer of
        the cause, oldest first.
      </p>
    </div>
  `,
  styles: [
    `
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .scenarios {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .chip {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-pill);
        font-family: var(--font-body);
        font-size: 0.8rem;
        cursor: pointer;
      }
      .chip.active {
        background: var(--color-primary);
        color: var(--color-on-primary);
        border-color: var(--color-primary);
      }
      .summary {
        margin: 0;
        font-size: 0.85rem;
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
      .trace {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .row {
        display: grid;
        grid-template-columns: 11rem 1fr;
        gap: var(--space-sm);
        align-items: baseline;
      }
      .row.col {
        grid-template-columns: 1fr;
      }
      .key {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .val {
        font-size: 0.85rem;
        color: var(--color-on-surface);
      }
      .val.mono {
        font-family: var(--font-mono);
        word-break: break-word;
      }
      .val.crit {
        color: var(--color-critical);
        font-weight: 700;
      }
      .val.warn {
        color: var(--color-warning);
        font-weight: 700;
      }
      .chain {
        margin: var(--space-xs) 0 0;
        padding: var(--space-sm) var(--space-md);
        background: var(--color-surface-variant);
        border-radius: var(--radius-sm);
        font-family: var(--font-mono);
        font-size: 0.78rem;
        color: var(--color-on-surface);
        white-space: pre-wrap;
        overflow-x: auto;
      }
      .footnote {
        margin: 0;
        font-size: 0.78rem;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class FailureTraceDemo {
  readonly scenarios = FAILURE_SCENARIOS;
  readonly selected = signal<FailureScenarioId>('server-then-cache-miss');
  readonly result = computed<FailureTraceResult>(() => {
    const id = this.selected();
    const scenario =
      FAILURE_SCENARIOS.find((s) => s.id === id) ?? FAILURE_SCENARIOS[0]!;
    let failure: Failure;
    if (id === 'timeout') {
      failure = mapExceptionToFailure(
        new TimeoutException('GET /posts timed out after 8000ms'),
      );
    } else if (id === 'server-then-cache-miss') {
      const upstream = new ServerException('GET /posts returned 503');
      const dbError = new AppDatabaseException(
        'IndexedDB read failed (QuotaExceeded)',
      );
      failure = chainedCacheFailure(
        dbError,
        mapExceptionToFailure(upstream),
      ).failure;
    } else {
      failure = mapExceptionToFailure(
        new AuthException('401 Unauthorized — session expired'),
      );
    }
    return {
      scenario,
      failureClass: failure.constructor.name,
      kind: failure.kind,
      severity: failure.severity,
      message: failure.message,
      chain: failure.chain,
    };
  });

  select(id: FailureScenarioId): void {
    this.selected.set(id);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER its helpers (TDZ rule).                 */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-debugging-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    DevToolsInspectorDemo,
    RxJSTapLogDemo,
    EffectLogDemo,
    FailureTraceDemo,
  ],
  templateUrl: './debugging_view.html',
  styleUrl: './debugging_view.scss',
})
export class DebuggingView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are REAL source from this repo (retry.interceptor.ts,         */
/* guards.ts, logger.ts) plus idiomatic Angular debugging snippets.           */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  devToolsTree: `// Angular DevTools (the browser extension) — Components tab.
// Shows the component tree (NOT the DOM tree) and, for the selected component,
// the live value of every signal/input/state field. Click a node to inspect;
// DevTools re-reads reactive state after every change-detection pass.

  ▼ <app-debugging-view>          DebuggingView
    ▼ <app-devtools-inspector-demo>   DebuggingInspectorDemo
        ▼ <app-inspector-counter>     InspectorCounterNode
            count: Signal<number> = 3
        ▼ <app-inspector-items>       InspectorItemsNode
            items: Signal<string[]> = ['Angular','DevTools']
        ▼ <app-inspector-toggle>      InspectorToggleNode
            on: Signal<boolean> = true

// Profiler tab: Record → interact → stop. Lists every component that ran
// change detection and WHY (signal write, input change, event), which is the
// only way to chase down a slow re-render.`,
  devToolsProfiler: `// The Profiler visualises change detection. Hit Record, interact, stop.
// Each bar = one component that ran CD on that pass; the flame graph shows
// time spent. Use it to answer "why did this re-render?" and "where is the
// jank?".

// Common findings:
//   • a parent re-rendered and dragged children with it   → switch to OnPush
//   • a signal write inside an effect caused a cascade      → restructure
//   • a heavy pipe runs every CD cycle                      → make it pure
//   • ngFor without trackBy rebuilds the whole list         → add track`,
  sourceMaps: `// angular.json (default) — source maps ON in development, OFF in the prod
// bundle (mapped separately so the prod shipped JS is small but the symbols
// are still recoverable from your error tracker).
//
// "sourceMap": { "scripts": true, "styles": true, "hidden": false }
//
// In DevTools → Sources you see the ORIGINAL TypeScript you wrote, not the
// bundled JS. Set a breakpoint on the real line; inspect variables in scope;
// step through. The \`debugger;\` statement works as a breakpoint you commit.

loadPosts() {
  debugger;                              // DevTools pauses here
  const result = this.useCase.execute();
  if (!result.ok) console.error('failed', result.failure.chain);
}`,
  ngProbe: `// ng.probe — the LEGACY pre-Ivy debugging helper. With Ivy (Angular 9+),
// ng.probe is gone; the modern equivalent is Angular DevTools' Components tab
// (above) or reading a component ref via viewChild / inject(ViewContainerRef).
//
// Pre-Ivy (legacy, kept here for context):
//   const el = document.querySelector('app-debugging-view');
//   const probe = window.ng.probe(el);          // → componentInstance
//   probe.componentInstance.count();             // read a signal directly
//
// Today, prefer DevTools or signal queries from inside the component:
//   private readonly box = viewChild('box');     // Signal<HTMLElement|undefined>
// And the Augury extension (the even-older predecessor to Angular DevTools) is
// deprecated and unmaintained — use Angular DevTools instead.`,
  retryInterceptor: `// src/data/remote/retry.interceptor.ts — the app's REAL functional interceptor.
// RxJS pipeline: catchError → (typed?) → (transient + idempotent?) → timer +
// concatMap retry → on exhaustion, throw the typed AppException. Each branch is
// a place to insert a tap() while debugging.

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  let attempt = 0;
  const attemptRequest = (currentReq: HttpRequest<unknown>): Observable<HttpEvent<unknown>> =>
    next(currentReq).pipe(
      catchError((error: unknown) => {
        if (error instanceof AppException) return throwError(() => error);     // intentional
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
        const exception = httpErrorToException(error);
        const retryable = IDEMPOTENT_METHODS.has(currentReq.method.toLowerCase())
                       && isTransient(exception);
        if (retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          return timer(jitteredDelay(attempt)).pipe(concatMap(() => attemptRequest(currentReq)));
        }
        return throwError(() => exception);                                    // typed
      }),
    );
  return attemptRequest(req);
};`,
  tapCatchFinally: `// The RxJS debug side-channel: tap, catchError, finalize. None of them change
// the stream — tap sees every value, catchError recovers (or re-throws),
// finalize fires exactly once on completion OR error. This is how you add
// "log what's happening" without breaking the pipeline.

source$.pipe(
  tap((value) => console.log('next', value)),
  catchError((err) => {
    console.error('caught', err);
    return of(fallback);
  }),
  finalize(() => console.log('stream ended (success or error)')),
).subscribe();

// Marbles: visualize-tasks/rxjs marbles or rxmarbles.com map the ASCII
// marble notation (---a---b---c---|) onto each operator so you can SEE the
// timing relationship between the source and the transformed stream.`,
  effectLogging: `// Debugging signals — effect() is the reactive console.log. It tracks every
// signal you read and re-runs only when one of them changes, in the injection
// context (so its lifetime is owned by the component, no manual dispose).

constructor() {
  effect(() => {
    const value = this.count();             // tracked
    const doubled = this.double();          // double is computed(count) — also tracked
    console.log(\`[CounterEffect] count=\${value} double=\${doubled}\`);
  });
}

// OnPush + signals: a signal write schedules change detection on EXACTLY the
// components that read it — no zone, no markForCheck. The effect fires during
// that same CD cycle, after the template has re-rendered.`,
  failureChain: `// src/core/error-handling/failure.ts — the cause chain IS the debug narrative.
// A compound failure ("served nothing because cache read failed because the
// server was down") reconstructs the whole story in one value.

abstract class Failure {
  abstract readonly kind: FailureKind;
  abstract readonly severity: FailureSeverity;
  readonly cause?: Failure;
  get message(): string {                     // joined: cause → this
    return this.cause ? \`\${this.cause.message} + \${this.rawMessage}\` : this.rawMessage;
  }
  get chain(): string {                        // multi-line trace for logs
    const parts = [this.rawMessage];
    let current = this.cause;
    while (current) {
      parts.push(\`  → caused by: \${current.rawMessage}\`);
      current = current.cause;
    }
    return parts.join('\\n');
  }
}`,
  consoleDiscipline: `// src/core/config/logger.ts — level-gated, env-aware. In dev everything
// emits; in production only error-level lines survive, so the console stays
// clean for users and noisy for developers.

const LEVEL_PRIORITY = { debug: 10, info: 20, warning: 30, error: 40 };

constructor(name: string, enableLogs = true) {
  this.minPriority = enableLogs ? LEVEL_PRIORITY.debug    // dev: everything
                                : LEVEL_PRIORITY.error;   // prod: errors only
}

// → "[PostsRepositoryImpl] WARNING: Remote fetch failed (NetworkException)…"
this.logger.warning('Remote fetch failed (…), falling back to cache');

// Discipline: never console.log directly in a service. Route through the
// Logger so the prod build can strip it, the level is consistent, and the tag
// tells you WHICH service emitted the line.`,
  expressionChanged: `// ExpressionChangedAfterItHasBeenChecked — the classic Angular dev-mode error.
// It fires when a signal/value you read in the template is mutated DURING the
// same change-detection pass (after Angular has already read it).
//
// Typical triggers and fixes:

// 1) writing a signal synchronously in a child's ngOnInit that the parent
//    template already read → defer with setTimeout/microtask, or move the
//    write to an effect.

// 2) reading a signal in the template AND mutating it in an effect in the same
//    tick → don't write other signals from inside an effect; use linkedSignal
//    or computed instead.

// 3) calling a function in the template that returns a new ref each CD cycle
//    → cache it with a computed signal.

// Dev mode runs change detection TWICE on purpose to surface this. It is a
// warning, not noise: a value that changes after being checked will mis-render.`,
  cdLoops: `// Change-detection loops — a signal write schedules CD, and if a CD run writes
// the same signal again, you loop forever (Angular caps it at ERROR).
//
// Most common shape: an effect that writes a signal it also reads indirectly.

effect(() => {
  const v = this.source();
  this.derived.set(v + 1);            // writing a signal schedules another CD
});                                   // → the effect re-fires → infinite loop

// Fix: derive, don't effect.
readonly derived = computed(() => this.source() + 1);   // no write, no loop
// Or, if you genuinely need a writable derived value, use linkedSignal.`,
  leakedSubs: `// Leaked subscriptions/effects — the slow, silent bug. A subscription that
// outlives its component keeps running, holding references and writing to
// destroyed state. Two modern cures:

// 1) takeUntilDestroyed — ties an RxJS subscription to the component's
//    injection context. The subscription auto-unsubscribes on destroy.
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

source$.pipe(takeUntilDestroyed()).subscribe();   // auto-cleaned

// 2) effects declared in an injection context (constructor, field initializer,
//    or runInInjectionContext) are auto-cleaned on component destroy — no
//    manual ngOnDestroy. An effect created OUTSIDE an injection context throws
//    unless you pass { manualCleanup: true }, which is the escape hatch for
//    long-lived global effects.

// Anti-pattern: a raw .subscribe() in a service with no teardown — it lives
// for the page lifetime and silently leaks.`,
};

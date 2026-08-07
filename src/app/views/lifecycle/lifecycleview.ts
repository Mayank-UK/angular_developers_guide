import {
  afterNextRender,
  afterEveryRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injectable,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  DoCheck,
  AfterContentInit,
  AfterContentChecked,
  AfterViewInit,
  AfterViewChecked,
  signal,
  SimpleChanges,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

/**
 * LifecycleView — every Angular lifecycle hook, and the modern Signals
 * lifecycle, each explained and shown live.
 *
 * Mental model: a directive/component is CREATED, checked zero or more times
 * during CHANGE-DETECTION ROUNDS, and DESTROYED. Each round has two phases —
 * CONTENT (the projected `<ng-content>`) checked before VIEW (the component's
 * own template) — and Angular calls a pair of `Init`/`Checked` hooks around
 * each phase. The classic eight hooks (`ngOnChanges`, `ngOnInit`, `ngDoCheck`,
 * `ngAfterContentInit`, `ngAfterContentChecked`, `ngAfterViewInit`,
 * `ngAfterViewChecked`, `ngOnDestroy`) hang off those moments.
 *
 * The Signals lifecycle is separate and leaner: `signal`/`computed` declare
 * reactive state, `effect` runs a side-effect when its signal dependencies
 * change, and `afterRender`/`afterNextRender`/`afterRenderEffect` run after the
 * DOM has been painted. These compose with the classic hooks but rarely need
 * them — an `effect` with `DestroyRef` cleanup replaces most `ngOnInit` +
 * `ngOnDestroy` pairs.
 *
 * The centerpiece is a live parent + child demo that logs EVERY hook fire to an
 * on-screen log (with an authoritative order counter and timestamp) so you can
 * SEE the order by interacting — mount the child, bump an `@Input()`, change
 * the projected content, unmount — and watch `ngOnChanges` → `ngDoCheck` →
 * after-content → after-view fire in sequence, with the parent's view hooks
 * waiting until AFTER the child is fully constructed.
 *
 * NOTE: the demo child/parent components deliberately implement the classic
 * hook interfaces (OnChanges, OnInit, DoCheck, the After-prefixed hooks, and
 * whole point of the screen. They keep `@Input()` (the decorator) for the
 * `ngOnChanges` demo, because SIGNAL INPUTS DO NOT TRIGGER `ngOnChanges` —
 * that distinction is a key teaching point below. The rest of the app is
 * OnPush + signals throughout.
 *
 * NOTE: the exported `LifecycleView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The classic eight lifecycle hooks, in firing order. `const`-object + literal
 * union — never `enum` (this project targets erasable-only TypeScript).
 */
const HOOK_PHASE = {
  onChanges: 'ngOnChanges',
  onInit: 'ngOnInit',
  doCheck: 'ngDoCheck',
  afterContentInit: 'ngAfterContentInit',
  afterContentChecked: 'ngAfterContentChecked',
  afterViewInit: 'ngAfterViewInit',
  afterViewChecked: 'ngAfterViewChecked',
  onDestroy: 'ngOnDestroy',
} as const;
type HookName = (typeof HOOK_PHASE)[keyof typeof HOOK_PHASE];

/** Which component instance a log entry came from. */
const COMPONENT_ROLE = {
  parent: 'PARENT',
  child: 'CHILD',
} as const;
type ComponentRole = (typeof COMPONENT_ROLE)[keyof typeof COMPONENT_ROLE];

interface LogEntry {
  /** Monotonic order counter — authoritative firing order across the tree. */
  readonly order: number;
  readonly component: ComponentRole;
  readonly hook: HookName;
  /** `performance.now()` at fire time, so fast successive fires are distinct. */
  readonly timestamp: number;
}

/** The per-hook reference row: when it fires, when to use it, the pitfalls. */
interface HookReference {
  readonly hook: HookName;
  readonly fires: string;
  readonly useFor: string;
  readonly pitfalls: string;
}

const HOOK_REFERENCE: readonly HookReference[] = [
  {
    hook: HOOK_PHASE.onChanges,
    fires:
      'First, and whenever a decorated @Input() reference changes (not on signal inputs). Carries a SimpleChanges map with firstValue/currentValue/previousValue.',
    useFor:
      'Reacting to input CHANGES — copy/clamp a value, reset derived state, skip the first pass when you also have ngOnInit.',
    pitfalls:
      'Signal inputs do NOT fire it. Called BEFORE ngOnInit on the first pass. Mutating an input object in place does NOT fire it (reference must change). Cheap only if you guard early.',
  },
  {
    hook: HOOK_PHASE.onInit,
    fires: 'Once, after the first ngOnChanges. The component is constructed and its inputs are settled.',
    useFor:
      'One-time setup that needs inputs: kick off an HTTP fetch, initialise non-signal state, subscribe (with cleanup).',
    pitfalls:
      'Runs once — never again for input changes (use ngOnChanges). Reading template @ViewChild refs here is wrong — the view does not exist yet; use ngAfterViewInit. Prefer the constructor + signals for setup that does not need inputs.',
  },
  {
    hook: HOOK_PHASE.doCheck,
    fires:
      'Every change-detection round, after ngOnChanges and before the after-content hooks — on the PARENT first, then children.',
    useFor:
      'Custom change detection of mutable state Angular cannot see (a pushed array, a deep object diff). Pair with a diff check and markForCheck.',
    pitfalls:
      'Fires VERY often — any work here multiplies across the tree. Never do heavy work or HTTP here. It does NOT replace ngOnChanges; the two run together.',
  },
  {
    hook: HOOK_PHASE.afterContentInit,
    fires: 'Once, after projected (<ng-content>) content is initialised but before the component view.',
    useFor:
      '@ContentChild queries that need projected content ready, or initialising something that depends on what was projected in.',
    pitfalls:
      'Runs once. Do not confuse with AfterViewInit — content is the INWARD stuff (projected by the parent), view is the OWN template. Parent AfterContent fires before its children exist.',
  },
  {
    hook: HOOK_PHASE.afterContentChecked,
    fires: 'Every change-detection round, after the content is checked (after AfterContentInit on the first pass).',
    useFor: 'Rare. Mirrors ngDoCheck timing but scoped to content projection.',
    pitfalls:
      'Fires on every check — the #1 place people cause "ExpressionChangedAfterChecked" errors by writing state during it. Keep it pure.',
  },
  {
    hook: HOOK_PHASE.afterViewInit,
    fires: 'Once, after the component OWN template view is fully rendered. For a parent this is AFTER its children are fully constructed.',
    useFor:
      '@ViewChild / @ViewChildren queries, measuring DOM sizes (offsetWidth), third-party widgets that need the element present.',
    pitfalls:
      'Reads to template-bound state during this hook can throw ExpressionChangedAfterChecked. Do not mutate view state here — use markForCheck if you must.',
  },
  {
    hook: HOOK_PHASE.afterViewChecked,
    fires: 'Every change-detection round, after the view (and its children) are checked.',
    useFor: 'Very rare. DOM measurement each CD round, or debugging change detection.',
    pitfalls:
      'Fires constantly. Writing signals/state here will loop change detection. Treat as read-only.',
  },
  {
    hook: HOOK_PHASE.onDestroy,
    fires: 'Once, right before Angular tears down the directive/component. Cleanup time.',
    useFor:
      'Tear down subscriptions, timers, listeners, WebSocket connections, observers started in ngOnInit/onInit.',
    pitfalls:
      'Not guaranteed in every edge case (app tear-down). Prefer DestroyRef.onDestroy or takeUntilDestroyed for testable, injection-context-safe cleanup that does not depend on the interface.',
  },
];

/* -------------------------------------------------------------------------- */
/* LifecycleLogService — shared between the parent + child demo so both       */
/* append to one ordered log. Provided at the demo wrapper (LifecycleOrderDemo)*/
/* so the service is scoped to that subtree.                                   */
/* -------------------------------------------------------------------------- */

@Injectable()
class LifecycleLogService {
  private readonly _entries = signal<readonly LogEntry[]>([]);
  readonly entries = this._entries.asReadonly();

  private order = 0;
  private origin = 0;

  /** Append a hook fire. The monotonic `order` is the authoritative sequence. */
  log(component: ComponentRole, hook: HookName): void {
    if (this.origin === 0) this.origin = performance.now();
    const order = ++this.order;
    this._entries.update((list) =>
      [
        { order, component, hook, timestamp: performance.now() - this.origin },
        ...list,
      ].slice(0, 60),
    );
  }

  /** Clear the log and reset the order counter (also called on remount). */
  reset(): void {
    this._entries.set([]);
    this.order = 0;
    this.origin = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* 1. LifecycleChildDemo — implements ALL eight classic hooks so the log       */
/*    shows them firing. Uses classic @Input() (not signal input) so that      */
/*    ngOnChanges fires — the central teaching point.                          */
/* -------------------------------------------------------------------------- */

/**
 * LifecycleChildDemo — the CHILD half of the lifecycle-order demo. It
 * implements every classic hook so you can watch the full sequence. It uses
 * `@Input()` (the decorator) on purpose: a SIGNAL input would NOT trigger
 * `ngOnChanges`, so the demo would silently drop the first hook.
 */
@Component({
  selector: 'app-lifecycle-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="node child">
      <span class="tag">CHILD</span>
      <span class="value">@Input() value = {{ value }}</span>
      <div class="projected"><ng-content /></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .node {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .child {
        border-left: 3px solid var(--color-secondary);
      }
      .tag {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        color: var(--color-secondary);
      }
      .value {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .projected {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-style: italic;
      }
    `,
  ],
})
class LifecycleChildDemo
  implements
    OnChanges,
    OnInit,
    DoCheck,
    AfterContentInit,
    AfterContentChecked,
    AfterViewInit,
    AfterViewChecked,
    OnDestroy
{
  /** Classic @Input() — a signal input would NOT trigger ngOnChanges. */
  @Input() value = 0;

  private readonly log = inject(LifecycleLogService);

  ngOnChanges(_changes: SimpleChanges): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.onChanges);
  }
  ngOnInit(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.onInit);
  }
  ngDoCheck(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.doCheck);
  }
  ngAfterContentInit(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.afterContentInit);
  }
  ngAfterContentChecked(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.afterContentChecked);
  }
  ngAfterViewInit(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.afterViewInit);
  }
  ngAfterViewChecked(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.afterViewChecked);
  }
  ngOnDestroy(): void {
    this.log.log(COMPONENT_ROLE.child, HOOK_PHASE.onDestroy);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. LifecycleParentDemo — the PARENT half. Contains the child, projects     */
/*    content into it, and implements the same hooks so the log shows the      */
/*    parent+child INTERLEAVING: parent's after-content hooks fire BEFORE the   */
/*    child exists, but the parent's after-VIEW hooks wait until the child is  */
/*    fully constructed.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * LifecycleParentDemo — the PARENT half of the demo. It implements the eight
 * hooks and renders the child (projecting content into it). The interleaving
 * is the lesson: parent ngOnChanges → ngOnInit → ngDoCheck →
 * ngAfterContentInit → ngAfterContentChecked, THEN the entire CHILD sequence,
 * THEN parent ngAfterViewInit → ngAfterViewChecked. The parent's VIEW hooks
 * necessarily wait — a view cannot be "complete" until every child in it is.
 */
@Component({
  selector: 'app-lifecycle-parent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LifecycleChildDemo],
  template: `
    <div class="node parent">
      <span class="tag">PARENT</span>
      <span class="value">passes value = {{ value }} down</span>
    </div>
    <div class="tree">
      <app-lifecycle-child [value]="value">
        projected by parent #{{ projectedKey }}
      </app-lifecycle-child>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .node {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .parent {
        border-left: 3px solid var(--color-primary);
      }
      .tag {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        color: var(--color-primary);
      }
      .value {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .tree {
        padding-left: var(--space-md);
        border-left: 1px dashed var(--color-outline);
        margin-left: var(--space-xs);
      }
    `,
  ],
})
class LifecycleParentDemo
  implements
    OnChanges,
    OnInit,
    DoCheck,
    AfterContentInit,
    AfterContentChecked,
    AfterViewInit,
    AfterViewChecked,
    OnDestroy
{
  /** The parent receives the same value it forwards, so ngOnChanges fires here too. */
  @Input() value = 0;
  /** Bumped from the outer demo to change the projected content — re-fires after-content hooks. */
  @Input() projectedKey = 0;

  private readonly log = inject(LifecycleLogService);

  ngOnChanges(_changes: SimpleChanges): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.onChanges);
  }
  ngOnInit(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.onInit);
  }
  ngDoCheck(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.doCheck);
  }
  ngAfterContentInit(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.afterContentInit);
  }
  ngAfterContentChecked(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.afterContentChecked);
  }
  ngAfterViewInit(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.afterViewInit);
  }
  ngAfterViewChecked(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.afterViewChecked);
  }
  ngOnDestroy(): void {
    this.log.log(COMPONENT_ROLE.parent, HOOK_PHASE.onDestroy);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. LifecycleOrderDemo — the CENTERPIECE. Controls + the parent/child tree    */
/*    + the live ordered log. Provides LifecycleLogService to its subtree.     */
/* -------------------------------------------------------------------------- */

/**
 * LifecycleOrderDemo — the live, rendered lifecycle-order demo. Mount and
 * unmount the parent (and the child inside it), bump the `@Input()` value, and
 * change the projected content; every hook fire appends to the ordered log
 * below. The `order` counter is the authoritative firing sequence across the
 * whole tree — `performance.now()` only disambiguates fast successive fires.
 *
 * Watch for the key interleaving on mount: PARENT OnChanges → OnInit → DoCheck
 * → AfterContentInit → AfterContentChecked, then the entire CHILD sequence
 * (OnChanges … AfterViewChecked), then PARENT AfterViewInit → AfterViewChecked.
 * The parent's VIEW hooks come last because a parent's view is not complete
 * until its children are.
 */
@Component({
  selector: 'app-lifecycle-order-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LifecycleParentDemo],
  providers: [LifecycleLogService],
  template: `
    <div class="controls">
      <button
        type="button"
        class="btn primary"
        (click)="mount()"
        [disabled]="mounted()"
      >
        mount parent + child
      </button>
      <button
        type="button"
        class="btn"
        (click)="unmount()"
        [disabled]="!mounted()"
      >
        unmount (→ ngOnDestroy)
      </button>
      <button
        type="button"
        class="btn"
        (click)="bumpInput()"
        [disabled]="!mounted()"
      >
        bump @Input ({{ value() }})
      </button>
      <button
        type="button"
        class="btn"
        (click)="bumpProjected()"
        [disabled]="!mounted()"
      >
        change projected content
      </button>
      <button type="button" class="btn ghost" (click)="clear()">clear log</button>
    </div>

    <div class="stage">
      @if (mounted()) {
        <app-lifecycle-parent [value]="value()" [projectedKey]="projectedKey()" />
      } @else {
        <p class="empty">nothing mounted — click "mount parent + child".</p>
      }
    </div>

    <div class="legend">
      <span class="dot parent"></span>
      <code>PARENT</code>
      <span class="dot child"></span>
      <code>CHILD</code>
      <span class="hint">
        — order is the authoritative firing sequence; <code>ms</code> is
        time since first fire.
      </span>
    </div>

    <div class="log">
      <div class="log-head">
        <span>order</span>
        <span>component</span>
        <span>hook</span>
        <span>+ms</span>
      </div>
      <div class="log-body">
        @for (e of entries(); track e.order) {
          <div class="row" [class.parent]="e.component === 'PARENT'">
            <span class="order">#{{ e.order }}</span>
            <span class="comp">{{ e.component }}</span>
            <span class="hook">{{ e.hook }}</span>
            <span class="ts">{{ e.timestamp.toFixed(1) }}</span>
          </div>
        } @empty {
          <div class="empty-row">— waiting for a hook to fire —</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        font-family: var(--font-mono);
        cursor: pointer;
        transition: background-color 120ms ease, border-color 120ms ease;
      }
      .btn:hover:not(:disabled) {
        background-color: var(--color-surface-variant);
      }
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .btn.ghost {
        color: var(--color-on-surface-variant);
      }
      .btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .stage {
        padding: var(--space-md);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        min-height: 80px;
      }
      .empty {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-style: italic;
      }
      .legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .legend code {
        font-family: var(--font-mono);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        display: inline-block;
      }
      .dot.parent {
        background: var(--color-primary);
      }
      .dot.child {
        background: var(--color-secondary);
      }
      .hint {
        margin-left: var(--space-xs);
      }
      .log {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        overflow: hidden;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        max-height: 340px;
        display: flex;
        flex-direction: column;
      }
      .log-head {
        display: grid;
        grid-template-columns: 56px 84px 1fr 64px;
        gap: var(--space-xs);
        padding: var(--space-xxs) var(--space-sm);
        background-color: var(--color-surface-variant);
        color: var(--color-on-surface-variant);
        text-transform: uppercase;
        letter-spacing: 0.06em;
        font-size: var(--text-overline);
      }
      .log-body {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .row {
        display: grid;
        grid-template-columns: 56px 84px 1fr 64px;
        gap: var(--space-xs);
        padding: var(--space-xxs) var(--space-sm);
        border-top: 1px solid var(--color-outline);
        color: var(--color-on-surface);
        align-items: center;
      }
      .row.parent {
        background-color: var(--color-surface-tint);
      }
      .order {
        color: var(--color-on-surface-variant);
      }
      .comp {
        color: var(--color-secondary);
        font-weight: 600;
      }
      .row.parent .comp {
        color: var(--color-primary);
      }
      .hook {
        color: var(--color-on-surface);
      }
      .ts {
        color: var(--color-on-surface-variant);
        text-align: right;
      }
      .empty-row {
        padding: var(--space-sm);
        color: var(--color-on-surface-variant);
        font-style: italic;
        text-align: center;
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class LifecycleOrderDemo {
  private readonly log = inject(LifecycleLogService);

  /** Entries for the template (Angular strict templates can't read privates). */
  readonly entries = this.log.entries;

  readonly mounted = signal(false);
  readonly value = signal(1);
  readonly projectedKey = signal(0);

  mount(): void {
    this.log.reset();
    this.mounted.set(true);
  }

  unmount(): void {
    this.mounted.set(false);
  }

  bumpInput(): void {
    this.value.update((v) => v + 1);
  }

  bumpProjected(): void {
    this.projectedKey.update((k) => k + 1);
  }

  clear(): void {
    this.log.reset();
  }
}

/* -------------------------------------------------------------------------- */
/* 4. SignalsLifecycleDemo — effect / computed / afterRender / afterNextRender  */
/*    / afterRenderEffect, each logging to a visible log. Demonstrates the      */
/*    modern Signals lifecycle and DestroyRef-based cleanup.                    */
/* -------------------------------------------------------------------------- */

/**
 * SignalsLifecycleDemo — the modern Signals lifecycle, live. A `signal` holds
 * the count; a `computed` derives its double; an `effect` logs every time the
 * count changes; `afterNextRender` logs once after the first paint;
 * `afterRender` logs after every paint while mounted; `afterRenderEffect`
 * scopes render callbacks to this component's lifecycle (auto-cleanup). Bump
 * the count and watch the effect fire during change detection, then the render
 * callbacks after the DOM is painted.
 */
@Component({
  selector: 'app-signals-lifecycle-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <button
        type="button"
        class="btn primary"
        (click)="bump()"
      >
        bump count ({{ count() }})
      </button>
      <button type="button" class="btn" (click)="toggle()">reset to 0</button>
      <button type="button" class="btn ghost" (click)="clearLog()">clear log</button>
    </div>

    <div class="readout">
      <div class="cell">
        <span class="lbl">signal</span>
        <strong class="val">count = {{ count() }}</strong>
      </div>
      <div class="cell">
        <span class="lbl">computed</span>
        <strong class="val">double = {{ double() }}</strong>
      </div>
    </div>

    <div class="legend">
      Watch the order: the <code>effect</code> fires during change detection
      (right after the signal write), then <code>afterRender</code> /
      <code>afterNextRender</code> fire after the DOM is painted.
    </div>

    <div class="log">
      <div class="log-body">
        @for (e of entries(); track e.order) {
          <div class="row">
            <span class="order">#{{ e.order }}</span>
            <span class="kind" [class]="'k-' + e.kind">{{ e.kind }}</span>
            <span class="msg">{{ e.message }}</span>
          </div>
        } @empty {
          <div class="empty-row">— bump the count to fire the signals —</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        font-family: var(--font-mono);
        cursor: pointer;
      }
      .btn:hover:not(:disabled) {
        background-color: var(--color-surface-variant);
      }
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
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
        gap: var(--space-xxs);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .lbl {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .val {
        font-family: var(--font-mono);
        font-size: var(--text-title-sm);
        color: var(--color-primary);
      }
      .legend {
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .legend code {
        font-family: var(--font-mono);
      }
      .log {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        overflow: hidden;
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        max-height: 300px;
        display: flex;
        flex-direction: column;
      }
      .log-body {
        overflow-y: auto;
        display: flex;
        flex-direction: column;
      }
      .row {
        display: grid;
        grid-template-columns: 48px 132px 1fr;
        gap: var(--space-xs);
        padding: var(--space-xxs) var(--space-sm);
        border-top: 1px solid var(--color-outline);
        color: var(--color-on-surface);
        align-items: center;
      }
      .order {
        color: var(--color-on-surface-variant);
      }
      .kind {
        font-weight: 600;
      }
      .k-effect {
        color: var(--color-primary);
      }
      .k-computed {
        color: var(--color-secondary);
      }
      .k-afterNextRender,
      .k-afterRender,
      .k-afterRenderEffect {
        color: var(--color-tertiary, var(--color-secondary));
      }
      .msg {
        color: var(--color-on-surface-variant);
      }
      .empty-row {
        padding: var(--space-sm);
        color: var(--color-on-surface-variant);
        font-style: italic;
        text-align: center;
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class SignalsLifecycleDemo {
  /** signal — the reactive primitive. */
  readonly count = signal(0);

  /** computed — derived, lazy, memoised. Recomputes when count changes. */
  readonly double = computed(() => this.count() * 2);

  private readonly _entries = signal<readonly SignalLogEntry[]>([]);
  readonly entries = this._entries.asReadonly();
  private order = 0;

  constructor() {
    // effect — runs a side-effect whenever its signal deps change. First run
    // is scheduled at the end of change detection. Reads count() so it tracks.
    effect(() => {
      const c = this.count();
      this.push('effect', `ran — count is ${c}`);
    });

    // afterNextRender — runs ONCE after the next render (browser only, after
    // the DOM is painted). Use for one-time browser-only DOM work.
    afterNextRender(() => {
      this.push('afterNextRender', 'ran once after first paint');
    });

    // afterEveryRender — runs after EVERY render while the component is mounted.
    // Use for read-only DOM measurement each frame. Keep it pure.
    afterEveryRender(() => {
      this.push('afterEveryRender', 'ran after a render');
    });

    // afterRenderEffect — the recommended injection-context-scoped way to
    // register afterRender/afterNextRender callbacks. It ties the callbacks to
    // this component's lifecycle (auto-cleanup on destroy) AND re-runs the
    // registration in an effect so it can read signals. This is preferred over
    // bare afterRender when the callback depends on reactive state.
    afterRenderEffect(() => {
      // This body runs as an effect; reading count() re-registers on change.
      const c = this.count();
      afterNextRender(() => {
        this.push(
          'afterRenderEffect',
          `scoped post-paint callback ran (count was ${c})`,
        );
      });
    });
  }

  bump(): void {
    this.count.update((c) => c + 1);
  }

  toggle(): void {
    this.count.set(0);
  }

  clearLog(): void {
    this._entries.set([]);
    this.order = 0;
  }

  private push(
    kind: 'effect' | 'computed' | 'afterNextRender' | 'afterEveryRender' | 'afterRenderEffect',
    message: string,
  ): void {
    const order = ++this.order;
    this._entries.update((list) =>
      [{ order, kind, message }, ...list].slice(0, 40),
    );
  }
}

interface SignalLogEntry {
  readonly order: number;
  readonly kind: 'effect' | 'computed' | 'afterNextRender' | 'afterEveryRender' | 'afterRenderEffect';
  readonly message: string;
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-lifecycle-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    LifecycleOrderDemo,
    SignalsLifecycleDemo,
  ],
  templateUrl: './lifecycle_view.html',
  styleUrl: './lifecycle_view.scss',
})
export class LifecycleView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;

  /** Per-hook reference rows rendered in the cheat-sheet table. */
  readonly hookReference = HOOK_REFERENCE;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  order: `// Firing order for ONE change-detection round on a component:
//   (creation round)        (every check)
//   1. ngOnChanges    ──┐    1. ngOnChanges   (only if an @Input() ref changed)
//   2. ngOnInit      ─   │    2. ngDoCheck
//   3. ngDoCheck    ─   ─┘    3. ngAfterContentChecked
//   4. ngAfterContentInit     4. ngAfterViewChecked
//   5. ngAfterContentChecked
//   6. ngAfterViewInit        (creation round only fires OnInit / *Init once)
//   7. ngAfterViewChecked
//
// For a PARENT + CHILD tree, the parent runs 1–5, then the ENTIRE child
// sequence 1–7, then the parent's 6–7. The parent's view hooks wait until
// every child is fully constructed — a view is not "done" until its children are.
//
// OnDestroy fires once, right before teardown, in top-down order (parent first).`,
  classicChild: `import {
  AfterContentChecked, AfterContentInit, AfterViewChecked, AfterViewInit,
  DoCheck, Input, OnChanges, OnDestroy, OnInit, SimpleChanges,
} from '@angular/core';

// NOTE: a class implementing every hook is rare in production code — most
// components need one or two. This is the full surface for teaching.
@Component({ selector: 'app-child', changeDetection: ChangeDetectionStrategy.OnPush })
class Child implements OnChanges, OnInit, DoCheck,
  AfterContentInit, AfterContentChecked, AfterViewInit, AfterViewChecked, OnDestroy {

  // Classic @Input() — ngOnChanges FIRES when this reference changes.
  @Input() value = 0;

  ngOnChanges(changes: SimpleChanges) {
    // changes['value'].firstValue / previousValue / currentValue
    // NOT called for signal inputs.
  }
  ngOnInit()  { /* one-time setup that needs inputs */ }
  ngDoCheck() { /* custom dirty-check; fires every CD round */ }
  ngAfterContentInit()    { /* projected <ng-content> ready (once) */ }
  ngAfterContentChecked() { /* projected content checked (every round) */ }
  ngAfterViewInit()       { /* own template + @ViewChild ready (once) */ }
  ngAfterViewChecked()    { /* own view checked (every round) */ }
  ngOnDestroy()           { /* tear down: subscriptions, timers, listeners */ }
}`,
  signalInput: `import { Component, input } from '@angular/core';

// Signal inputs are the modern default — but they do NOT trigger ngOnChanges.
// Read them as functions in the template and in computed/effect.
@Component({ selector: 'app-tile', changeDetection: ChangeDetectionStrategy.OnPush })
class Tile {
  readonly value = input(0);          // signal input
  // ngOnChanges would NEVER fire here, even as value changes.
  // To react to changes, use a computed or an effect instead:
  //   readonly doubled = computed(() => this.value() * 2);
}`,
  modernDestroy: `import { DestroyRef, inject, Injectable, OnDestroy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription, timer } from 'rxjs';

// Modern preference: DestroyRef.onDestroy (or takeUntilDestroyed for RxJS)
// instead of the OnDestroy interface. It works in ANY injection context —
// services, @Injectable(), directives, even outside a component.
@Injectable()
class SessionService {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // 1. Plain subscription cleaned up via DestroyRef:
    const sub = timer(0, 1000).subscribe(() => this.tick());
    this.destroyRef.onDestroy(() => sub.unsubscribe());

    // 2. RxJS pipe — takeUntilDestroyed reads DestroyRef from context:
    timer(0, 1000).pipe(takeUntilDestroyed()).subscribe(() => this.tick());
  }
  private tick() {}
}

// The interface still works and is fine — but prefer DestroyRef for new code,
// especially in inject()-style services that have no lifecycle decorator.`,
  effectSnippet: `import { Component, effect, signal, computed } from '@angular/core';

// effect runs a side-effect when its signal deps change. First run is
// scheduled at the end of the current change-detection turn.
@Component({ selector: 'app-log', changeDetection: ChangeDetectionStrategy.OnPush })
class LogDemo {
  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);

  constructor() {
    effect(() => {
      // reads count() → this effect tracks it and re-runs on change
      console.log('count is', this.count());
    });
  }
}`,
  afterRenderSnippet: `import {
  afterNextRender, afterRender, afterRenderEffect,
  Component, ElementRef, inject,
} from '@angular/core';

// afterNextRender — runs ONCE after the next render (browser only).
// afterRender — runs after EVERY render while mounted.
// afterRenderEffect — the injection-context-safe way: ties render callbacks
//   to this component's lifecycle (auto-cleanup) and re-registers in an effect.
@Component({ selector: 'app-measure', changeDetection: ChangeDetectionStrategy.OnPush })
class MeasureDemo {
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    afterNextRender(() => {
      // one-time browser-only DOM setup: measure, attach a chart, etc.
      const el = this.host.nativeElement.querySelector('.box');
      console.log('width on first paint:', el?.clientWidth);
    });

    afterRender(() => {
      // after every render — keep it pure (read-only measurement).
    });

    afterRenderEffect(() => {
      // scoped + auto-cleaned; reads signals to re-register reactively.
      // afterNextRender/afterRender callbacks declared here are torn down
      // automatically when this component is destroyed.
    });
  }
}`,
  pitfallExpressionChanged: `// CLASSIC PITFALL: "ExpressionChangedAfterItHasBeenChecked"
// Writing state that the template ALREADY read, during a check-time hook,
// makes Angular throw in dev mode. The fix is to write during an
// EVENT handler or use markForCheck — never inside an after-*Checked hook.

@Component({ selector: 'app-bad', template: '<p>{{ title }}</p>' })
class Bad implements AfterViewChecked {
  title = 'hello';
  ngAfterViewChecked() {
    // THROWS in dev: the view was already checked with title = 'hello'.
    this.title = 'goodbye';
  }
}`,
};

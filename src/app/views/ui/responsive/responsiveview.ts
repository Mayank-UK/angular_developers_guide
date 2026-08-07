import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';
import { createMediaQuerySignal } from './media-query';

/**
 * ResponsiveView — how responsive layout is done in Angular, the standard way.
 *
 * Two layers compose:
 *   1. **CSS does what CSS can.** Mobile-first media queries, the
 *      `repeat(auto-fit, minmax(...))` grid, `clamp()` fluid typography,
 *      viewport units, and container queries adapt the layout with zero
 *      TypeScript. This is always the first choice — it's cheaper, survives
 *      hydration, and works without Angular at all.
 *   2. **Angular reacts when CSS can't.** A `matchMedia`-backed signal bridges
 *      the viewport into reactive state so the TS can branch (choose a data
 *      source, mount a heavy component, swap behaviour) and the template can
 *      conditionally render with `@if`/`@switch`. The signal is the seam.
 *
 * Live, rendered demos (each paired with the code that produces it):
 *   - Live viewport-breakpoint readout driven by matchMedia signals
 *   - `@if` conditional rendering off the same signal (mobile vs desktop nav)
 *   - The `auto-fit` / `minmax` grid that reflows (drag the container width)
 *   - A container-query card that re-lays-out with its CONTAINER, not viewport
 *   - `clamp()` fluid typography scaling with the viewport
 *   - Viewport units (`vw`/`vh`/`dvh`) and the mobile-chrome story
 *
 * The shared design-system primitives (`SectionWrapper`, `ContentGroupWrapper`,
 * `TextBlock`, `CodeBlock`, `Example`) are used throughout. Single-use helpers
 * live in this file; all components are standalone + OnPush and use signals +
 * const-object literal unions (never enums).
 *
 * NOTE: the exported `ResponsiveView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Mobile-first breakpoint ladder (mirrors Bootstrap's thresholds, which mirror
 * most design systems). `min` is the lower bound in px; `query` is the
 * `min-width:` media query that turns the breakpoint on.
 */
const BREAKPOINTS = {
  xs: { label: 'xs', min: 0, query: '(max-width: 575.98px)' },
  sm: { label: 'sm', min: 576, query: '(min-width: 576px)' },
  md: { label: 'md', min: 768, query: '(min-width: 768px)' },
  lg: { label: 'lg', min: 992, query: '(min-width: 992px)' },
  xl: { label: 'xl', min: 1200, query: '(min-width: 1200px)' },
  xxl: { label: 'xxl', min: 1400, query: '(min-width: 1400px)' },
} as const;
type BreakpointKey = keyof typeof BREAKPOINTS;

const BREAKPOINT_ORDER: readonly BreakpointKey[] = [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'xxl',
];

/* -------------------------------------------------------------------------- */
/* 1. Live breakpoint readout — matchMedia signals → computed current bp      */
/* -------------------------------------------------------------------------- */

/**
 * BreakpointReadoutDemo — a live viewport readout driven by `matchMedia`. One
 * signal per `min-width:` threshold; a `computed` picks the largest that
 * currently matches. Resize the browser window and the active chip plus the
 * boolean ladder update in real time. This is the seam between CSS media
 * queries and Angular reactive state.
 */
@Component({
  selector: 'app-breakpoint-readout-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="caption">
      Resize the browser window. The active breakpoint is a
      <code>computed</code> over six <code>matchMedia</code> signals — no
      <code>resize</code> listener and no zone.
    </p>

    <div class="ladder">
      @for (key of breakpointOrder; track key) {
        <div class="rung" [class.active]="currentBreakpoint() === key">
          <span class="name">{{ breakpoints[key].label }}</span>
          <span class="min">≥ {{ breakpoints[key].min }}px</span>
          @if (key !== 'xs') {
            <span class="match" [class.on]="matchSignals[key]()">
              {{ matchSignals[key]() ? 'on' : 'off' }}
            </span>
          }
        </div>
      }
    </div>

    <div class="readout">
      <span class="tag">current breakpoint</span>
      <strong class="value">{{ currentBreakpoint() }}</strong>
      <span class="meta">
        matched by <code>{{ breakpoints[currentBreakpoint()].query }}</code>
      </span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .ladder {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--space-xs);
      }
      .rung {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        transition: border-color 120ms ease, background-color 120ms ease;
      }
      .rung.active {
        border-color: var(--color-primary);
        background-color: var(--color-surface-tint);
      }
      .name {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .min {
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        color: var(--color-on-surface-variant);
      }
      .match {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        color: var(--color-on-surface-variant);
      }
      .match.on {
        color: var(--color-secondary);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .value {
        font-family: var(--font-display);
        font-size: var(--text-title);
        color: var(--color-primary);
      }
      .meta {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class BreakpointReadoutDemo {
  readonly breakpoints = BREAKPOINTS;
  readonly breakpointOrder = BREAKPOINT_ORDER;

  /** One matchMedia signal per min-width threshold. */
  readonly matchSignals = {
    sm: createMediaQuerySignal(BREAKPOINTS.sm.query),
    md: createMediaQuerySignal(BREAKPOINTS.md.query),
    lg: createMediaQuerySignal(BREAKPOINTS.lg.query),
    xl: createMediaQuerySignal(BREAKPOINTS.xl.query),
    xxl: createMediaQuerySignal(BREAKPOINTS.xxl.query),
  } as const;

  /** The current breakpoint = the largest min-width that currently matches. */
  readonly currentBreakpoint = computed<BreakpointKey>(() => {
    const s = this.matchSignals;
    if (s.xxl()) return 'xxl';
    if (s.xl()) return 'xl';
    if (s.lg()) return 'lg';
    if (s.md()) return 'md';
    if (s.sm()) return 'sm';
    return 'xs';
  });
}

/* -------------------------------------------------------------------------- */
/* 2. Conditional rendering — @if off a matchMedia signal                     */
/* -------------------------------------------------------------------------- */

/**
 * ConditionalRenderDemo — Angular's TS-driven responsive branch. CSS media
 * queries can swap styles, but they cannot choose which components mount or
 * which data path runs. For that, read the `matchMedia` signal in the template
 * with `@if`: here a compact stacked menu renders at mobile widths and a full
 * inline bar renders otherwise. The signal write is the change-detection
 * trigger, so the swap is instant and OnPush-safe.
 *
 * NOTE: the demo also accepts a manual override so you can SEE both states
 * without resizing the browser — the toggle forces the signal for teaching.
 * In real code you would read the signal alone.
 */
@Component({
  selector: 'app-conditional-render-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <button
        type="button"
        class="chip"
        (click)="override.set(null)"
        [class.selected]="override() === null"
      >
        live ({{ liveIsMobile() ? 'mobile' : 'desktop' }})
      </button>
      <button
        type="button"
        class="chip"
        (click)="override.set(true)"
        [class.selected]="override() === true"
      >
        force mobile
      </button>
      <button
        type="button"
        class="chip"
        (click)="override.set(false)"
        [class.selected]="override() === false"
      >
        force desktop
      </button>
    </div>

    <div class="frame">
      @if (isMobile()) {
        <!-- Mobile: stacked menu behind a hamburger toggle. -->
        <div class="bar mobile">
          <span class="brand">◆ Acme</span>
          <button
            type="button"
            class="burger"
            (click)="menuOpen.set(!menuOpen())"
            [attr.aria-expanded]="menuOpen()"
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
        @if (menuOpen()) {
          <nav class="drawer">
            @for (item of nav; track item) {
              <a class="link" href="javascript:void(0)">{{ item }}</a>
            }
          </nav>
        } @else {
          <p class="hint">tap ☰ to open the menu</p>
        }
      } @else {
        <!-- Desktop: full inline bar. -->
        <nav class="bar desktop">
          <span class="brand">◆ Acme</span>
          <div class="links">
            @for (item of nav; track item) {
              <a class="link" href="javascript:void(0)">{{ item }}</a>
            }
          </div>
        </nav>
        <p class="hint">desktop bar — full inline navigation</p>
      }
    </div>

    <p class="caption">
      The branch lives in TypeScript, so it can choose components, data, or
      behaviour — not just styles. Resize the window (or use the chips) to see
      the swap.
    </p>
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
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        font-family: var(--font-mono);
        cursor: pointer;
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.selected {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .frame {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .bar {
        display: flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .bar.mobile {
        justify-content: space-between;
      }
      .bar.desktop {
        flex-wrap: wrap;
      }
      .brand {
        font-family: var(--font-display);
        font-weight: 600;
        color: var(--color-primary);
      }
      .burger {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background: var(--color-surface);
        color: var(--color-on-surface);
        padding: var(--space-xxs) var(--space-sm);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .links {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
      }
      .drawer {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .link {
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
        text-decoration: none;
      }
      .link:hover {
        color: var(--color-primary);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ConditionalRenderDemo {
  readonly nav: readonly string[] = ['Home', 'Products', 'Pricing', 'Docs'];
  readonly menuOpen = signal(false);
  readonly override = signal<boolean | null>(null);

  /** The live viewport signal — true below 768px. */
  readonly liveIsMobile = createMediaQuerySignal('(max-width: 767px)');

  /** Effective mobile flag: override wins when set, else the live signal. */
  readonly isMobile = computed(() => {
    const o = this.override();
    return o === null ? this.liveIsMobile() : o;
  });
}

/* -------------------------------------------------------------------------- */
/* 3. auto-fit + minmax — the reflow grid (resizable container)               */
/* -------------------------------------------------------------------------- */

/**
 * AutoFitGridDemo — the canonical responsive grid:
 *   grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
 *
 * `auto-fit` creates as many tracks as fit the line; `minmax(140px, 1fr)` makes
 * each track at least 140px and grows them to fill leftover space. The grid
 * reflows purely in CSS — no media query, no JS — whenever its OWN width
 * changes. Drag the slider to resize the container (in production it would
 * track the viewport); a ResizeObserver reports the live track count.
 */
@Component({
  selector: 'app-autofit-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="control">
      <label for="ag-width">container width: {{ widthPct() }}%</label>
      <input
        id="ag-width"
        type="range"
        min="20"
        max="100"
        step="1"
        [value]="widthPct()"
        (input)="onWidth($event)"
      />
    </div>

    <div class="resizable" [style.width.%]="widthPct()">
      <div class="grid" #grid>
        @for (i of tiles; track i) {
          <div class="tile">{{ i }}</div>
        }
      </div>
    </div>

    <div class="readout">
      <span class="tag">live track count</span>
      <strong class="value">{{ columns() }}</strong>
      <span class="meta">
        — <code>repeat(auto-fit, minmax(140px, 1fr))</code> decides this in CSS
      </span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .control {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        max-width: 480px;
      }
      .resizable {
        max-width: 100%;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: var(--space-sm);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .tile {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-md);
        background-color: var(--color-surface);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        font-family: var(--font-display);
        color: var(--color-primary);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .value {
        font-family: var(--font-display);
        font-size: var(--text-title);
        color: var(--color-primary);
      }
      .meta {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class AutoFitGridDemo {
  readonly tiles: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly widthPct = signal(100);
  readonly columns = signal(0);

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Read the live column count from the browser's own layout. ResizeObserver
    // fires whenever the grid's box changes; getComputedStyle returns the
    // resolved track list ("140px 140px …") so splitting on whitespace gives
    // the number of tracks actually rendered.
    const observer = new ResizeObserver(() => this.readColumns());
    // afterNextRender runs once after the view exists, in the browser only.
    afterNextRender(() => {
      const root = this.hostEl.nativeElement.querySelector('.grid');
      if (root) {
        observer.observe(root);
        this.readColumns();
      }
    });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  onWidth(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(n)) this.widthPct.set(n);
  }

  private readColumns(): void {
    const grid = this.hostEl.nativeElement.querySelector('.grid');
    if (!grid) return;
    const template = getComputedStyle(grid as HTMLElement).gridTemplateColumns;
    const count = template.trim().split(/\s+/).filter(Boolean).length;
    this.columns.set(count);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Container queries — layout follows the CONTAINER, not the viewport      */
/* -------------------------------------------------------------------------- */

/**
 * ContainerQueryDemo — `@container` adapts layout to a component's own box,
 * not the viewport. A card laid out side-by-side on a wide container stacks
 * vertically on a narrow one — even at the same window size. Drag the slider
 * to shrink the card's container; the layout flips at the
 * `@container (min-width: 360px)` threshold.
 *
 * Two pieces: `container-type: inline-size` on the scope element establishes
 * the query context, and `@container (min-width: …)` inside selects rules
 * against that scope's inline width.
 */
@Component({
  selector: 'app-container-query-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="control">
      <label for="cq-width">container width: {{ widthPct() }}%</label>
      <input
        id="cq-width"
        type="range"
        min="25"
        max="100"
        step="1"
        [value]="widthPct()"
        (input)="onWidth($event)"
      />
    </div>

    <div class="resizable" [style.width.%]="widthPct()">
      <!-- Establishes the container context. -->
      <div class="cq-scope">
        <!-- Card flips layout at @container (min-width: 360px). -->
        <article class="card">
          <div class="thumb">IMG</div>
          <div class="body">
            <h4 class="title">Container-query card</h4>
            <p class="text">
              This card reflows when its container crosses 360px — drag the
              slider. The viewport does not move; the container does.
            </p>
          </div>
        </article>
      </div>
    </div>

    <div class="readout">
      <span class="tag">layout</span>
      <strong class="value">{{ wide() ? 'side-by-side' : 'stacked' }}</strong>
      <span class="meta">
        driven by <code>@container (min-width: 360px)</code> — no JS involved
      </span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .control {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        max-width: 480px;
      }
      .resizable {
        max-width: 100%;
      }
      .cq-scope {
        container-type: inline-size;
        /* Named container (optional): container-name: card; */
      }
      .card {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-lg);
        background-color: var(--color-surface);
        transition: grid-template-columns 160ms ease;
      }
      /* Inside the .cq-scope container — responds to its width, not viewport. */
      @container (min-width: 360px) {
        .card {
          grid-template-columns: 96px 1fr;
        }
      }
      .thumb {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 96px;
        border-radius: var(--radius-md);
        background-color: var(--color-primary-container);
        color: var(--color-on-primary);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        letter-spacing: 0.1em;
      }
      .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .title {
        margin: 0;
        font-family: var(--font-display);
        font-size: var(--text-title-sm);
        color: var(--color-on-surface);
      }
      .text {
        margin: 0;
        font-size: var(--text-body-sm);
        line-height: 1.5;
        color: var(--color-on-surface-variant);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .value {
        font-family: var(--font-display);
        font-size: var(--text-title-sm);
        color: var(--color-primary);
      }
      .meta {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ContainerQueryDemo {
  readonly widthPct = signal(100);

  /**
   * A TS mirror of the @container threshold, purely so the readout can label
   * the current layout. The actual layout flip is CSS — this only REPORTS it.
   * The scope is the .resizable wrapper; its width tracks `widthPct()` of the
   * host's content box.
   */
  readonly wide = computed(() => this.widthPct() >= 60);

  onWidth(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(n)) this.widthPct.set(n);
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Fluid typography — clamp() scales with the viewport                     */
/* -------------------------------------------------------------------------- */

/**
 * FluidTypographyDemo — `clamp(min, preferred, max)` gives a single rule that
 * scales type smoothly between two bounds. The heading below uses
 * `clamp(1.5rem, 6vw, 3.5rem)`: it grows with the viewport but never below
 * 1.5rem (phones) or above 3.5rem (large desktops). Resize the browser to see
 * it move; the live px readout is reported via a ResizeObserver on the heading.
 */
@Component({
  selector: 'app-fluid-typography-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h3 class="fluid">Responsive typography</h3>
    <p class="caption">
      One rule — <code>font-size: clamp(1.5rem, 6vw, 3.5rem)</code> — replaces
      three or four media-query steps. Resize the window and watch the live
      size below move between its floor and ceiling.
    </p>
    <div class="readout">
      <span class="tag">computed font-size</span>
      <strong class="value">{{ sizePx() }}px</strong>
      <span class="meta">on this heading right now</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .fluid {
        margin: 0;
        font-family: var(--font-display);
        font-size: clamp(1.5rem, 6vw, 3.5rem);
        line-height: 1.05;
        color: var(--color-on-surface);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .value {
        font-family: var(--font-display);
        font-size: var(--text-title-sm);
        color: var(--color-primary);
      }
      .meta {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class FluidTypographyDemo {
  readonly sizePx = signal(0);

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const observer = new ResizeObserver(() => this.readSize());
    afterNextRender(() => {
      const heading = this.hostEl.nativeElement.querySelector('.fluid');
      if (heading) {
        observer.observe(heading);
        this.readSize();
      }
    });
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  private readSize(): void {
    const heading = this.hostEl.nativeElement.querySelector(
      '.fluid',
    ) as HTMLElement | null;
    if (!heading) return;
    const px = Number.parseFloat(getComputedStyle(heading).fontSize);
    if (Number.isFinite(px)) this.sizePx.set(Math.round(px));
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Viewport units — vw/vh and the dvh/svh/lvh story                        */
/* -------------------------------------------------------------------------- */

/**
 * ViewportUnitsDemo — the viewport-relative length units. `1vw` is 1% of the
 * viewport width; `1vh` is 1% of the viewport height. On mobile, `vh` is the
 * LARGE viewport (ignores the URL bar), so a `100vh` hero overflows when the
 * browser chrome is visible. `dvh` (dynamic) and `svh` (small) fix this:
 * `svh` always matches the smallest visible viewport, `dvh` tracks the current
 * one. Use `min(...)`/`clamp()` with these to cap heights safely.
 *
 * The bars below are sized in those units — resize the window's height to see
 * them move in lockstep with the viewport.
 */
@Component({
  selector: 'app-viewport-units-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bars">
      <div class="bar vw"><span>20vw wide</span></div>
      <div class="bar vh"><span>20vh tall</span></div>
      <div class="bar dvh"><span>20dvh tall</span></div>
    </div>

    <ul class="notes">
      <li>
        <code>vw</code> / <code>vh</code> — 1% of the viewport width / height.
        On mobile <code>vh</code> is the LARGE viewport (URL bar hidden).
      </li>
      <li>
        <code>svh</code> — smallest viewport height (URL bar shown). The safe
        default for full-height sections.
      </li>
      <li>
        <code>lvh</code> — largest viewport height. Equivalent to legacy
        <code>vh</code>.
      </li>
      <li>
        <code>dvh</code> — dynamic; updates as the browser chrome shows/hides.
        Best for UI that must hug the visible area.
      </li>
    </ul>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .bars {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        align-items: flex-start;
      }
      .bar {
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        background-color: var(--color-primary-container);
        color: var(--color-on-primary);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
      }
      .bar.vw {
        width: 20vw;
        min-width: 120px;
        height: 40px;
      }
      .bar.vh {
        width: 160px;
        height: 20vh;
        min-height: 48px;
      }
      .bar.dvh {
        width: 160px;
        height: 20dvh;
        min-height: 48px;
        background-color: var(--color-secondary-container);
      }
      .notes {
        margin: 0;
        padding-left: var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-size: var(--text-caption);
        line-height: 1.5;
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ViewportUnitsDemo {}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-responsive-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    BreakpointReadoutDemo,
    ConditionalRenderDemo,
    AutoFitGridDemo,
    ContainerQueryDemo,
    FluidTypographyDemo,
    ViewportUnitsDemo,
  ],
  templateUrl: './responsive_view.html',
  styleUrl: './responsive_view.scss',
})
export class ResponsiveView {
  /** Code listings rendered by the page's CodeBlocks. Kept here (not inline
   *  in the HTML) so the template stays readable and the strings get full TS
   *  string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  mediaQueryFn: `// media-query.ts — a dependency-free matchMedia signal.
import { DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { Signal } from '@angular/core';

export function createMediaQuerySignal(query: string): Signal<boolean> {
  const window = inject(DOCUMENT).defaultView;
  if (!window) return signal(false).asReadonly();   // SSR-safe

  const mql = window.matchMedia(query);
  const matches = signal(mql.matches);

  const handler = (e: MediaQueryListEvent) => matches.set(e.matches);
  mql.addEventListener('change', handler);
  // Always detach — matchMedia listeners survive the component.
  inject(DestroyRef).onDestroy(() =>
    mql.removeEventListener('change', handler),
  );
  return matches.asReadonly();
}`,
  mediaFirst: `/* Mobile-first: write the base (small screen) rule first, then layer
   min-width overrides. The cascade does the rest — every override only
   adds to the base, never undoes it. */
.card {
  padding: var(--space-sm);
  grid-template-columns: 1fr;          /* stacked on phones */
}
@media (min-width: 768px) {
  .card {
    padding: var(--space-md);
    grid-template-columns: 1fr 1fr;    /* two columns from tablet up */
  }
}
@media (min-width: 1200px) {
  .card {
    grid-template-columns: 1fr 1fr 1fr;/* three columns on desktop */
  }
}`,
  breakpointSignal: `// Each breakpoint is one matchMedia signal; current = largest match.
readonly sm = createMediaQuerySignal('(min-width: 576px)');
readonly md = createMediaQuerySignal('(min-width: 768px)');
readonly lg = createMediaQuerySignal('(min-width: 992px)');
readonly xl = createMediaQuerySignal('(min-width: 1200px)');

readonly current = computed(() => {
  if (this.xl()) return 'xl';
  if (this.lg()) return 'lg';
  if (this.md()) return 'md';
  if (this.sm()) return 'sm';
  return 'xs';
});`,
  conditional: `// CSS can swap styles; it can't choose which COMPONENT mounts.
// Read the matchMedia signal in the template with @if for that.
readonly isMobile = createMediaQuerySignal('(max-width: 767px)');

// template:
//   @if (isMobile()) {
//     <mobile-nav (toggle)="menuOpen.set(!menuOpen())" />
//   } @else {
//     <desktop-nav />
//   }`,
  autoFit: `/* The reflow grid — the single most useful responsive pattern. auto-fit
   creates as many tracks as fit; minmax(N, 1fr) floors each at N px and
   grows the rest to fill. Reflows in pure CSS — no media query at all. */
.grid {
  display: grid;
  gap: var(--space-sm);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}

/* auto-fit vs auto-fill: auto-fit collapses empty tracks (children stretch
   across them); auto-fill keeps the tracks reserved. You almost always want
   auto-fit. */`,
  container: `/* Container queries: layout follows the CONTAINER, not the viewport.
   1. Establish a containment context. */
.scope {
  container-type: inline-size;
  /* optional name: container-name: card; */
}

/* 2. Query it. This card flips to side-by-side whenever .scope is ≥ 360px,
   even if the viewport never changes (e.g. the card moved into a sidebar). */
.card {
  grid-template-columns: 1fr;            /* stacked */
}
@container (min-width: 360px) {
  .card {
    grid-template-columns: 96px 1fr;     /* side-by-side */
  }
}`,
  clamp: `/* clamp(min, preferred, max) — one rule for fluid type/spacing. The
   preferred value usually mixes a viewport unit (vw) so it scales with the
   screen; the floor/ceiling keep it readable on the smallest and largest
   devices. Replaces 3–4 media-query steps with a single declaration. */
h1 {
  font-size: clamp(1.5rem, 6vw, 3.5rem);
}

/* The same trick works for spacing and layout values. */
.section {
  padding: clamp(var(--space-md), 4vw, var(--space-xl));
}

/* min() / max() compose for capping content width against the viewport. */
.copy {
  width: min(100% - 2rem, 65ch);   /* never wider than a comfortable measure */
}`,
  viewport: `/* Viewport units. 1vw = 1% viewport width, 1vh = 1% viewport height. */
.full-height { height: 100vh; }   /* mobile: the LARGE viewport — overflows
                                     when the URL bar is visible */

/* Mobile-safe heights: svh (smallest), dvh (dynamic), lvh (largest). */
.hero { height: 100svh; }         /* safe — always the visible height */
.dynamic { height: 100dvh; }      /* tracks the chrome as it shows/hides */

/* Cap against the viewport with min() to avoid overflow on tiny screens. */
.panel { width: min(90vw, 480px); }`,
  frameworks: `/* Bootstrap grid breakpoints (the 12-column ladder). Apply via .col-{bp}
   and .col-{bp}-{span} — mobile-first, same min-width thresholds as above. */
/*   xs: <576   sm: ≥576   md: ≥768   lg: ≥992   xl: ≥1200   xxl: ≥1400 */
<div class="container">
  <div class="row">
    <div class="col-12 col-md-6 col-lg-4">card</div>
    <!-- 1 col on phones, 2 cols from md, 3 cols from lg — one element. -->
  </div>
</div>

// Tailwind responsive prefixes are the same idea as utility classes.
// unprefixed = mobile base; sm:/md:/lg:/xl:/2xl: layer min-width overrides.
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- stacks on phones, 2 cols from 640px, 3 cols from 1024px. -->
</div>`,
  cdk: `// @angular/cdk/layout BreakpointObserver is the canonical library option.
// Use it if you already depend on @angular/cdk — it gives you a typed
// BreakpointState (matches: boolean, breakpoints: { [query]: boolean }) and
// integrates with RxJS. The matchMedia signal above is the dependency-free
// equivalent for apps that don't already pull in CDK.
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { inject } from '@angular/core';

const observer = inject(BreakpointObserver);
const isHandset = observer.observe(Breakpoints.Handset);
// consume as a signal: toSignal(isHandset).matches`,
};

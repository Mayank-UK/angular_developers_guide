import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  HostListener,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';
import { HoverTrackDirective } from './hover_track.directive';

/**
 * InteractiveView — interactive behaviours in Angular, the standard way.
 *
 * Covers Angular's event-binding grammar (`(click)`, `(input)`, `(change)`,
 * `(keydown)`/`(keyup)`, `(focus)`/`(blur)`, event filtering like
 * `(keyup.enter)`, the typed `$event`, template reference variables (`#ref`),
 * `@HostListener` on directives/components, and how signals make interaction
 * state reactive without manual change detection.
 *
 * Live, rendered demos (each paired with the code that produces it):
 *   - Click counter (signals + computed; the canonical (click) demo)
 *   - Live echo via both a signal and a template reference variable
 *   - Keydown listener: last key + (keyup.enter) to commit
 *   - Hover & focus state (mouseenter/mouseleave/focus/blur driving signals)
 *   - HostListener directive applied to several hosts at once
 *   - Signals composing several interactions into one reactive readout
 *
 * The shared design-system primitives (`SectionWrapper`, `ContentGroupWrapper`,
 * `TextBlock`, `CodeBlock`, `Example`) are used throughout so the visual
 * language stays consistent. Single-use helpers live in this file; all
 * components are standalone + OnPush and use signals + const-object literal
 * unions (never enums).
 *
 * NOTE: the exported `InteractiveView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

const PARITY = { even: 'even', odd: 'odd' } as const;
type Parity = (typeof PARITY)[keyof typeof PARITY];

const TIER = {
  free: { label: 'Free', price: 0 },
  pro: { label: 'Pro', price: 12 },
  team: { label: 'Team', price: 29 },
} as const;
type TierKey = keyof typeof TIER;

/* -------------------------------------------------------------------------- */
/* 1. Click counter — (click) + signals + computed                            */
/* -------------------------------------------------------------------------- */

/**
 * ClickCounterDemo — the canonical Angular interaction. The `(click)` binding
 * calls a method that writes a signal; `computed` derivations (double, parity)
 * re-run automatically when the source signal changes, and the template stays
 * in sync because OnPush components re-render on signal writes.
 */
@Component({
  selector: 'app-click-counter-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="btn" (click)="increment()">+1</button>
      <button type="button" class="btn ghost" (click)="decrement()">−1</button>
      <button type="button" class="chip" (click)="reset()">reset</button>
    </div>

    <div class="readout">
      <span class="count">{{ count() }}</span>
      <span class="meta">
        double = <code>{{ double() }}</code> ·
        parity = <code>{{ parity() }}</code>
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
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .btn {
        padding: var(--space-xs) var(--space-md);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-size: var(--text-body-sm);
        box-shadow: var(--shadow-button-card);
        cursor: pointer;
      }
      .btn:hover {
        background-color: var(--color-primary-container);
      }
      .btn:focus-visible,
      .chip:focus-visible {
        outline: 2px solid var(--color-secondary);
        outline-offset: 2px;
      }
      .btn:active {
        transform: translateY(1px);
      }
      .btn.ghost {
        background-color: var(--color-surface-variant);
        color: var(--color-on-surface);
        box-shadow: none;
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        cursor: pointer;
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .count {
        font-family: var(--font-display);
        font-size: var(--text-headline);
        line-height: 1;
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
class ClickCounterDemo {
  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);
  readonly parity = computed<Parity>(() =>
    this.count() % 2 === 0 ? PARITY.even : PARITY.odd,
  );

  increment(): void {
    this.count.update((v) => v + 1);
  }
  decrement(): void {
    this.count.update((v) => v - 1);
  }
  reset(): void {
    this.count.set(0);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Live echo — (input) signal AND a template reference variable            */
/* -------------------------------------------------------------------------- */

/**
 * InputEchoDemo — one input shown two ways at once. The left readout reads a
 * signal written by `(input)`; the right readout reads `#ref.value` directly
 * in the template. The signal is reactive (drives `computed`/`effect` and any
 * OnPush consumer); the template reference variable is a plain DOM-property
 * read that re-evaluates on the same change-detection pass — handy for one-off
 * template-only needs with zero backing state.
 */
@Component({
  selector: 'app-input-echo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      class="field"
      type="text"
      placeholder="type and watch both readouts update"
      [value]="text()"
      (input)="onInput($event)"
      #ref
      aria-label="Echo input"
    />

    <div class="grid">
      <div class="cell">
        <span class="tag">via signal → computed</span>
        <code class="val">{{ upper() || '—' }}</code>
      </div>
      <div class="cell">
        <span class="tag">via template ref #ref.value</span>
        <code class="val">{{ ref.value || '—' }}</code>
      </div>
    </div>

    <p class="caption">
      The signal path is reactive — it can feed <code>computed</code>,
      <code>effect</code>, other components, and survives across the template.
      The <code>#ref</code> path is a template-only shortcut — perfect when you
      don't need backing state at all.
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .field {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        max-width: 420px;
      }
      .field:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-sm);
      }
      .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .val {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-primary);
        word-break: break-all;
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
class InputEchoDemo {
  readonly text = signal('');
  readonly upper = computed(() => this.text().toUpperCase());

  onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Keydown listener — (keydown) + event filtering (keyup.enter)            */
/* -------------------------------------------------------------------------- */

/**
 * KeydownDemo — `(keydown)` records the last physical key (typed
 * `KeyboardEvent`), while `(keyup.enter)` is Angular's event-filter syntax: it
 * fires the handler only when the key released is Enter, so you don't need a
 * manual `if (e.key === 'Enter')` check. Committed items live in a signal
 * array; the readout is reactive.
 */
@Component({
  selector: 'app-keydown-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input
      class="field"
      type="text"
      placeholder="type — every keydown is shown; press Enter to commit"
      (keydown)="onKeydown($event)"
      (keyup.enter)="commit($event)"
      aria-label="Keydown listener"
    />

    <div class="readout">
      <span class="tag">last key (keydown):</span>
      <code class="key">{{ lastKey() || '—' }}</code>
    </div>

    <div class="committed">
      <span class="tag">committed on Enter ({{ committed().length }}):</span>
      @if (committed().length === 0) {
        <span class="empty">nothing committed yet</span>
      } @else {
        <ul class="list">
          @for (item of committed(); track item) {
            <li>{{ item }}</li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .field {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        max-width: 420px;
      }
      .field:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .tag {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .key {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-sm);
        background-color: var(--color-surface-variant);
        color: var(--color-primary);
      }
      .committed {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .empty {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .list {
        margin: 0;
        padding-left: var(--space-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class KeydownDemo {
  readonly lastKey = signal('');
  readonly committed = signal<readonly string[]>([]);

  onKeydown(event: KeyboardEvent): void {
    this.lastKey.set(event.key);
  }

  commit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value) return;
    this.committed.update((items) => [...items, value]);
    input.value = '';
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Hover & focus state — (mouseenter)/(mouseleave)/(focus)/(blur)          */
/* -------------------------------------------------------------------------- */

/**
 * HoverFocusDemo — pointer and keyboard state tracked as signals. Two boxes,
 * both focusable (`tabindex="0"`), each with template bindings for
 * mouseenter/mouseleave and focus/blur. The readout distinguishes hover from
 * focus so you can see they are independent — keyboard users get focus, pointer
 * users get hover, and good UI responds to both.
 */
@Component({
  selector: 'app-hover-focus-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid">
      @for (b of boxes; track b.id) {
        <div
          class="box"
          role="group"
          [attr.aria-label]="b.label + ' state'"
          tabindex="0"
          (mouseenter)="onEnter(b.id)"
          (mouseleave)="onLeave(b.id)"
          (focus)="onFocus(b.id)"
          (blur)="onBlur(b.id)"
          [class.is-hover]="hoveredId() === b.id"
          [class.is-focus]="focusedId() === b.id"
        >
          <span class="title">{{ b.label }}</span>
          <span class="state">
            {{ hoverState(b.id) }} · {{ focusState(b.id) }}
          </span>
        </div>
      }
    </div>

    <p class="caption">
      Hover with the pointer or Tab to either box. Hover and focus are tracked
      independently — accessible UI must respond to both, not conflate them.
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: var(--space-sm);
      }
      .box {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-md);
        border: 2px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        transition: background-color 120ms ease, border-color 120ms ease,
          transform 120ms ease;
        outline: none;
      }
      .box.is-hover {
        background-color: var(--color-surface-variant);
      }
      .box.is-focus {
        border-color: var(--color-primary);
        transform: translateY(-2px);
      }
      .title {
        font-size: var(--text-title-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .state {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class HoverFocusDemo {
  readonly boxes = [
    { id: 'a', label: 'Box A' },
    { id: 'b', label: 'Box B' },
  ] as const;

  readonly hoveredId = signal<string | null>(null);
  readonly focusedId = signal<string | null>(null);

  onEnter(id: string): void {
    this.hoveredId.set(id);
  }
  onLeave(id: string): void {
    this.hoveredId.update((cur) => (cur === id ? null : cur));
  }
  onFocus(id: string): void {
    this.focusedId.set(id);
  }
  onBlur(id: string): void {
    this.focusedId.update((cur) => (cur === id ? null : cur));
  }

  hoverState(id: string): string {
    return this.hoveredId() === id ? 'hovering' : 'idle';
  }
  focusState(id: string): string {
    return this.focusedId() === id ? 'focused' : 'blurred';
  }
}

/* -------------------------------------------------------------------------- */
/* 5. HostListener directive — reusable host-level behaviour                  */
/* -------------------------------------------------------------------------- */

/**
 * HostListenerDemo — applies the local `HoverTrackDirective` (see
 * `hover_track.directive.ts`) to three different hosts. The directive listens
 * to the host's own `mouseenter`/`mouseleave`/`focus`/`blur` via
 * `@HostListener` and binds `style.transition` via `@HostBinding`, so one
 * declaration adds the behaviour to every element that carries
 * `appHoverTrack`. This is the lift-from-template-binding-to-directive move:
 * once an interaction repeats, lift it into a directive.
 *
 * It also shows a component-level `@HostListener` for a global shortcut: the
 * demo component itself listens for `keydown.escape` on the host's `window` so
 * pressing Escape anywhere on the screen clears the highlight counter — the
 * same decorator works for document/window listeners, not just element events.
 */
@Component({
  selector: 'app-host-listener-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HoverTrackDirective],
  template: `
    <div class="targets">
      <!-- The same directive is reused on three different hosts. -->
      <button type="button" class="target" appHoverTrack>button host</button>
      <span class="target" tabindex="0" appHoverTrack>span host (focusable)</span>
      <div class="target" tabindex="0" appHoverTrack="var(--color-secondary-container)">
        div host · custom colour
      </div>
    </div>

    <div class="readout">
      <span class="tag">global shortcut:</span>
      <code>press Escape anywhere → clears the counter</code>
      <strong class="count">{{ hits() }}</strong>
      <button type="button" class="chip" (click)="bump()">+1 hit</button>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .targets {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
      }
      .target {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        cursor: default;
        outline: none;
      }
      button.target {
        cursor: pointer;
        box-shadow: var(--shadow-button-card);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .tag {
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 600;
      }
      code {
        font-family: var(--font-mono);
      }
      .count {
        font-family: var(--font-display);
        font-size: var(--text-title);
        color: var(--color-primary);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        cursor: pointer;
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
    `,
  ],
})
class HostListenerDemo {
  readonly hits = signal(0);

  bump(): void {
    this.hits.update((v) => v + 1);
  }

  /** Component-level host listener: `keydown.escape` on the host's window. */
  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.hits() === 0) return;
    this.hits.set(0);
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Signals compose interactions into reactive UI                           */
/* -------------------------------------------------------------------------- */

/**
 * ReactiveSignalsDemo — three independent interactions (a `(change)` select, a
 * `(input)` range, a `(click)` enable toggle) all write signals; one
 * `computed` reads them all and produces the monthly cost, and an `effect`
 * logs every change. No manual change-detection call is needed anywhere: each
 * signal write is what schedules its consumers. This is the signals payoff for
 * interaction state — the template reads `total()` and Angular keeps it in
 * sync because it tracked `total`'s read of `tier`, `seats`, and `enabled`.
 */
@Component({
  selector: 'app-reactive-signals-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <label class="field">
        <span class="label">plan</span>
        <select [value]="tier()" (change)="onTier($event)">
          @for (entry of tierEntries; track entry.key) {
            <option [value]="entry.key">{{ entry.value.label }} · \${{ entry.value.price }}/seat</option>
          }
        </select>
      </label>

      <label class="field">
        <span class="label">seats: {{ seats() }}</span>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          [value]="seats()"
          (input)="onSeats($event)"
        />
      </label>

      <button
        type="button"
        class="toggle"
        [class.on]="enabled()"
        (click)="enabled.set(!enabled())"
      >
        {{ enabled() ? 'active' : 'paused' }}
      </button>
    </div>

    <div class="result">
      <span class="amount">{{ enabled() ? '$' + total() + '/mo' : 'paused' }}</span>
      <span class="formula">
        {{ tierLabel() }} · {{ seats() }} seats
        @if (!enabled()) { · (paused — interactions still tracked) }
      </span>
    </div>

    <p class="caption">
      Three signals, one <code>computed</code>, one <code>effect</code> — every
      interaction updates the readout with zero manual change detection. The
      effect log shows each recomputation firing only when a dependency changed.
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
        align-items: flex-end;
        gap: var(--space-md);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-size: var(--text-body-sm);
      }
      .label {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      select,
      input[type='range'] {
        font: inherit;
        color: var(--color-on-surface);
      }
      select {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .toggle {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        cursor: pointer;
      }
      .toggle.on {
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        border-color: var(--color-primary);
      }
      .result {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-md);
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .amount {
        font-family: var(--font-display);
        font-size: var(--text-headline);
        line-height: 1;
        color: var(--color-primary);
      }
      .formula {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
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
class ReactiveSignalsDemo {
  readonly tier = signal<TierKey>('pro');
  readonly seats = signal(5);
  readonly enabled = signal(true);

  readonly tierEntries = (
    Object.entries(TIER) as readonly [TierKey, (typeof TIER)[TierKey]][]
  ).map(([key, value]) => ({ key, value }));

  readonly tierLabel = computed(() => TIER[this.tier()].label);

  readonly total = computed(() => {
    if (!this.enabled()) return 0;
    return TIER[this.tier()].price * this.seats();
  });

  constructor() {
    // An effect reads the same signals the template does, so Angular runs it
    // exactly when those signals change. This is the "reactive side-effect"
    // pattern (logging, analytics, persistence) — never call it for rendering.
    effect(() => {
      // Reading each signal in the effect body registers it as a dependency;
      // the next change to any of them re-runs this effect.
      // eslint-disable-next-line no-console
      console.debug(
        `[reactive-signals] recomputed: tier=${this.tier()} seats=${this.seats()} enabled=${this.enabled()} → $${this.total()}/mo`,
      );
    });
  }

  onTier(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TierKey;
    this.tier.set(value);
  }
  onSeats(event: Event): void {
    const n = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(n)) this.seats.set(n);
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-interactive-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    ClickCounterDemo,
    InputEchoDemo,
    KeydownDemo,
    HoverFocusDemo,
    HostListenerDemo,
    ReactiveSignalsDemo,
  ],
  templateUrl: './interactive_view.html',
  styleUrl: './interactive_view.scss',
})
export class InteractiveView {
  /** Code listings rendered by the page's CodeBlocks. Kept here (not inline
   *  in the HTML) so the template stays readable and the strings get full TS
   *  string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  bindings: `<!-- Angular event bindings live in the template with the (event) grammar.
   The right-hand side is a statement: a method call, a signal set, or an
   expression that mutates state. The $event payload is typed automatically
   when Angular can infer it from the event name. -->
<button type="button" (click)="save()">Save</button>
<input (input)="onInput($event)" />
<select (change)="onTier($event)">…</select>

<!-- Strongly-typed handler: narrow $event to the concrete DOM event. -->
onInput(event: Event): void {
  this.text.set((event.target as HTMLInputElement).value);
}`,
  filter: `<!-- Event filtering — Angular's syntax for "only fire when…" -->
<input (keyup.enter)="submit()" />      <!-- Enter released -->
<input (keydown.escape)="clear()" />    <!-- Escape pressed -->
<input (keyup.control.z)="undo()" />    <!-- Ctrl+Z released -->
<input (click.shift)="rangeSelect()" /><!-- click + Shift held -->

<!-- Without the filter you'd write the guard yourself: -->
<input (keyup)="onKey($event)" />
onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') this.submit();
}`,
  refs: `<!-- A template reference variable (#name) is a handle to the element (or
   directive/component exported via exportAs) it's declared on. It's visible to
   siblings and ancestors in the same template, and re-evaluates every
   change-detection pass — no backing field needed. -->
<input #name type="text" />
<button (click)="name.value = ''">clear</button>
<code>{{ name.value }}</code>

<!-- Refs onto components/directives (needs exportAs) -->
<form #f="ngForm" (ngSubmit)="save(f.value)">…</form>`,
  keyboard: `<!-- (keydown) fires on every physical key; the $event is a KeyboardEvent,
   so the handler can read .key, .code, .altKey, .metaKey… -->
<input (keydown)="onKeydown($event)" (keyup.enter)="commit($event)" />

readonly lastKey = signal('');
readonly committed = signal<readonly string[]>([]);

onKeydown(event: KeyboardEvent): void {
  this.lastKey.set(event.key);            // typed payload — no \`any\`
}

commit(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim();
  if (!value) return;
  this.committed.update((items) => [...items, value]);
  input.value = '';
}`,
  focus: `<!-- Pointer + keyboard state as signals. :hover/:focus-visible cover the
   visuals; the bindings track state for anything else (a tooltip, a log, …).
   Use :focus-visible in CSS for the keyboard-only ring; keep the signal when
   you need the value in TS. -->
<div
  tabindex="0"
  (mouseenter)="onEnter(box.id)"
  (mouseleave)="onLeave(box.id)"
  (focus)="onFocus(box.id)"
  (blur)="onBlur(box.id)"
></div>

readonly hoveredId = signal<string | null>(null);
onEnter(id: string) { this.hoveredId.set(id); }
onLeave(id: string) {
  this.hoveredId.update((cur) => (cur === id ? null : cur));
}`,
  hostlistener: `import {
  Directive, ElementRef, HostBinding, HostListener, inject, input,
} from '@angular/core';

@Directive({ selector: '[appHoverTrack]' })
export class HoverTrackDirective {
  // A signal input — the host template's binding drives this value.
  readonly appHoverTrack = input('var(--color-primary-container)');

  private readonly el = inject(ElementRef);

  // @HostBinding wires a host property back to a value the directive owns.
  @HostBinding('style.transition')
  readonly transition = 'background-color 120ms ease';

  // @HostListener attaches a listener to the HOST element — so the same
  // behaviour is reused on every element that carries the selector.
  @HostListener('mouseenter') onEnter() {
    this.el.nativeElement.style.backgroundColor = this.appHoverTrack();
  }
  @HostListener('mouseleave') onLeave() {
    this.el.nativeElement.style.backgroundColor = '';
  }
}

// HostListener also works for document/window events on a COMPONENT:
@Component({ /* … */ })
class Demo {
  readonly hits = signal(0);

  @HostListener('window:keydown.escape')
  onEscape() { this.hits.set(0); }
}`,
  signals: `// Signals make interaction state reactive. Every signal write schedules
// only the consumers (computeds, effects, templates) that read it — no zone,
// no manual markForCheck, and OnPush just works.

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,   // ← signals make this trivial
  template: \`
    <select (change)="onTier($event)"></select>
    <input type="range" (input)="onSeats($event)" />
    <button (click)="enabled.set(!enabled())">{{ enabled() ? 'on' : 'off' }}</button>
    <span>{{ total() }}</span>
  \`,
})
class Plan {
  readonly tier = signal<'free' | 'pro' | 'team'>('pro');
  readonly seats = signal(5);
  readonly enabled = signal(true);

  // One computed reads them all; Angular re-runs it only when one changes.
  readonly total = computed(() =>
    this.enabled() ? PRICE[this.tier()] * this.seats() : 0,
  );

  constructor() {
    // Side-effects (logging, analytics) belong in effect(), never in templates.
    effect(() => console.debug('total =', this.total()));
  }
}`,
};

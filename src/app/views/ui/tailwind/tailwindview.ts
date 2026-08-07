import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

/**
 * TailwindView — Tailwind taught in isolation, not adopted app-wide.
 *
 * This app's source of truth for styling is its OWN token design system
 * (`src/ui/design-system/tokens.css` consumed via `var(--…)`). Tailwind is
 * shown here so the utility-first mental model and the trade-offs against a
 * token system are concrete — it is NOT wired into the app globally.
 *
 * To make the demos render with REAL Tailwind utility classes (real `flex`,
 * `grid-cols-*`, `bg-indigo-600`, `hover:…`, responsive `sm:`/`md:` prefixes)
 * without leaking Tailwind into every other route, this view attaches the
 * official Tailwind **Play CDN** `<script>` in `ngOnInit` and removes it —
 * plus every `<style>`/element the Play CDN injects into `<head>` while
 * mounted — in `onDestroy` via `DestroyRef`. The trade-off: while THIS screen
 * is mounted the Play CDN is a runtime compiler that is technically
 * document-wide (its generated utilities, and Preflight base reset if left
 * enabled, briefly reach the whole document), so the prose calls that out and
 * everything is detached the moment the user navigates away. No other route
 * ever sees Tailwind. Preflight is disabled on load so the app's own chrome
 * (header etc.) is left intact; every demo defensive-sets the utilities it
 * needs so disabling Preflight does not change how the demos render.
 *
 * Coverage: what Tailwind is (utility-first), installing it in an Angular
 * project (build-time PostCSS vs CDN vs scoped-on-init), the utility class
 * families (spacing, flex/grid, typography, colors, radius/shadow), responsive
 * `sm:`/`md:`/`lg:` prefixes, state variants `hover:`/`focus:`/`active:`/
 * `disabled:`, `@apply`, theming/config (v3 `tailwind.config.js` vs v4
 * `@theme`, and the `@theme inline` mapping that lets Tailwind utilities read
 * this app's `var(--…)` tokens), and how Tailwind compares to / maps onto the
 * app's own token design system.
 *
 * Live, rendered demos (each paired with the code that produces it):
 *   - Utilities tour (a card composed entirely from utilities)
 *   - Spacing scale (the p-0 … p-8 rhythm)
 *   - Color palette (bg-{palette}-{shade} swatches)
 *   - Responsive (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3, resize to see)
 *   - State variants (hover:/focus:/active:/disabled: — interactive)
 *   - Flex / Grid (interactive container swap)
 *
 * The shared design-system primitives (`SectionWrapper`,
 * `ContentGroupWrapper`, `TextBlock`, `CodeBlock`, `Example`) wrap the teaching
 * chrome; the live demos inside render ACTUAL Tailwind classes. Single-use
 * helpers live in this file; all components are standalone + OnPush and use
 * signals + const-object literal unions (never enums).
 *
 * NOTE: the exported `TailwindView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come
 * after every helper it names — otherwise the decorator would read an
 * uninitialized binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types + data                                                  */
/* -------------------------------------------------------------------------- */

/** A layout mode the user can flip between in the live flex/grid demo. */
interface LayoutMode {
  readonly id: 'flex-row' | 'flex-col' | 'grid-2' | 'grid-3' | 'grid-4';
  readonly label: string;
  /** Tailwind utility classes applied to the demo container. */
  readonly containerClass: string;
}

const LAYOUT_MODES: readonly LayoutMode[] = [
  { id: 'flex-row', label: 'flex flex-row flex-wrap gap-4', containerClass: 'flex flex-row flex-wrap gap-4' },
  { id: 'flex-col', label: 'flex flex-col gap-4', containerClass: 'flex flex-col gap-4' },
  { id: 'grid-2', label: 'grid grid-cols-2 gap-4', containerClass: 'grid grid-cols-2 gap-4' },
  { id: 'grid-3', label: 'grid grid-cols-3 gap-4', containerClass: 'grid grid-cols-3 gap-4' },
  { id: 'grid-4', label: 'grid grid-cols-4 gap-4', containerClass: 'grid grid-cols-4 gap-4' },
];

/** A row in the spacing-scale demo: utility name + the rem value it produces. */
interface SpacingStep {
  readonly utility: string;
  readonly rem: string;
}

const SPACING_STEPS: readonly SpacingStep[] = [
  { utility: 'p-0', rem: '0' },
  { utility: 'p-1', rem: '0.25rem' },
  { utility: 'p-2', rem: '0.5rem' },
  { utility: 'p-3', rem: '0.75rem' },
  { utility: 'p-4', rem: '1rem' },
  { utility: 'p-6', rem: '1.5rem' },
  { utility: 'p-8', rem: '2rem' },
];

/** A swatch column in the color-palette demo. */
interface PaletteColor {
  readonly name: string;
  readonly shades: readonly number[];
}

const PALETTE: readonly PaletteColor[] = [
  { name: 'slate', shades: [100, 300, 500, 700, 900] },
  { name: 'indigo', shades: [100, 300, 500, 700, 900] },
  { name: 'emerald', shades: [100, 300, 500, 700, 900] },
  { name: 'amber', shades: [100, 300, 500, 700, 900] },
  { name: 'rose', shades: [100, 300, 500, 700, 900] },
];

/* -------------------------------------------------------------------------- */
/* 1. Utilities tour — a card composed entirely from utility classes          */
/* -------------------------------------------------------------------------- */

/**
 * UtilitiesTourDemo — a small profile card built from pure Tailwind utility
 * classes: spacing (p-6, gap-3, mt-4), flex (flex items-center), typography
 * (text-lg, font-bold, text-sm, leading-relaxed), color (bg-white, text-slate
 * shades, bg-indigo-600), radius (rounded-xl, rounded-full, rounded-md),
 * shadow + ring, and state (hover:). No custom CSS on any element here.
 */
@Component({
  selector: 'app-tailwind-utilities-tour-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tw-card max-w-sm rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-full bg-indigo-500"></div>
        <div>
          <!-- text utilities override default heading size/weight (Preflight
               is disabled, so h3 defaults are the browser's; we set them) -->
          <h3 class="text-lg font-bold text-slate-900">Ada Lovelace</h3>
          <p class="text-sm text-slate-500">Engineer · London</p>
        </div>
      </div>
      <p class="mt-4 text-sm leading-relaxed text-slate-600">
        Every visual on this card — padding, layout, type, color, radius,
        shadow — is a utility class composed in the template. No CSS file.
      </p>
      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white border border-transparent hover:bg-indigo-700 active:scale-95"
        >
          Follow
        </button>
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-95"
        >
          Message
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
class UtilitiesTourDemo {}

/* -------------------------------------------------------------------------- */
/* 2. Spacing scale                                                           */
/* -------------------------------------------------------------------------- */

/**
 * SpacingScaleDemo — renders the `p-0 … p-8` spacing ladder. Each row shows
 * the utility name, the rem value Tailwind compiles it to, and a live tile
 * that has that padding (visible as the inner gap around the dark inner box).
 */
@Component({
  selector: 'app-tailwind-spacing-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      @for (s of steps; track s.utility) {
        <div class="flex items-center gap-4">
          <code class="tw-code w-16 shrink-0 text-sm text-slate-600">{{ s.utility }}</code>
          <span class="w-20 shrink-0 text-xs text-slate-400">{{ s.rem }}</span>
          <!-- the tile: padding utility applied here; inner box reveals the gap -->
          <div [class]="paddingClass(s.utility)" class="rounded-md bg-indigo-100">
            <div class="h-6 rounded-sm bg-indigo-500"></div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
class SpacingScaleDemo {
  readonly steps: readonly SpacingStep[] = SPACING_STEPS;

  /** Returns just the padding utility (bound alongside the static classes). */
  paddingClass(utility: string): string {
    return utility;
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Color palette                                                           */
/* -------------------------------------------------------------------------- */

/**
 * ColorPaletteDemo — a grid of `bg-{palette}-{shade}` swatches. Shows that
 * Tailwind ships a curated palette per color name on a fixed shade scale.
 */
@Component({
  selector: 'app-tailwind-color-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      @for (c of palette; track c.name) {
        <div class="flex flex-col gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-slate-500">
            {{ c.name }}
          </span>
          <div class="flex flex-row gap-2">
            @for (shade of c.shades; track shade) {
              <div
                [class]="swatchClass(c.name, shade)"
                class="h-12 w-16 rounded-md border border-black/5 flex items-end justify-center pb-1"
              >
                <span class="text-[10px] font-medium text-white drop-shadow">{{ shade }}</span>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
class ColorPaletteDemo {
  readonly palette: readonly PaletteColor[] = PALETTE;

  swatchClass(name: string, shade: number): string {
    return `bg-${name}-${shade}`;
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Responsive — grid that reflows with the viewport                        */
/* -------------------------------------------------------------------------- */

/**
 * ResponsiveDemo — `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. Narrow the
 * browser window and watch the columns reflow — the breakpoint prefix is the
 * whole story.
 */
@Component({
  selector: 'app-tailwind-responsive-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (t of tiles; track t) {
        <div
          class="rounded-md border border-slate-200 bg-slate-50 p-4 text-center text-sm font-medium text-slate-600"
        >
          {{ t }}
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
class ResponsiveDemo {
  readonly tiles: readonly string[] = ['one', 'two', 'three', 'four', 'five', 'six'];
}

/* -------------------------------------------------------------------------- */
/* 5. State variants — interactive                                            */
/* -------------------------------------------------------------------------- */

/**
 * StateVariantsDemo — `hover:`/`focus:`/`active:`/`disabled:` on real
 * controls. The disabled button is driven by a signal toggled from a checkbox
 * so the user can see `disabled:` utilities apply and un-apply.
 */
@Component({
  selector: 'app-tailwind-state-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-5">
      <!-- hover: + active: -->
      <div class="flex flex-col gap-2">
        <span class="tw-label">hover: / active:</span>
        <button
          type="button"
          class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white border border-transparent transition-colors hover:bg-indigo-700 active:scale-95"
        >
          Hover then click me
        </button>
      </div>

      <!-- focus: -->
      <div class="flex flex-col gap-2">
        <span class="tw-label">focus:</span>
        <input
          type="text"
          placeholder="Tab or click to focus"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <!-- disabled: (signal-driven) -->
      <div class="flex flex-col gap-2">
        <span class="tw-label">disabled:</span>
        <div class="flex flex-row items-center gap-3">
          <button
            type="button"
            [disabled]="locked()"
            class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white border border-transparent transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:bg-slate-300"
          >
            {{ locked() ? 'Locked' : 'Unlocking…' }}
          </button>
          <label class="flex flex-row items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              [checked]="locked()"
              (change)="locked.set(!locked())"
              class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            disable the button
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tw-label {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class StateVariantsDemo {
  readonly locked = signal(true);
}

/* -------------------------------------------------------------------------- */
/* 6. Flex / Grid — interactive container swap                                */
/* -------------------------------------------------------------------------- */

/**
 * FlexGridDemo — pick a layout mode; the container's utility classes change
 * and the six tiles re-arrange. Drives home that `flex`/`grid` + their
 * modifiers (`flex-row`, `flex-col`, `grid-cols-*`) are the layout primitives.
 */
@Component({
  selector: 'app-tailwind-flex-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-row flex-wrap gap-2">
      @for (m of modes; track m.id) {
        <button
          type="button"
          [class]="chipClass(m.id)"
          (click)="selected.set(m)"
        >
          {{ m.label }}
        </button>
      }
    </div>

    <div [class]="selected().containerClass">
      @for (i of tiles; track i) {
        <div
          class="flex min-w-[60px] items-center justify-center rounded-md bg-indigo-500 p-4 text-sm font-bold text-white"
        >
          {{ i }}
        </div>
      }
    </div>

    <p class="tw-caption">
      The container swaps between <code>flex</code> and <code>grid</code>
      utilities. In <code>flex-row</code> tiles wrap; in
      <code>grid-cols-3</code> six tiles form two rows of three.
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .tw-caption {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class FlexGridDemo {
  readonly modes: readonly LayoutMode[] = LAYOUT_MODES;
  readonly selected = signal<LayoutMode>(LAYOUT_MODES[2]!);
  readonly tiles: readonly number[] = [1, 2, 3, 4, 5, 6];

  /** Tailwind chip styling; selected chip gets the indigo fill. */
  chipClass(id: LayoutMode['id']): string {
    const base =
      'rounded-md border px-3 py-1 text-xs font-medium transition-colors font-mono';
    return this.selected().id === id
      ? `${base} border-indigo-600 bg-indigo-600 text-white`
      : `${base} border-slate-300 bg-white text-slate-600 hover:bg-slate-50`;
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-tailwind-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    UtilitiesTourDemo,
    SpacingScaleDemo,
    ColorPaletteDemo,
    ResponsiveDemo,
    StateVariantsDemo,
    FlexGridDemo,
  ],
  templateUrl: './tailwind_view.html',
  styleUrl: './tailwind_view.scss',
})
export class TailwindView implements OnInit {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;

  private readonly doc = inject(DOCUMENT);

  /**
   * The Play CDN `<script>` is attached here while this screen is mounted and
   * removed on destroy. While mounted it IS a runtime compiler at document
   * scope — see the prose block in the template (the "scoping" section) for
   * why this is the cleanest option for a teaching screen and what the
   * trade-off is.
   */
  private script: HTMLScriptElement | null = null;

  /**
   * Every element the Play CDN appends to `<head>` while this screen is
   * mounted (notably the generated `<style>` it writes). Tracked via a
   * MutationObserver so `onDestroy` can remove the generated CSS too —
   * otherwise the utility classes would outlive the screen.
   */
  private readonly headAdditions: Element[] = [];
  private headObserver: MutationObserver | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cleanup());
  }

  ngOnInit(): void {
    // Guard against double-attach (strict-mode double effect runs, HMR, …).
    const existing = this.doc.querySelector<HTMLScriptElement>(
      'script[data-tailwind-demo="true"]',
    );
    if (existing) {
      this.script = existing;
      return;
    }

    // Track any <head> children added from here on (the Play CDN's generated
    // <style> will land in this list). On destroy we detach all of them.
    this.headObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (node instanceof Element) this.headAdditions.push(node);
        }
      }
    });
    this.headObserver.observe(this.doc.head, { childList: true });

    // Attach the Tailwind Play CDN (runtime compiler). Preflight (the base
    // reset) is disabled on load so the app's own chrome — header, drawer,
    // the design-system primitives around the demos — is not disturbed; the
    // demos below set the utilities they need explicitly, so disabling
    // Preflight does not change how they render.
    const script = this.doc.createElement('script');
    script.src = 'https://cdn.tailwindcss.com';
    script.setAttribute('data-tailwind-demo', 'true');
    script.addEventListener('load', () => {
      const w = this.doc.defaultView as
        | (Window & { tailwind?: { config?: unknown } })
        | null;
      if (w?.tailwind) {
        w.tailwind.config = { corePlugins: { preflight: false } };
      }
    });
    this.doc.head.appendChild(script);
    this.script = script;
  }

  /** Detach the Play CDN script + every style/element it injected. */
  private cleanup(): void {
    this.headObserver?.disconnect();
    this.headObserver = null;
    this.script?.remove();
    this.script = null;
    for (const el of this.headAdditions) el.remove();
    this.headAdditions.length = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  install: `# Tailwind v4 (current) — install the package + its PostCSS plugin.
npm install tailwindcss @tailwindcss/postcss postcss

# Angular CLI 19+ reads .postcssrc.json automatically:
echo '{
  "plugins": { "@tailwindcss/postcss": {} }
}' > .postcssrc.json

/* src/styles.scss — load Tailwind once, globally. */
@import 'tailwindcss';

# ---------------------------------------------------------------------------
# Tailwind v3 (legacy, but still widespread) used a config file + three
# @tailwind directives instead:
#
#   npm install -D tailwindcss postcss autoprefixer
#   npx tailwindcss init
#
#   // tailwind.config.js
#   module.exports = {
#     content: ['./src/**/*.{html,ts}'],
#     theme: { extend: {} },
#     plugins: [],
#   };
#
#   /* src/styles.scss */
#   @tailwind base;
#   @tailwind components;
#   @tailwind utilities;`,
  threeWays: `// Three ways to add Tailwind in Angular — pick by how isolated you want it.

// 1. BUILD-TIME GLOBAL (recommended). PostCSS plugin + @import 'tailwindcss'
//    in src/styles.scss. Tree-shaken: only the utilities you actually use ship
//    to prod. This is how a real Angular app adopts Tailwind.

// 2. CDN <script> in src/index.html (quick prototype; NOT for prod):
//    <script src="https://cdn.tailwindcss.com"></script>
//    Generates utilities in the browser at runtime — large, slow, and global.

// 3. SCOPED to one route — attach the CDN <script> on init, remove on destroy.
//    (What THIS screen does, so Tailwind never reaches the rest of the app.)
@Component({ /* … */ })
export class TailwindView implements OnInit {
  private readonly doc = inject(DOCUMENT);
  private script: HTMLScriptElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.script?.remove());
  }

  ngOnInit() {
    const s = this.doc.createElement('script');
    s.src = 'https://cdn.tailwindcss.com';
    this.doc.head.appendChild(s);
    this.script = s;
  }
}`,
  utilities: `<!-- Spacing: p-{0..10} padding, m-{0..10} margin, gap-{0..10} flex/grid gap -->
<div class="p-4 m-2">spaced</div>
<div class="flex items-center gap-4">row with a gap</div>

<!-- Flex / grid: layout lives entirely in utility classes -->
<div class="flex items-center justify-between gap-4">row, space-between</div>
<div class="grid grid-cols-3 gap-4">three-col grid</div>

<!-- Typography: text-{xs|sm|base|lg|xl|2xl|3xl}, font-{thin..black}, leading-*, tracking-* -->
<h1 class="text-2xl font-bold text-slate-900">Heading</h1>
<p class="text-sm leading-relaxed text-slate-500">muted body text</p>

<!-- Colors: bg-{palette}-{shade} / text-{palette}-{shade} -->
<button class="bg-indigo-600 text-white">Save</button>

<!-- Radius / shadow / ring compose the "card" look -->
<div class="rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200">card</div>`,
  responsive: `<!-- Prefix any utility with a breakpoint (min-width, mobile-first):
     sm: ≥ 640px   md: ≥ 768px   lg: ≥ 1024px   xl: ≥ 1280px   2xl: ≥ 1536px -->
<nav class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  <Card /><Card /><Card />
</nav>

<!-- One element, behaviour changes with the viewport: -->
<h1 class="text-xl md:text-3xl lg:text-5xl">Grows with the viewport</h1>

<!-- Stacks with state variants — "indigo from md up, on hover": -->
<a class="text-slate-500 hover:text-indigo-600 md:hover:text-indigo-700">link</a>`,
  state: `<!-- State variants: hover:, focus:, active:, disabled:, focus-visible:, … -->
<button class="bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-colors">
  Press me
</button>

<!-- focus: rings an input when it receives focus -->
<input class="rounded-md border-slate-300 focus:border-indigo-500
                    focus:ring-2 focus:ring-indigo-500 focus:outline-none" />

<!-- disabled: greys a control; pair it with the disabled attribute -->
<button class="bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        disabled>
  Locked
</button>`,
  apply: `/* @apply pulls utility classes INTO a regular CSS rule. Use it to extract
   genuinely repeated utility strings into a named class — without leaving
   Tailwind's token scale. */

/* any component SCSS, or src/styles.scss */
.btn-primary {
  @apply rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
         shadow transition-colors;
}
.btn-primary:hover  { @apply bg-indigo-700; }
.btn-primary:focus  { @apply outline-none ring-2 ring-indigo-500; }

.card { @apply rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-200; }

/* Guardrail: reach for @apply only for real repetition. The default —
   utilities inline in the template — keeps styling co-located with the
   markup and avoids an invented class-name layer. Over-use lands you back
   at "invented class names", which is exactly what Tailwind avoids. */`,
  config: `/* Tailwind v4 is CONFIG-LESS by default: add the PostCSS plugin, write
   @import 'tailwindcss', done — no tailwind.config.js. Customisation happens
   in CSS via @theme, which defines the utility namespaces.

   The trick that makes THIS APP's tokens usable as Tailwind utilities is
   @theme inline — each entry maps a Tailwind namespace to a LIVE CSS
   variable, so bg-surface / text-on-surface / rounded-md read the var()
   and follow [data-theme='dark'] flips automatically. */

/* src/styles.scss */
@import 'tailwindcss';
@import './ui/design-system/tokens.css';

@theme inline {
  --color-surface:        var(--color-surface);         /* bg-surface        */
  --color-on-surface:     var(--color-on-surface);      /* text-on-surface   */
  --color-primary:        var(--color-primary);         /* bg-primary        */
  --color-on-primary:     var(--color-on-primary);      /* text-on-primary   */
  --radius-md:            var(--radius-md);             /* rounded-md        */
  --shadow-button-card:   var(--shadow-button-card);    /* shadow-button-card */
}

/* ---------------------------------------------------------------------------
   v3 equivalent (tailwind.config.js) — theme.extend mapped the same way:
   module.exports = {
     content: ['./src/**/*.{html,ts}'],
     theme: {
       extend: {
         colors: {
           surface: 'var(--color-surface)',
           primary: 'var(--color-primary)',
         },
         borderRadius: { md: 'var(--radius-md)' },
       },
     },
   }; */`,
  comparison: `<!-- Same button, two philosophies. This app uses its OWN token system.

     Tailwind: compose the look from utilities inline. No default look to
     fight; only the utilities you use are generated. -->
<button class="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white
               hover:bg-indigo-700">
  Save
</button>

<!-- This app: a hand-written class that consumes var(--…) tokens directly.
     Same visual result, one named class, no utility compilation needed. -->
<button class="app-btn-primary">Save</button>

.app-btn-primary {
  padding: var(--space-xs) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-button-card);
}
.app-btn-primary:hover { background-color: var(--color-primary-container); }

/* The two are not exclusive: with the @theme inline mapping (see the config
   block above), Tailwind utilities can READ these same tokens — so a team
   can adopt Tailwind's authoring ergonomics without abandoning its token
   system. The choice is about authoring style, not tokens vs no-tokens. */`,
};

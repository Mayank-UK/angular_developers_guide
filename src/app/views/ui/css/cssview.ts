import {
  ChangeDetectionStrategy,
  Component,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

/**
 * CssView — CSS as it is actually written in an Angular app.
 *
 * The screen covers the Angular-specific styling layer first (component style
 * encapsulation, the `_ngcontent` scoping mechanism, global vs per-component
 * styles via `styles.scss` + `styleUrls`, SCSS/Sass), then the CSS fundamentals
 * those conventions rest on (custom properties / design-system tokens,
 * selectors, the cascade + specificity, pseudo-classes/elements, modern CSS
 * features, and a brief pointer to media + container queries covered fully on
 * the Responsive screen).
 *
 * Live, rendered demos (each paired with the code that produces it):
 *   - ViewEncapsulation comparison (Emulated vs ShadowDom vs None)
 *   - CSS custom property propagation (change a token, watch it cascade)
 *   - inline style vs class specificity
 *   - pseudo-class / pseudo-element state (hover, focus-visible, ::before)
 *   - clamp() driven by a live custom property
 *
 * The shared design-system primitives (`SectionWrapper`, `ContentGroupWrapper`,
 * `TextBlock`, `CodeBlock`, `Example`) are used throughout so the visual
 * language stays consistent. Single-use helpers live in this file; all
 * components are standalone + OnPush and use signals + const-object literal
 * unions (never enums).
 *
 * NOTE: the exported `CssView` component is declared at the BOTTOM of this
 * file. Its `imports` reference local helper classes, which are block-scoped
 * class declarations (TDZ), so the main component must come after every helper
 * it names — otherwise the decorator would read an uninitialized binding at
 * module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

const TOKEN_HUES = [
  { label: 'primary', val: '#4f46e5' },
  { label: 'secondary', val: '#0d9488' },
  { label: 'warning', val: '#d97706' },
  { label: 'critical', val: '#dc2626' },
] as const;

/* -------------------------------------------------------------------------- */
/* 1. ViewEncapsulation live comparison                                       */
/* -------------------------------------------------------------------------- */

/**
 * EncapEmulated — default. Angular rewrites the selector to
 * `.ve-emulated[_ngcontent-abc]` so the rule only matches elements that
 * belong to THIS component's template. Nothing escapes.
 */
@Component({
  selector: 'app-encap-emulated',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="ve-emulated">Emulated</div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .ve-emulated {
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-size: var(--text-body-sm);
      }
    `,
  ],
})
class EncapEmulated {}

/**
 * EncapShadow — real Shadow DOM. The component's view is rendered inside an
 * open shadow root; its styles never interact with the outside document and
 * outside styles never bleed in. Strongest isolation, but slots/host-context
 * replace ordinary cascade inheritance at the boundary.
 */
@Component({
  selector: 'app-encap-shadow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.ShadowDom,
  template: `<div class="ve-shadow">ShadowDom</div>`,
  styles: [
    `
      :host {
        display: block;
      }
      .ve-shadow {
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-secondary);
        color: var(--color-on-secondary);
        font-size: var(--text-body-sm);
      }
    `,
  ],
})
class EncapShadow {}

/**
 * EncapNone — the component's styles are emitted into the document `<head>`
 * with NO scoping. The `.css-none-leak` rule below leaks globally: any element
 * anywhere in the app with that class picks it up. The leak detector rendered
 * by the host (not inside this component) is proof.
 */
@Component({
  selector: 'app-encap-none',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div class="css-none-leak">None</div>`,
  styles: [
    `
      .css-none-leak {
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-warning);
        color: #ffffff;
        font-size: var(--text-body-sm);
        border: 1px dashed #ffffff;
      }
    `,
  ],
})
class EncapNone {}

/**
 * EncapsulationDemo — renders one box per encapsulation mode plus a "leak
 * detector" element that lives in the host's own template (not inside any of
 * the three children). Only the `None` rule can reach it — visible proof of
 * the leak.
 */
@Component({
  selector: 'app-encapsulation-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EncapEmulated, EncapShadow, EncapNone],
  template: `
    <div class="grid">
      <div class="cell">
        <app-encap-emulated />
        <span class="tag">Emulated · scoped via <code>_ngcontent</code></span>
      </div>
      <div class="cell">
        <app-encap-shadow />
        <span class="tag">ShadowDom · isolated by Shadow DOM</span>
      </div>
      <div class="cell">
        <app-encap-none />
        <span class="tag">None · styles are global</span>
      </div>
    </div>

    <div class="leak-row">
      <div class="css-none-leak">leak detector</div>
      <p class="caption">
        This element is in the host's template, not inside any of the three
        components — yet the <code>None</code> rule styles it, because that rule
        was emitted globally. The Emulated and ShadowDom rules cannot reach it.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-sm);
      }
      .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .tag {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .leak-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-md);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .caption {
        flex: 1 1 240px;
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
class EncapsulationDemo {}

/* -------------------------------------------------------------------------- */
/* 2. CSS custom properties — change a token, watch it propagate              */
/* -------------------------------------------------------------------------- */

/**
 * CustomPropertiesDemo — pick a hue; the host sets `--demo-color` on a
 * container and both tiles read `background-color: var(--demo-color)`. They
 * update together because custom properties cascade and inherit.
 */
@Component({
  selector: 'app-custom-properties-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips">
      @for (h of hues; track h.label) {
        <button
          type="button"
          class="chip"
          [class.selected]="selected().label === h.label"
          (click)="selected.set(h)"
        >
          {{ h.label }}
        </button>
      }
    </div>

    <div class="tiles" [style.--demo-color]="selected().val">
      @for (i of [1, 2]; track i) {
        <div class="tile">tile {{ i }}</div>
      }
    </div>

    <p class="readout">
      <code>--demo-color = {{ selected().val }}</code> ({{ selected().label }})
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .chips {
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
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.selected {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: var(--space-sm);
      }
      .tile {
        padding: var(--space-md);
        text-align: center;
        border-radius: var(--radius-md);
        background-color: var(--demo-color);
        color: #ffffff;
        font-size: var(--text-body-sm);
        font-weight: 500;
      }
      .readout {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class CustomPropertiesDemo {
  readonly hues: readonly (typeof TOKEN_HUES)[number][] = [...TOKEN_HUES];
  readonly selected = signal<(typeof TOKEN_HUES)[number]>(TOKEN_HUES[0]!);
}

/* -------------------------------------------------------------------------- */
/* 3. Specificity — inline style vs class                                     */
/* -------------------------------------------------------------------------- */

/**
 * SpecificityDemo — the target always carries the primary class. Toggling
 * "class + inline" adds an inline `background-color`, which beats the class
 * because inline styles have higher specificity than any selector.
 */
@Component({
  selector: 'app-specificity-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button
        type="button"
        class="chip"
        [class.selected]="!useInline()"
        (click)="useInline.set(false)"
      >
        class only
      </button>
      <button
        type="button"
        class="chip"
        [class.selected]="useInline()"
        (click)="useInline.set(true)"
      >
        class + inline
      </button>
    </div>

    <div
      class="target"
      [style.background-color]="useInline() ? 'var(--color-secondary)' : null"
    >
      {{ useInline() ? 'inline wins (secondary)' : 'class applied (primary)' }}
    </div>

    <p class="caption">
      The element always carries the primary class; toggling adds an inline
      <code>background-color</code> that overrides it. Inline styles sit above
      every selector in the cascade.
    </p>
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
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        font-family: var(--font-mono);
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.selected {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .target {
        padding: var(--space-sm) var(--space-md);
        text-align: center;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-weight: 500;
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class SpecificityDemo {
  readonly useInline = signal(false);
}

/* -------------------------------------------------------------------------- */
/* 4. Pseudo-classes & pseudo-elements                                        */
/* -------------------------------------------------------------------------- */

/**
 * PseudoDemo — a button styled entirely by CSS state. Hover it, focus it with
 * the keyboard (Tab) to see `:focus-visible`, and the leading lock glyph is
 * generated content from `::before` (no extra markup). The second row toggles
 * a disabled input to show `:disabled`.
 */
@Component({
  selector: 'app-pseudo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="btn">Submit</button>
      <button
        type="button"
        class="chip"
        (click)="disabled.update((v) => !v)"
      >
        {{ disabled() ? 'Enable' : 'Disable' }} the input
      </button>
    </div>
    <input
      class="field"
      [disabled]="disabled()"
      placeholder="{{ disabled() ? 'disabled — :disabled applies' : 'type here' }}"
    />
    <p class="caption">
      The lock glyph is <code>::before</code> generated content; the hover and
      focus styles are <code>:hover</code> / <code>:focus-visible</code>.
    </p>
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
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        padding: var(--space-xs) var(--space-md);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-size: var(--text-body-sm);
        box-shadow: var(--shadow-button-card);
        cursor: pointer;
      }
      .btn::before {
        content: '🔒';
        font-size: 0.9em;
      }
      .btn:hover {
        background-color: var(--color-primary-container);
      }
      .btn:focus-visible {
        outline: 2px solid var(--color-secondary);
        outline-offset: 2px;
      }
      .btn:active {
        transform: translateY(1px);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .field {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        max-width: 320px;
      }
      .field:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      .field:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class PseudoDemo {
  readonly disabled = signal(false);
}

/* -------------------------------------------------------------------------- */
/* 5. clamp() — modern CSS driven by a live custom property                  */
/* -------------------------------------------------------------------------- */

/**
 * ClampDemo — the slider sets `--preferred` (in px) on the container; the
 * heading's `font-size: clamp(1rem, var(--preferred), 3rem)` clamps at both
 * ends. Slide past the bounds to see clamp() hold the min/max.
 */
@Component({
  selector: 'app-clamp-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="control">
      <label for="clamp-range">preferred value</label>
      <input
        id="clamp-range"
        type="range"
        min="8"
        max="56"
        step="1"
        [value]="preferred()"
        (input)="preferred.set(toNumber($event))"
      />
      <span class="val">{{ preferred() }}px</span>
    </div>

    <div class="canvas" [style.--preferred]="preferred() + 'px'">
      <h4 class="heading">clamp(1rem, {{ preferred() }}px, 3rem)</h4>
      <p class="bound">
        effective size:
        <code>{{ effectivePx() }}px</code>
        (clamped between 16 and 48)
      </p>
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
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      label {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      input[type='range'] {
        width: 200px;
      }
      .val {
        font-size: var(--text-body-sm);
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
      .canvas {
        padding: var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .heading {
        margin: 0 0 var(--space-xs);
        /* clamp(min, preferred, max): never below 1rem, never above 3rem. */
        font-size: clamp(1rem, var(--preferred), 3rem);
        font-family: var(--font-display);
        color: var(--color-on-surface);
        word-break: break-word;
      }
      .bound {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ClampDemo {
  readonly preferred = signal(24);

  toNumber(event: Event): number {
    const target = event.target as HTMLInputElement;
    const n = Number(target.value);
    return Number.isFinite(n) ? n : this.preferred();
  }

  effectivePx(): number {
    return Math.min(48, Math.max(16, this.preferred()));
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-css-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    EncapsulationDemo,
    CustomPropertiesDemo,
    SpecificityDemo,
    PseudoDemo,
    ClampDemo,
  ],
  templateUrl: './css_view.html',
  styleUrl: './css_view.scss',
})
export class CssView {
  /** Code listings rendered by the page's CodeBlocks. Kept here (not inline
   *  in the HTML) so the template stays readable and the strings get full TS
   *  string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  global: `/* src/styles.scss — the ONE global sheet. Tokens + resets only.
   Imported by angular.json under "styles" so it's loaded once at boot. */
@import './ui/design-system/tokens.css';

html, body { height: 100%; margin: 0; padding: 0; }
body {
  font-family: var(--font-body);
  color: var(--color-on-surface);
  background-color: var(--color-surface-tint);
}
*, *::before, *::after { box-sizing: border-box; }`,
  component: `/* Per-component styles live next to the component and are SCOPED to it
   by default. Prefer styleUrls (external .scss file) for anything non-trivial;
   use the inline "styles" array only for tiny one-offs. */
@Component({
  selector: 'app-card',
  styleUrl: './card.component.scss',     // ← external, scoped
  // or: styles: [\`.card { padding: var(--space-md); }\`],   // inline, scoped
  template: \`<article class="card">…</article>\`,
})
export class Card {}`,
  encapsulation: `import { ViewEncapsulation } from '@angular/core';

@Component({ /* …, */ encapsulation: ViewEncapsulation.Emulated }) // DEFAULT
class Emulated {}   // styles scoped via _ngcontent attribute rewriting

@Component({ /* …, */ encapsulation: ViewEncapsulation.ShadowDom })
class Shadowed {}   // real Shadow DOM — full isolation, styles stay inside

@Component({ /* …, */ encapsulation: ViewEncapsulation.None })
class Global {}     // styles appended to <head> UNSCOPED — leak everywhere`,
  scoping: `<!-- Angular rewrites the component's selectors so they only match its
     own elements. For the template <div class="card">…</div>: -->

<app-card _nghost="abc">
  <div class="card" _ngcontent="abc">…</div>   <!-- ← injected attribute -->
</app-card>

/* The authored rule…        */ .card { padding: var(--space-md); }
/* …is compiled to:           */ .card[_ngcontent="abc"] { padding: var(--space-md); }
/* So a <div class="card"> *outside* this component is NOT styled by it. */`,
  scss: `/* card.component.scss — Sass/SCSS is supported out of the box
   (angular.json "stylePreprocessorOptions" + inlineStyleLanguage: scss). */

$radius: var(--radius-md);              // SCSS variable (compile-time)
@use '../../../ui/design-system' as ds; // @use modules — no global @import

.card {
  padding: var(--space-md);             // CSS custom property (runtime)
  border-radius: $radius;

  &:hover {                             // nesting → compiles to ".card:hover"
    box-shadow: var(--shadow-button-card-hover);
  }

  &__title {                            // BEM via the & parent selector
    color: var(--color-on-surface);
  }
}`,
  tokens: `/* src/ui/design-system/tokens.css — single source of truth.
   Light is the default; dark is a [data-theme="dark"] override on <html>. */
:root {
  --color-primary: #4f46e5;
  --space-md: 16px;
  --radius-md: 8px;
}
[data-theme='dark'] { --color-primary: #818cf8; }

/* Consumed everywhere via var() with an optional fallback: */
.card {
  background-color: var(--color-surface);
  padding: var(--space-md);
  color: var(--color-on-surface, #000);   /* fallback if the token is unset */
}`,
  selectors: `h1            /* type    — every <h1> */
.card         /* class   — every class="card" */
#submit-btn   /* id      — the one element with id="submit-btn" */

.grid > .card /* child       — .card directly inside .grid */
.list .item   /* descendant  — .item anywhere inside .list */
.card.active  /* chained     — element with BOTH classes */

a[href^="https"]::before { content: '🔒 '; }   /* attribute + pseudo-element */
p::first-line { font-weight: bold; }            /* generated/structural */`,
  specificity: `/* Specificity (ids, classes, types) — higher wins: */
#menu .item        /* (1,1,0) — wins */
.list .item        /* (0,2,0) */
.item              /* (0,1,0) */
div                /* (0,0,1) */

/* Tie at (0,1,0) → later rule wins: */
.item { color: red; }
.item { color: green; }   /* green wins */

/* Order of precedence (highest → lowest):
   1. !important
   2. inline style attribute
   3. #id selectors
   4. .class / [attr] / :pseudo-class selectors
   5. <type> / ::pseudo-element selectors
   6. source order (tiebreak) */`,
  pseudo: `.btn {
  background-color: var(--color-primary);
}
.btn::before { content: '🔒 '; }     /* pseudo-element — generated content */
.btn:hover  { background-color: var(--color-primary-container); }
.btn:focus-visible {                /* keyboard focus only — accessibility */
  outline: 2px solid var(--color-secondary);
  outline-offset: 2px;
}
.btn:active { transform: translateY(1px); }
input:disabled { opacity: 0.5; }    /* form state */`,
  modern: `/* Logical properties — flip with the document's writing direction. */
.card {
  padding-inline: var(--space-md);   /* logical: left/right in LTR */
  margin-block-start: var(--space-sm); /* logical: top in horizontal-tb */
  inset-inline-start: 0;             /* logical: left in LTR, right in RTL */
}

/* clamp(min, preferred, max) — fluid scaling without media queries. */
h1 { font-size: clamp(2rem, 5vw, 4rem); }

/* gap on flex/grid — space between items, no margin-collapse headaches. */
.row { display: flex; gap: var(--space-sm); }

/* Native CSS nesting (Angular CLI ships it; no PostCSS needed). */
.card {
  padding: var(--space-md);
  &__title { color: var(--color-on-surface); }
  &:hover { box-shadow: var(--shadow-button-card-hover); }
}`,
  responsive: `/* Media queries — adapt to the VIEWPORT. The full reflow story is on the
   Responsive screen; this is the one-line refresher. */
@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}

/* Container queries — adapt to a COMPONENT's size, not the viewport.
   Enable with "container-type: inline-size" on the parent. */
.sidebar { container-type: inline-size; }
@container sidebar (width > 400px) {
  .card { grid-template-columns: repeat(2, 1fr); }
}

/* Prefer min() / max() / clamp() and the auto-fit grid pattern (see the
   Grid screen) for fluid layouts before reaching for a media query. */`,
};

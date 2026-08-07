import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';
import { LinkCard, LinkCardItem } from '../../../../ui/components/link-card/link-card';
import { ShowError } from '../../../../ui/components/show-error/show-error';
import { ThemeToggle } from '../../../../ui/components/theme-toggle/theme-toggle';
import { ThemeService } from '../../../../ui/design-system/theme.service';
import { DSSizes } from '../../../../ui/design-system/sizes';
import { DSShadows } from '../../../../ui/design-system/shadows';

/**
 * DesignSystemView — the canonical tour of THIS app's own design system.
 *
 * Every other screen in this guide *uses* the design system; this screen
 * *explains* it. It reads the real token values out of `tokens.css` (via
 * `getComputedStyle(document.documentElement)`) and renders them live, so the
 * swatches and ramps you see are the actual values the rest of the app paints
 * with — not invented numbers. Dark-mode flips are driven by the real
 * `ThemeService` signal, and every primitive in `src/ui/components/` is demoed
 * by rendering one instance of it.
 *
 * The shared primitives (`SectionWrapper`, `ContentGroupWrapper`, `TextBlock`,
 * `CodeBlock`, `Example`, `LinkCard`, `ShowError`, `ThemeToggle`) are used
 * throughout. Single-use local helpers live in this file; all components are
 * standalone + OnPush and use signals + const-object literal unions (never
 * enums).
 *
 * NOTE: the exported `DesignSystemView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Token data — mirrors of the real values in src/ui/design-system/tokens.css */
/* -------------------------------------------------------------------------- */

/**
 * Colour tokens, grouped for display. Each entry names the CSS custom property
 * and a short usage note. The resolved hex/rgb value is read live from
 * `getComputedStyle` so it stays correct in both themes.
 */
interface ColourToken {
  readonly token: string;
  readonly usage: string;
}

const COLOUR_GROUPS: readonly { readonly label: string; readonly tokens: readonly ColourToken[] }[] = [
  {
    label: 'Brand',
    tokens: [
      { token: '--color-primary', usage: 'indigo accent — links, focus rings, active states' },
      { token: '--color-primary-container', usage: 'darker accent — hover / pressed' },
      { token: '--color-secondary', usage: 'teal — used sparingly for contrast' },
      { token: '--color-secondary-container', usage: 'darker secondary — hover / pressed' },
    ],
  },
  {
    label: 'Surfaces',
    tokens: [
      { token: '--color-surface', usage: 'page background' },
      { token: '--color-surface-tint', usage: 'section / tinted backgrounds' },
      { token: '--color-surface-variant', usage: 'code & example wells' },
      { token: '--color-outline', usage: 'hairline borders' },
    ],
  },
  {
    label: 'On-colour (foregrounds)',
    tokens: [
      { token: '--color-on-primary', usage: 'text/icons on primary' },
      { token: '--color-on-secondary', usage: 'text/icons on secondary' },
      { token: '--color-on-surface', usage: 'primary text' },
      { token: '--color-on-surface-variant', usage: 'secondary / muted text' },
      { token: '--color-on-error', usage: 'text/icons on error' },
    ],
  },
  {
    label: 'Status & severity',
    tokens: [
      { token: '--color-info', usage: 'info severity (ShowError / snackbar)' },
      { token: '--color-warning', usage: 'warning severity' },
      { token: '--color-error', usage: 'error glyph + retry surfaces' },
      { token: '--color-critical', usage: 'critical severity (full-screen)' },
    ],
  },
];

/** Spacing scale — driven by the real `DSSizes` TS mirror. */
const SPACING: readonly { readonly token: string; readonly px: number }[] = [
  { token: '--space-xxs', px: DSSizes.xxs },
  { token: '--space-xs', px: DSSizes.xs },
  { token: '--space-sm', px: DSSizes.sm },
  { token: '--space-md', px: DSSizes.md },
  { token: '--space-lg', px: DSSizes.lg },
  { token: '--space-xl', px: DSSizes.xl },
  { token: '--space-xxl', px: DSSizes.xxl },
];

/** Typography scale — the literal values authored in tokens.css. */
const TYPOGRAPHY: readonly {
  readonly token: string;
  readonly value: string;
  readonly sample: string;
}[] = [
  { token: '--text-display-lg', value: 'clamp(2.5rem, 8vw, 6rem)', sample: 'Display LG' },
  { token: '--text-display-md', value: 'clamp(2rem, 5vw, 3.75rem)', sample: 'Display MD' },
  { token: '--text-display-sm', value: 'clamp(1.75rem, 4vw, 3rem)', sample: 'Display SM' },
  { token: '--text-headline', value: '34px', sample: 'Headline' },
  { token: '--text-title-lg', value: '24px', sample: 'Title large' },
  { token: '--text-title', value: '20px', sample: 'Title' },
  { token: '--text-title-sm', value: '16px', sample: 'Title small' },
  { token: '--text-body', value: '16px', sample: 'Body — the quick brown fox jumps over the lazy dog' },
  { token: '--text-body-sm', value: '14px', sample: 'Body small — the quick brown fox' },
  { token: '--text-caption', value: '12px', sample: 'Caption — secondary metadata' },
  { token: '--text-overline', value: '10px', sample: 'OVERLINE — LABELS & TAGS' },
];

/** Font families. */
const FONTS: readonly { readonly token: string; readonly value: string; readonly sample: string }[] = [
  { token: '--font-display', value: "'Montserrat', system-ui, sans-serif", sample: 'Headings & display type' },
  { token: '--font-body', value: "'Inter', system-ui, -apple-system, …", sample: 'Body copy & UI chrome' },
  { token: '--font-mono', value: "'JetBrains Mono', ui-monospace, …", sample: 'const token = 42;' },
];

/** Radius scale. */
const RADIUS: readonly { readonly token: string; readonly value: string }[] = [
  { token: '--radius-sm', value: '4px' },
  { token: '--radius-md', value: '8px' },
  { token: '--radius-lg', value: '16px' },
  { token: '--radius-pill', value: '9999px' },
];

/** Shadow scale — keyed to the `DSShadows` TS mirror. */
const SHADOWS: readonly { readonly token: string; readonly key: keyof typeof DSShadows }[] = [
  { token: '--shadow-button-card', key: 'buttonCard' },
  { token: '--shadow-button-card-hover', key: 'buttonCardHover' },
  { token: '--shadow-drawer', key: 'drawer' },
  { token: '--shadow-modal', key: 'modal' },
];

/** Layout tokens. */
const LAYOUT: readonly { readonly token: string; readonly value: string; readonly usage: string }[] = [
  { token: '--content-max-width', value: '960px', usage: 'page reading measure' },
  { token: '--header-height', value: '64px', usage: 'app shell header' },
];

/* -------------------------------------------------------------------------- */
/* 1. Colour palette — live swatches from the real tokens                     */
/* -------------------------------------------------------------------------- */

/**
 * ColourPaletteDemo — every colour token painted as a swatch using its own
 * `var(--…)`. The resolved value text is read live from
 * `getComputedStyle(document.documentElement)`, and re-read whenever the theme
 * flips, so what you see is exactly what the rest of the app paints with.
 */
@Component({
  selector: 'app-colour-palette-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (group of groups; track group.label) {
      <div class="group">
        <p class="group-label">{{ group.label }}</p>
        <div class="grid">
          @for (t of group.tokens; track t.token) {
            <div class="swatch" [style.backgroundColor]="'var(' + t.token + ')'">
              <span class="name">{{ t.token }}</span>
              <span class="value">{{ value(t.token) }}</span>
            </div>
          }
        </div>
        <ul class="usages">
          @for (t of group.tokens; track t.token) {
            <li><code>{{ t.token }}</code> — {{ t.usage }}</li>
          }
        </ul>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .group-label {
        margin: 0 0 var(--space-xs) 0;
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: var(--space-xs);
      }
      .swatch {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 88px;
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-outline);
        /* Border colour adapts when the swatch itself is the surface colour. */
      }
      .name {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        font-weight: 600;
        color: var(--color-on-surface);
        background-color: var(--color-surface);
        padding: 2px var(--space-xs);
        border-radius: var(--radius-sm);
        align-self: flex-start;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .value {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
        background-color: var(--color-surface);
        padding: 2px var(--space-xs);
        border-radius: var(--radius-sm);
        align-self: flex-start;
      }
      .usages {
        margin: var(--space-xs) 0 0 0;
        padding-left: var(--space-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ColourPaletteDemo {
  readonly groups = COLOUR_GROUPS;

  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  /** Live resolved values keyed by token name. */
  private readonly values = signal<Record<string, string>>({});

  constructor() {
    // Re-read whenever the theme signal changes. ThemeService is a root
    // singleton created at app startup, so its effect (which writes the
    // data-theme attribute) runs before this one in registration order; by the
    // time this effect reads computed style, the attribute is already current.
    // Custom properties resolve with the cascade, so no paint cycle is needed.
    effect(() => {
      this.theme.mode(); // track
      this.readAll();
    });
  }

  value(token: string): string {
    return this.values()[token] ?? '…';
  }

  private readAll(): void {
    const root = this.document.documentElement;
    const out: Record<string, string> = {};
    for (const group of COLOUR_GROUPS) {
      for (const t of group.tokens) {
        out[t.token] = getComputedStyle(root).getPropertyValue(t.token).trim();
      }
    }
    this.values.set(out);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Spacing scale — ramp using the real DSSizes mirror                      */
/* -------------------------------------------------------------------------- */

/**
 * SpacingScaleDemo — the seven-step spacing ramp, each step painted as a bar
 * whose width IS the token's value (read from the `DSSizes` TS mirror). The
 * tokens double as the gap/padding scale used by every primitive stylesheet.
 */
@Component({
  selector: 'app-spacing-scale-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (step of steps; track step.token) {
      <div class="row">
        <code class="name">{{ step.token }}</code>
        <div class="bar" [style.width.px]="step.px"></div>
        <span class="px">{{ step.px }}px</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .row {
        display: grid;
        grid-template-columns: 140px 1fr 64px;
        align-items: center;
        gap: var(--space-sm);
      }
      .name {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .bar {
        height: 16px;
        border-radius: var(--radius-sm);
        background-color: var(--color-primary);
        min-width: 2px;
      }
      .px {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
      }
      @media (max-width: 540px) {
        .row {
          grid-template-columns: 96px 1fr 56px;
        }
      }
    `,
  ],
})
class SpacingScaleDemo {
  readonly steps = SPACING;
}

/* -------------------------------------------------------------------------- */
/* 3. Typography scale — real font-size tokens rendered live                  */
/* -------------------------------------------------------------------------- */

/**
 * TypographyScaleDemo — each `--text-*` token rendered at its own size. The
 * ramp combines fluid `clamp()` display sizes (which scale with the viewport)
 * with fixed px steps for body/caption/overline. The font-family samples show
 * the three `--font-*` stacks.
 */
@Component({
  selector: 'app-typography-scale-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ramp">
      @for (t of scale; track t.token) {
        <div class="entry">
          <div class="sample" [style]="'font-size: var(' + t.token + ')'">
            {{ t.sample }}
          </div>
          <div class="meta">
            <code>{{ t.token }}</code>
            <span class="value">{{ t.value }}</span>
          </div>
        </div>
      }
    </div>

    <div class="fonts">
      @for (f of families; track f.token) {
        <div class="font-entry">
          <div class="font-sample" [style]="'font-family: var(' + f.token + ')'">
            {{ f.sample }}
          </div>
          <div class="meta">
            <code>{{ f.token }}</code>
            <span class="value">{{ f.value }}</span>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .ramp {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .entry {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding-bottom: var(--space-xs);
        border-bottom: 1px solid var(--color-outline);
      }
      .sample {
        font-family: var(--font-display);
        line-height: 1.1;
        color: var(--color-on-surface);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        align-items: baseline;
      }
      .meta code {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-primary);
      }
      .meta .value {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .fonts {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .font-entry {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .font-sample {
        font-size: var(--text-title);
        color: var(--color-on-surface);
      }
    `,
  ],
})
class TypographyScaleDemo {
  readonly scale = TYPOGRAPHY;
  readonly families = FONTS;
}

/* -------------------------------------------------------------------------- */
/* 4. Radius + shadow tokens — live tiles                                     */
/* -------------------------------------------------------------------------- */

/**
 * RadiusShadowDemo — the radius ladder and the four elevation shadows, each
 * rendered as a surface tile that applies its own `var(--…)`.
 */
@Component({
  selector: 'app-radius-shadow-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="label">Radius</p>
    <div class="row">
      @for (r of radius; track r.token) {
        <div class="tile radius-tile" [style.borderRadius]="'var(' + r.token + ')'">
          <span class="name">{{ r.token }}</span>
          <span class="value">{{ r.value }}</span>
        </div>
      }
    </div>

    <p class="label">Shadow (elevation)</p>
    <div class="row">
      @for (s of shadows; track s.token) {
        <div
          class="tile shadow-tile"
          [style.boxShadow]="'var(' + s.token + ')'"
        >
          <span class="name">{{ s.token }}</span>
          <span class="value">{{ s.key }}</span>
        </div>
      }
    </div>

    <p class="label">Layout</p>
    <div class="layout-list">
      @for (l of layout; track l.token) {
        <div class="layout-row">
          <code>{{ l.token }}</code>
          <span class="v">{{ l.value }}</span>
          <span class="u">{{ l.usage }}</span>
        </div>
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
      .label {
        margin: var(--space-xs) 0 0 0;
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: var(--space-sm);
      }
      .tile {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        min-height: 84px;
        padding: var(--space-sm);
        background-color: var(--color-surface);
        border: 1px solid var(--color-outline);
      }
      .radius-tile {
        /* border-radius bound inline per token */
      }
      .shadow-tile {
        border-radius: var(--radius-md);
      }
      .name {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
      }
      .value {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .layout-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      .layout-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        align-items: baseline;
        font-size: var(--text-caption);
      }
      .layout-row code {
        font-family: var(--font-mono);
        color: var(--color-primary);
      }
      .layout-row .v {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
      .layout-row .u {
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class RadiusShadowDemo {
  readonly radius = RADIUS;
  readonly shadows = SHADOWS;
  readonly layout = LAYOUT;
}

/* -------------------------------------------------------------------------- */
/* 5. Theme demo — live data-theme flip via the real ThemeService             */
/* -------------------------------------------------------------------------- */

/**
 * ThemeDemo — the live dark-mode story. The real `ThemeService` signal drives
 * the `data-theme` attribute on `<html>`, which is what every colour token
 * keys off of. Clicking the `<ui-theme-toggle>` primitive flips the ENTIRE app
 * (this page, the header, every primitive on it) because the attribute lands
 * on the document root — that's the mechanism this screen teaches. The
 * readouts below confirm it: the `data-theme` attribute and the resolved
 * `--color-surface` / `--color-on-surface` values all follow the signal.
 */
@Component({
  selector: 'app-theme-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ThemeToggle],
  template: `
    <div class="controls">
      <ui-theme-toggle />
      <button type="button" class="chip" (click)="toggle()">
        theme.toggle()
      </button>
      <button
        type="button"
        class="chip"
        (click)="set('light')"
        [class.selected]="mode() === 'light'"
      >
        set('light')
      </button>
      <button
        type="button"
        class="chip"
        (click)="set('dark')"
        [class.selected]="mode() === 'dark'"
      >
        set('dark')
      </button>
    </div>

    <div class="card">
      <p class="caption">
        This whole card is painted with token colours. Toggle the theme and
        every value below re-reads from <code>getComputedStyle</code> on the
        document root.
      </p>
      <div class="readout-grid">
        <div class="readout">
          <span class="k">data-theme</span>
          <strong class="v">{{ attr() }}</strong>
        </div>
        <div class="readout">
          <span class="k">--color-surface</span>
          <strong class="v">{{ surface() }}</strong>
        </div>
        <div class="readout">
          <span class="k">--color-on-surface</span>
          <strong class="v">{{ onSurface() }}</strong>
        </div>
        <div class="readout">
          <span class="k">stored as</span>
          <strong class="v">{{ storageKey }} = {{ mode() }}</strong>
        </div>
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
        align-items: center;
        gap: var(--space-sm);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.selected {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-outline);
        background-color: var(--color-surface-tint);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .readout-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: var(--space-sm);
      }
      .readout {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        padding: var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        border: 1px solid var(--color-outline);
      }
      .k {
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .v {
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-primary);
        word-break: break-all;
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ThemeDemo {
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  readonly storageKey = 'adg-theme';
  readonly mode = this.theme.mode;
  readonly attr = computed(() => this.theme.mode());

  /** Resolved token values, re-read when mode changes. */
  private readonly surfaceSig = signal('…');
  private readonly onSurfaceSig = signal('…');
  readonly surface = this.surfaceSig.asReadonly();
  readonly onSurface = this.onSurfaceSig.asReadonly();

  constructor() {
    // Same registration-order reasoning as ColourPaletteDemo: ThemeService's
    // effect has already written data-theme by the time this runs.
    effect(() => {
      this.theme.mode(); // track
      this.read();
    });
  }

  toggle(): void {
    this.theme.toggle();
  }
  set(m: 'light' | 'dark'): void {
    this.theme.setMode(m);
  }

  private read(): void {
    const root = this.document.documentElement;
    const cs = getComputedStyle(root);
    this.surfaceSig.set(cs.getPropertyValue('--color-surface').trim());
    this.onSurfaceSig.set(cs.getPropertyValue('--color-on-surface').trim());
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Primitives gallery — one rendered instance of each primitive            */
/* -------------------------------------------------------------------------- */

/**
 * PrimitivesGalleryDemo — every UI primitive rendered once, so the gallery is
 * itself a live integration test of the design system. Each primitive's full
 * description and source lives in its own section on the page; this demo just
 * shows them all together.
 *
 * `ShowError` is a full-screen blocking surface in production (min-height
 * 60vh), so it's rendered here inside a constrained, scroll-capped frame with
 * a visible note rather than at its natural full-viewport size.
 */
@Component({
  selector: 'app-primitives-gallery-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    LinkCard,
    ShowError,
  ],
  template: `
    <div class="grid">
      <div class="cell">
        <span class="tag">ui-section-wrapper</span>
        <ui-section-wrapper title="Titled section">
          <ui-text-block text="Body content goes inside the section." />
        </ui-section-wrapper>
      </div>

      <div class="cell">
        <span class="tag">ui-content-group-wrapper</span>
        <ui-content-group-wrapper title="Sub-group label">
          <ui-text-block text="A labelled cluster inside a section." />
        </ui-content-group-wrapper>
      </div>

      <div class="cell">
        <span class="tag">ui-text-block</span>
        <ui-text-block text="A full-width paragraph of body copy. Line height is generous; colour is the muted on-surface-variant so it reads as secondary to headings." />
      </div>

      <div class="cell">
        <span class="tag">ui-example</span>
        <ui-example label="Interactive demo frame">
          <ui-text-block text="Visually distinct, dashed border — 'touch this, don't just read it'." />
        </ui-example>
      </div>

      <div class="cell">
        <span class="tag">ui-code-block</span>
        <ui-code-block
          language="ts"
          [code]="snippet"
          caption="Collapsible by default; copy works open or closed."
          [defaultOpen]="true"
        />
      </div>

      <div class="cell">
        <span class="tag">ui-link-card</span>
        <ui-link-card [item]="card" />
      </div>

      <div class="cell">
        <span class="tag">ui-show-error (constrained)</span>
        <div class="error-frame">
          <ui-show-error
            kind="network"
            severity="critical"
            message="Could not reach the server."
            (retry)="onRetry()"
          />
        </div>
        @if (retried()) {
          <p class="note">↻ retry emitted — host decides what to do.</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-md);
        align-items: start;
      }
      .cell {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .tag {
        font-family: var(--font-mono);
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-primary);
      }
      .error-frame {
        max-height: 220px;
        overflow: auto;
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        /* ShowError's own min-height: 60vh is intentionally capped here so the
           full-screen blocking surface doesn't take over the gallery. */
      }
      .note {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-secondary);
      }
    `,
  ],
})
class PrimitivesGalleryDemo {
  readonly snippet = "const token = 'var(--color-primary)';";
  readonly card: LinkCardItem = {
    title: 'Design system',
    route: '/ui/design-system',
    description: 'A router-link card used by hub screens for their grids.',
  };
  readonly retried = signal(false);

  onRetry(): void {
    this.retried.set(true);
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-design-system-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    LinkCard,
    ThemeToggle,
    ColourPaletteDemo,
    SpacingScaleDemo,
    TypographyScaleDemo,
    RadiusShadowDemo,
    ThemeDemo,
    PrimitivesGalleryDemo,
  ],
  templateUrl: './design_system_view.html',
  styleUrl: './design_system_view.scss',
})
export class DesignSystemView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;

  /** A sample link-card item for the live primitive demo. */
  readonly sampleCard: LinkCardItem = {
    title: 'CSS screen',
    route: '/ui/css',
    description: 'Where to reach the dedicated CSS deep-dive.',
  };
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  tokensRoot: `/* src/ui/design-system/tokens.css — the single source of truth.
   Light values live under :root; dark overrides live under
   [data-theme='dark'] and only re-declare what changes. */
:root {
  --color-primary: #4f46e5;          /* indigo-600 */
  --color-primary-container: #4338ca;
  --color-secondary: #0d9488;        /* teal-600 */
  --color-surface: #ffffff;
  --color-surface-tint: #f8fafc;
  --color-surface-variant: #f1f5f9;
  --color-on-surface: #0f172a;
  --color-on-surface-variant: #64748b;
  --color-outline: #e2e8f0;
  --color-error: #dc2626;
  /* severity */
  --color-info: #2563eb;
  --color-warning: #d97706;
  --color-critical: #dc2626;

  --font-display: 'Montserrat', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  --text-display-lg: clamp(2.5rem, 8vw, 6rem);
  --text-headline: 34px;
  --text-title: 20px;
  --text-body: 16px;
  --text-caption: 12px;
  --text-overline: 10px;

  --space-xxs: 2px;  --space-xs: 4px;   --space-sm: 8px;
  --space-md: 16px;  --space-lg: 32px;  --space-xl: 64px;  --space-xxl: 128px;

  --radius-sm: 4px;  --radius-md: 8px;  --radius-lg: 16px;  --radius-pill: 9999px;

  --shadow-button-card: 0 1px 2px rgba(15,23,42,.06), 0 1px 3px rgba(15,23,42,.1);
  --shadow-button-card-hover: 0 4px 8px rgba(15,23,42,.08), 0 2px 4px rgba(15,23,42,.06);
  --shadow-drawer: 0 10px 15px -3px rgba(15,23,42,.1), 0 4px 6px rgba(15,23,42,.05);
  --shadow-modal: 0 20px 25px -5px rgba(15,23,42,.1), 0 8px 10px rgba(15,23,42,.04);

  --content-max-width: 960px;
  --header-height: 64px;
}`,
  tokensDark: `/* Dark mode is just a second block of the same custom properties.
   The attribute lands on <html> via ThemeService; tokens.css keys off it.
   Only the values that actually change are re-declared — structure stays. */
[data-theme='dark'] {
  --color-primary: #818cf8;          /* brighter on dark */
  --color-primary-container: #6366f1;
  --color-secondary: #2dd4bf;
  --color-surface: #0b1120;          /* slate-950-ish */
  --color-surface-tint: #131c2e;
  --color-surface-variant: #1c2740;
  --color-on-surface: #e2e8f0;
  --color-on-surface-variant: #94a3b8;
  --color-outline: #243049;
  --color-error: #f87171;
  --color-info: #60a5fa;
  --color-warning: #fbbf24;
  --color-critical: #f87171;

  /* Shadows darken — the same rgba-on-white would vanish on a dark ground. */
  --shadow-button-card: 0 1px 2px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.3);
  --shadow-drawer: 0 10px 15px -3px rgba(0,0,0,.5), 0 4px 6px rgba(0,0,0,.3);
}`,
  themeService: `// src/ui/design-system/theme.service.ts — signal-driven dark mode.
import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'adg-theme';

export function resolveInitialThemeMode(
  windowRef: Pick<Window, 'localStorage' | 'matchMedia'> = window,
): ThemeMode {
  const stored = windowRef.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return windowRef.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);

  // The active mode is a signal — the whole shell reads it reactively.
  readonly mode = signal<ThemeMode>(resolveInitialThemeMode());

  constructor() {
    // An effect keeps the DOM attribute + localStorage in sync on every change.
    effect(() => {
      const mode = this.mode();
      this.document.documentElement.setAttribute('data-theme', mode);
      try {
        this.document.defaultView?.localStorage.setItem(
          THEME_STORAGE_KEY,
          mode,
        );
      } catch { /* private mode — ignore */ }
    });
  }

  setMode(mode: ThemeMode): void { this.mode.set(mode); }
  toggle(): void {
    this.mode.update((m) => (m === 'dark' ? 'light' : 'dark'));
  }
}`,
  dsSizes: `// src/ui/design-system/sizes.ts — TS mirror of the --space-* tokens.
// Use these when a JS value is needed (e.g. dynamic gaps); otherwise prefer
// the CSS custom properties directly.
export const DSSizes = {
  xxs: 2, xs: 4, sm: 8, md: 16, lg: 32, xl: 64, xxl: 128,
} as const;
export type DSSize = keyof typeof DSSizes;`,
  dsShadows: `// src/ui/design-system/shadows.ts — TS mirror of the --shadow-* tokens.
// Values are box-shadow strings that reference the runtime CSS variables, so
// they respect dark mode for free.
const v = (token: string) => \`var(\${token})\`;

export const DSShadows = {
  buttonCard:      v('--shadow-button-card'),
  buttonCardHover: v('--shadow-button-card-hover'),
  drawer:          v('--shadow-drawer'),
  modal:           v('--shadow-modal'),
} as const;
export type DSShadow = keyof typeof DSShadows;`,
  consuming: `/* Components consume tokens with var() — never hard-coded colours.
   Dark mode then "just works" because the same rules read the overridden
   values under [data-theme='dark']. */
.card {
  background-color: var(--color-surface);
  color: var(--color-on-surface);
  border: 1px solid var(--color-outline);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  box-shadow: var(--shadow-button-card);
}
.card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-button-card-hover);
}`,
  sectionWrapper: `// ui-section-wrapper — titled, surface-tinted block. Page's primary unit.
@Component({
  selector: 'ui-section-wrapper',
  templateUrl: './section-wrapper.html',
})
export class SectionWrapper {
  readonly title = input.required<string>();
}
// template:
//   <section class="section">
//     <h2 class="title"><span class="accent"></span>{{ title() }}</h2>
//     <div class="body"><ng-content /></div>
//   </section>`,
  contentGroup: `// ui-content-group-wrapper — sub-group label inside a section.
// Rendered as an overline so hierarchy reads: section title -> overline -> body.
@Component({
  selector: 'ui-content-group-wrapper',
})
export class ContentGroupWrapper {
  readonly title = input.required<string>();
}`,
  textBlock: `// ui-text-block — a full-width paragraph of body copy.
// String-only; white-space: pre-line preserves authored line breaks.
@Component({
  selector: 'ui-text-block',
})
export class TextBlock {
  readonly text = input.required<string>();
}`,
  codeBlock: `// ui-code-block — collapsible, copyable code listing.
// Collapsed by default so pages full of examples don't become a wall of code.
@Component({
  selector: 'ui-code-block',
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly language = input<string>('code');
  readonly caption = input<string>('');
  readonly defaultOpen = input<boolean>(false);
  readonly open = signal(false);
  // toggleOpen(), copy(event) — see the source file.
}`,
  example: `// ui-example — visually distinct container for LIVE demonstrations.
// Dashed border + "↳ Live example" overline. Pairs with CodeBlock: code beside.
@Component({
  selector: 'ui-example',
})
export class Example {
  readonly label = input<string>('Live example');
}`,
  linkCard: `// ui-link-card — title + optional description + a router link.
// Used by hub screens for their sub-screen grids. Item shape is local so the
// UI layer stays decoupled from the data layer.
export interface LinkCardItem {
  readonly title: string;
  readonly route: string;
  readonly description?: string;
}
@Component({
  selector: 'ui-link-card',
  imports: [RouterLink],
})
export class LinkCard {
  readonly item = input.required<LinkCardItem>();
}`,
  showError: `// ui-show-error — full-screen blocking error for CRITICAL failures.
// Decoupled from core/domain: accepts plain inputs (message, severity, kind).
export type FailureSeverity = 'info' | 'warning' | 'critical';
@Component({
  selector: 'ui-show-error',
})
export class ShowError {
  readonly message = input.required<string>();
  readonly severity = input<FailureSeverity>('critical');
  readonly kind = input<FailureKind>('unknown');
  readonly retry = output<void>();   // host decides what to do
}`,
  themeToggle: `// ui-theme-toggle — switches light/dark by calling ThemeService.toggle().
@Component({
  selector: 'ui-theme-toggle',
})
export class ThemeToggle {
  private readonly theme = inject(ThemeService);
  readonly mode = this.theme.mode;     // reactive
  toggle(): void { this.theme.toggle(); }
}
// template:
//   <button (click)="toggle()">{{ mode() === 'dark' ? '☀︎' : '☾' }}</button>`,
};

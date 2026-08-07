import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

/**
 * LayoutStructureView — how a page/screen is structured in an Angular web app,
 * from the component tree down to the CSS layout mechanics. Covers the app
 * shell (header + `<router-outlet/>` + drawer), semantic HTML + landmark roles,
 * Angular's built-in structural directives for layout (`@if` / `@for` with
 * `track`), the box model, and the two CSS layout engines (Flexbox + Grid),
 * finishing with this app's own layout primitives (`SectionWrapper` /
 * `ContentGroupWrapper`) and how to compose them.
 *
 * The screen leans on the shared design-system primitives so styling stays
 * consistent with the rest of the app. Interactive demos are kept as local
 * components in this file — they're only used here (see the "single file →
 * local helper" rule). All components are standalone + OnPush and use signals;
 * modern control flow (`@if` / `@for`) is used throughout.
 *
 * NOTE: the exported `LayoutStructureView` component is declared at the BOTTOM
 * of this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

const FLEX_AXES = { row: 'row', column: 'column' } as const;
type FlexAxis = (typeof FLEX_AXES)[keyof typeof FLEX_AXES];

const GRID_COLUMNS = { one: 1, two: 2, three: 3 } as const;
type GridColumns = (typeof GRID_COLUMNS)[keyof typeof GRID_COLUMNS];

const JUSTIFY = {
  start: 'flex-start',
  center: 'center',
  between: 'space-between',
} as const;
type Justify = keyof typeof JUSTIFY;

interface NavTile {
  readonly id: number;
  readonly label: string;
}

/* -------------------------------------------------------------------------- */
/* 1. Component tree — live composition demo                                  */
/* -------------------------------------------------------------------------- */

/**
 * CompositionDemo — a tiny rendered example of "a page is a component tree".
 * The host composes a `<comp-nav>`, a `<comp-content>`, and a `<comp-aside>`
 * into a grid; each of those is itself a small standalone component. The
 * source for the three children is rendered in a CodeBlock beneath the demo.
 */
@Component({
  selector: 'app-comp-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar">
      @for (item of items; track item) {
        <span class="item">{{ item }}</span>
      }
    </nav>
  `,
  styles: [
    `
      .bar {
        display: flex;
        gap: var(--space-sm);
        flex-wrap: wrap;
      }
      .item {
        padding: var(--space-xxs) var(--space-sm);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
      }
    `,
  ],
})
class CompNav {
  readonly items: readonly string[] = ['Home', 'Posts', 'About'];
}

@Component({
  selector: 'app-comp-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="content">
      <h3>Article title</h3>
      <p>A component returns markup; compose components to build pages.</p>
    </article>
  `,
  styles: [
    `
      .content {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      h3 {
        margin: 0;
        font-size: var(--text-title-sm);
        color: var(--color-on-surface);
      }
      p {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class CompContent {}

@Component({
  selector: 'app-comp-aside',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="aside">
      <span class="overline">Related</span>
      <span class="link">Earlier post</span>
    </aside>
  `,
  styles: [
    `
      .aside {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      .overline {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .link {
        font-size: var(--text-caption);
        color: var(--color-primary);
      }
    `,
  ],
})
class CompAside {}

@Component({
  selector: 'app-composition-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CompNav, CompContent, CompAside],
  template: `
    <div class="page-tree">
      <app-comp-nav />
      <div class="body">
        <app-comp-content />
        <app-comp-aside />
      </div>
    </div>
  `,
  styles: [
    `
      .page-tree {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
      }
      .body {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
        align-items: flex-start;
      }
      .body > *:first-child {
        flex: 1 1 240px;
      }
    `,
  ],
})
class CompositionDemo {}

/* -------------------------------------------------------------------------- */
/* 2. Structural directives for layout — @for track demo                      */
/* -------------------------------------------------------------------------- */

/**
 * StructuralLayoutDemo — renders a list of tiles with `@for … track id`.
 * Demonstrates the layout side of Angular's built-in control flow: `@for`
 * repeats elements and `track` gives Angular a stable identity (the equivalent
 * of React's `key`) so it can move DOM nodes instead of re-creating them.
 * Add/remove to see the list re-flow.
 */
@Component({
  selector: 'app-structural-layout-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="solid" (click)="add()">Add tile</button>
      <button type="button" class="ghost" (click)="remove()">Remove last</button>
    </div>

    <ul class="tiles">
      @for (t of tiles(); track t.id) {
        <li class="tile">{{ t.label }}</li>
      } @empty {
        <li class="empty">No tiles — add one above.</li>
      }
    </ul>

    <p class="caption">
      {{ tiles().length }} tile(s) · <code>track t.id</code> keeps DOM stable across edits.
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
      .solid {
        padding: var(--space-xs) var(--space-md);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        background-color: var(--color-primary-container);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .tiles {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .tile {
        padding: var(--space-sm) var(--space-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-primary);
        background-color: var(--color-primary);
        border-radius: var(--radius-md);
      }
      .empty {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-style: italic;
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
class StructuralLayoutDemo {
  private nextId = 0;
  readonly tiles = signal<readonly NavTile[]>([
    { id: this.nextId++, label: 'A' },
    { id: this.nextId++, label: 'B' },
    { id: this.nextId++, label: 'C' },
  ]);

  add(): void {
    const label = String.fromCharCode('A'.charCodeAt(0) + (this.nextId % 26));
    const tile: NavTile = { id: this.nextId++, label };
    this.tiles.update((list) => [...list, tile]);
  }

  remove(): void {
    this.tiles.update((list) => list.slice(0, Math.max(0, list.length - 1)));
  }
}

/* -------------------------------------------------------------------------- */
/* 3. Box model demo                                                          */
/* -------------------------------------------------------------------------- */

/**
 * BoxModelDemo — toggle visibility of the padding layer (inside, tinted) and
 * the margin layer (outside, warning-coloured) around a content box.
 */
@Component({
  selector: 'app-box-model-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="toggle" (click)="show.update((v) => !v)">
      {{ show() ? 'Hide' : 'Show' }} padding &amp; margin
    </button>

    <div
      class="margin-layer"
      [class.active]="show()"
      data-testid="margin-layer"
    >
      <div
        class="padding-layer"
        [class.active]="show()"
      >
        <div class="content">content</div>
      </div>
    </div>

    <p class="caption">
      orange = margin (outside) · teal = padding (inside) · surface = content
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .toggle {
        align-self: flex-start;
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .toggle:hover {
        background-color: var(--color-surface-variant);
      }
      .margin-layer {
        border-radius: var(--radius-md);
      }
      .margin-layer.active {
        background-color: var(--color-warning);
        padding: var(--space-md);
      }
      .padding-layer {
        border-radius: var(--radius-md);
      }
      .padding-layer.active {
        background-color: var(--color-secondary);
        padding: var(--space-md);
      }
      .content {
        padding: var(--space-md);
        border-radius: var(--radius-sm);
        text-align: center;
        background-color: var(--color-surface);
        color: var(--color-on-surface);
      }
      .caption {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class BoxModelDemo {
  readonly show = signal(true);
}

/* -------------------------------------------------------------------------- */
/* 4. Flexbox demo                                                            */
/* -------------------------------------------------------------------------- */

/**
 * FlexDemo — flip the main axis (row ↔ column) and switch `justify-content`.
 * The three tiles are identical; only the container's flex properties change.
 */
@Component({
  selector: 'app-flex-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="controls">
      <div class="group">
        <span class="label">flex-direction</span>
        <div class="chips">
          <button
            type="button"
            class="chip"
            [class.selected]="axis() === FLEX_AXES.row"
            (click)="axis.set(FLEX_AXES.row)"
          >
            row
          </button>
          <button
            type="button"
            class="chip"
            [class.selected]="axis() === FLEX_AXES.column"
            (click)="axis.set(FLEX_AXES.column)"
          >
            column
          </button>
        </div>
      </div>

      <div class="group">
        <span class="label">justify-content</span>
        <div class="chips">
          @for (j of justifyOptions; track j) {
            <button
              type="button"
              class="chip"
              [class.selected]="justify() === j"
              (click)="justify.set(j)"
            >
              {{ j }}
            </button>
          }
        </div>
      </div>
    </div>

    <div
      class="flex-container"
      [style.flex-direction]="axis()"
      [style.justify-content]="JUSTIFY[justify()]"
      data-testid="flex-container"
    >
      @for (t of tiles; track t) {
        <span class="tile">{{ t }}</span>
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
      .controls {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-md);
      }
      .group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .label {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
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
      .flex-container {
        display: flex;
        gap: var(--space-sm);
        padding: var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .tile {
        padding: var(--space-sm) var(--space-md);
        text-align: center;
        color: var(--color-on-primary);
        background-color: var(--color-primary);
        border-radius: var(--radius-md);
      }
    `,
  ],
})
class FlexDemo {
  readonly FLEX_AXES = FLEX_AXES;
  readonly JUSTIFY = JUSTIFY;
  readonly axis = signal<FlexAxis>(FLEX_AXES.row);
  readonly justify = signal<Justify>('start');
  readonly justifyOptions: readonly Justify[] = ['start', 'center', 'between'];
  readonly tiles: readonly string[] = ['A', 'B', 'C'];
}

/* -------------------------------------------------------------------------- */
/* 5. CSS Grid demo                                                           */
/* -------------------------------------------------------------------------- */

/**
 * GridDemo — same six tiles, different `grid-template-columns`. This is the
 * pattern the home navigation grid uses (extended with `auto-fit` for a
 * responsive reflow covered on the Responsive screen).
 */
@Component({
  selector: 'app-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips">
      @for (c of columnOptions; track c) {
        <button
          type="button"
          class="chip"
          [class.selected]="columns() === c"
          (click)="columns.set(c)"
        >
          {{ c }} col{{ c > 1 ? 's' : '' }}
        </button>
      }
    </div>

    <div
      class="grid-container"
      [style.grid-template-columns]="gridTemplate()"
      data-testid="grid-container"
    >
      @for (i of indices; track i) {
        <span class="tile">{{ i }}</span>
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
      .grid-container {
        display: grid;
        gap: var(--space-sm);
        padding: var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
      }
      .tile {
        padding: var(--space-sm) var(--space-md);
        text-align: center;
        color: var(--color-on-surface-variant);
        background-color: var(--color-surface);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        font-size: var(--text-body-sm);
      }
    `,
  ],
})
class GridDemo {
  readonly GRID_COLUMNS = GRID_COLUMNS;
  readonly columns = signal<GridColumns>(GRID_COLUMNS.three);
  readonly columnOptions: readonly GridColumns[] = [
    GRID_COLUMNS.one,
    GRID_COLUMNS.two,
    GRID_COLUMNS.three,
  ];
  readonly indices: readonly number[] = [1, 2, 3, 4, 5, 6];

  gridTemplate(): string {
    return `repeat(${this.columns()}, 1fr)`;
  }
}

/* -------------------------------------------------------------------------- */
/* 6. Layout primitives composition demo                                      */
/* -------------------------------------------------------------------------- */

/**
 * PrimitivesDemo — renders a `<ui-section-wrapper>` containing a
 * `<ui-content-group-wrapper>` built from the SAME shared primitives every
 * other screen uses. The source listing beneath it shows that composition is
 * the whole page's structure.
 */
@Component({
  selector: 'app-primitives-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionWrapper, ContentGroupWrapper, TextBlock],
  template: `
    <ui-section-wrapper title="Rendered with the shared primitives">
      <ui-content-group-wrapper title="ContentGroupWrapper inside SectionWrapper">
        <ui-text-block text="This block is not custom CSS — it is the exact SectionWrapper + ContentGroupWrapper + TextBlock composition every screen on this site uses. Reaching for the shared primitives is what keeps spacing, surface tint, and heading scale consistent across the whole app." />
      </ui-content-group-wrapper>
    </ui-section-wrapper>
  `,
})
class PrimitivesDemo {}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-layout-structure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    CompositionDemo,
    StructuralLayoutDemo,
    BoxModelDemo,
    FlexDemo,
    GridDemo,
    PrimitivesDemo,
  ],
  templateUrl: './layout_structure_view.html',
  styleUrl: './layout_structure_view.scss',
})
export class LayoutStructureView {
  /** Code listings rendered by the page's CodeBlocks. Kept here (not inline in
   *  the HTML) so the template stays readable and the strings get full TS
   *  string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  tree: `// The whole app is one component tree:
// app.ts (shell) -> router-outlet -> matched view -> its children
<App>                  {/* shell: header + <router-outlet> + drawer */}
  <HomeView>           {/* a route's content */}
    <Hero />
    <NavGrid>
      <LinkCard />
      <LinkCard />
    </NavGrid>
  </HomeView>
</App>`,
  shell: `// src/app/app.ts — the shell, declared once and reused by every route.
//   A sticky <header> (back arrow on sub-pages, title, theme toggle,
//   mobile drawer toggle) wrapping <main><router-outlet/></main>.
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, ThemeToggle],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly pathname = signal('/');
  readonly drawerOpen = signal(false);
  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.pathname.set(e.urlAfterRedirects));
  }
}

<!-- src/app/app.html — chrome once, content via the outlet: -->
<div class="shell">
  <header class="header">…</header>
  <main class="main">
    <router-outlet />   <!-- the matched lazy route renders here -->
  </main>
</div>`,
  routes: `// src/app/app.routes.ts — lazy loadComponent keeps the initial
//   bundle tiny; the shell ships, each screen loads on demand.
export const routes: Routes = [
  { path: '', loadComponent: () => import('./views/home/home')
      .then((m) => m.HomeView), title: "Angular developer's guide" },
  { path: 'ui/layout', loadComponent: () =>
      import('./views/ui/layout_structure/layoutstructureview')
      .then((m) => m.LayoutStructureView), title: 'Layout and structure' },
  // …one entry per screen, all lazy-loaded.
  { path: '**', redirectTo: '' },
];`,
  semantic: `<!-- Prefer meaning over <div> soup: -->
<div class="card">            <!-- ❌ tells the browser nothing -->
  <div class="title">Title</div>
</div>

<!-- ✅ semantic elements describe the content's role: -->
<section class="card">        <!-- a thematic grouping -->
  <header><h2>Title</h2></header>
  <p>Body…</p>
  <footer>Footnote</footer>
</section>

<nav>       <!-- navigation links -->
<main>      <!-- the page's primary content (one per page) -->
<aside>     <!-- tangentially related (sidebar) -->
<article>   <!-- self-contained (a post, a card) -->
<ul>/<li>   <!-- a list of items -->
<button>    <!-- a clickable action (not <div (click)>) -->`,
  landmarks: `<!-- Landmarks come free with semantic elements. Each gives a screen
     reader a jump target; keep one <main> per page. -->
<header role="banner">       <!-- or just <header> at the page top -->
<nav role="navigation">       <!-- or just <nav> -->
<main role="main">            <!-- or just <main> -->
<aside role="complementary">  <!-- or just <aside> -->
<footer role="contentinfo">   <!-- or just <footer> -->
<form role="search">          <!-- explicit role for search forms -->

<!-- Prefer the native element over the role: the element already
     exposes the role, so adding it is redundant. Use role="" only
     when you can't use the element (e.g. a <div> acting as a button). -->`,
  structural: `<!-- @if / @else — either/or, no import needed -->
@if (isLoggedIn()) {
  <app-dashboard />
} @else {
  <app-sign-in />
}

<!-- @for — "track" is the equivalent of React's "key" -->
<ul>
  @for (t of tasks(); track t.id) {
    <li>{{ t.label }}</li>
  } @empty {
    <li>No tasks yet.</li>
  }
</ul>`,
  box: `/* global reset in this app — widths include padding & border: */
* { box-sizing: border-box; }

.card {
  width: 320px;     /* with border-box: the WHOLE box is 320px */
  padding: 16px;    /* space inside, fills with the card's bg */
  border: 1px solid #ccc;
  margin: 8px;      /* space outside, transparent, can collapse */
}`,
  flex: `<!-- Container lays items out on one axis (row by default). -->
<div class="row">
  <span>A</span>
  <span>B</span>
  <span>C</span>
</div>

.row {
  display: flex;
  flex-direction: row;       /* or "column" */
  gap: var(--space-sm);
  align-items: center;       /* cross axis */
  justify-content: flex-start; /* main axis: start | center | space-between */
}

.item {
  flex: 1;                   /* grow to fill remaining space */
}`,
  grid: `<!-- Two-dimensional layout: rows AND columns at once. -->
<nav class="grid">
  <app-card />
  <app-card />
  <app-card />
</nav>

.grid {
  display: grid;
  gap: var(--space-sm);
  /* fixed columns: */
  grid-template-columns: repeat(3, 1fr);
  /* responsive reflow WITHOUT media queries (used on Home): */
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}`,
  primitives: `<!-- The building blocks (all in src/ui/components). A new screen is
     mostly composition, not CSS. -->
<ui-section-wrapper title="Layout and structure">
  <ui-content-group-wrapper title="A labelled sub-grouping">
    <ui-text-block text="A paragraph of body text." />
    <ui-code-block language="ts" [code]="source" />
    <ui-example label="Live demo">
      <app-something />
    </ui-example>
  </ui-content-group-wrapper>
</ui-section-wrapper>

<!-- Rule of thumb: used in one file → local helper (a component in THIS
     folder). Used across files → src/ui/components. -->`,
};

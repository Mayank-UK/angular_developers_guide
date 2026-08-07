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
 * BootstrapView — Bootstrap taught in isolation, not adopted app-wide.
 *
 * This app's source of truth for styling is its OWN token design system
 * (`src/ui/design-system/tokens.css` consumed via `var(--…)`). Bootstrap is
 * shown here for comparison and so the trade-offs are concrete — it is NOT
 * wired into the app globally.
 *
 * To make the demos render with REAL Bootstrap (real `.btn`, `.card`, grid,
 * alerts) without leaking Bootstrap's CSS to every other route, this view
 * attaches the official Bootstrap CSS via a `<link>` to the CDN in `ngOnInit`
 * and REMOVES it in `onDestroy`. The trade-off: while THIS screen is mounted
 * the link is technically global (Bootstrap's element-selector resets, e.g.
 * `body`/button typography, briefly affect the whole document), so the prose
 * calls that out and the link is removed the moment the user navigates away.
 * No other route ever sees Bootstrap.
 *
 * Coverage: what Bootstrap is, the three ways to add it in Angular (and the
 * scoping trade-offs), the 12-column grid (containers/rows/cols/breakpoints),
 * core components (buttons, badges, cards, alerts, forms, navbar), utilities
 * (spacing/flex/text), and a comparison against this app's token system.
 *
 * Live, rendered demos (each paired with the code that produces it):
 *   - Grid (interactive col-split swap with real Bootstrap columns)
 *   - Buttons + badges (variants + sizes)
 *   - Card + dismissible alerts
 *   - Form (form-control / form-select / form-check, signal-driven)
 *   - Navbar (static — Bootstrap's JS bundle is intentionally not loaded)
 *   - Utilities (spacing / flex / text)
 *
 * The shared design-system primitives (`SectionWrapper`,
 * `ContentGroupWrapper`, `TextBlock`, `CodeBlock`, `Example`) wrap the teaching
 * chrome; the live demos inside render ACTUAL Bootstrap classes. Single-use
 * helpers live in this file; all components are standalone + OnPush and use
 * signals + const-object literal unions (never enums).
 *
 * NOTE: the exported `BootstrapView` component is declared at the BOTTOM of
 * this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come
 * after every helper it names — otherwise the decorator would read an
 * uninitialized binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

/** A grid split the user can flip between in the live grid demo. */
interface GridSplit {
  readonly id: 'halves' | 'thirds' | 'two-fourth' | 'single';
  readonly label: string;
  /** Bootstrap column classes per cell, e.g. ['col-12', 'col-md-6', 'col-lg-6']. */
  readonly cellClasses: readonly string[];
  /** How many cells to render. */
  readonly cells: number;
}

const GRID_SPLITS: readonly GridSplit[] = [
  {
    id: 'single',
    label: 'col-12 (full width)',
    cellClasses: ['col-12'],
    cells: 1,
  },
  {
    id: 'halves',
    label: 'col-12 col-md-6 (halves)',
    cellClasses: ['col-12', 'col-md-6'],
    cells: 2,
  },
  {
    id: 'thirds',
    label: 'col-12 col-md-4 (thirds)',
    cellClasses: ['col-12', 'col-md-4'],
    cells: 3,
  },
  {
    id: 'two-fourth',
    label: 'col-12 col-md-8 / col-12 col-md-4',
    cellClasses: ['col-12 col-md-8', 'col-12 col-md-4'],
    cells: 2,
  },
];

/* -------------------------------------------------------------------------- */
/* 1. Grid demo — interactive col-split swap                                  */
/* -------------------------------------------------------------------------- */

/**
 * GridDemo — picks a split, renders real Bootstrap `.container > .row > .col-*`.
 * Resize the viewport (or just trust the classes) to see the breakpoints kick
 * in: every split stacks full-width on mobile via `col-12` and only fans out
 * at `md` and above.
 */
@Component({
  selector: 'app-bootstrap-grid-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chips">
      @for (s of splits; track s.id) {
        <button
          type="button"
          class="chip"
          [class.selected]="selected().id === s.id"
          (click)="selected.set(s)"
        >
          {{ s.label }}
        </button>
      }
    </div>

    <!-- Real Bootstrap container / row / col. Bootstrap is loaded by the host. -->
    <div class="container bsd-container">
      <div class="row g-3">
        @for (i of cells; track i) {
          <div [class]="cellClass(i)">
            <div class="cell">cell {{ i }}</div>
          </div>
        }
      </div>
    </div>

    <p class="caption">
      Resize the window: each split stacks at <code>col-12</code> on mobile and
      fans out at the <code>md</code> breakpoint (≥ 768px). Bootstrap's
      <code>.g-3</code> adds the gutter between columns.
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
        cursor: pointer;
      }
      .chip:hover {
        background-color: var(--color-surface-variant);
      }
      .chip.selected {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      /* Bootstrap's .container sets a max-width + centres; for the demo strip
         we let it breathe wider so the grid is visible inside the example. */
      .bsd-container {
        max-width: none;
        padding: 0;
      }
      .cell {
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        font-size: var(--text-body-sm);
        font-weight: 500;
        text-align: center;
      }
      .caption {
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
class GridDemo {
  readonly splits: readonly GridSplit[] = GRID_SPLITS;
  readonly selected = signal<GridSplit>(GRID_SPLITS[1]!);

  /** 1-based cell index array for the current split. */
  get cells(): readonly number[] {
    return Array.from({ length: this.selected().cells }, (_, i) => i + 1);
  }

  /** Returns the Bootstrap col class for the i-th (1-based) cell. */
  cellClass(i: number): string {
    const classes = this.selected().cellClasses;
    // For the two-fourth split the two cells have DIFFERENT classes.
    if (classes.length === this.selected().cells) {
      return classes[i - 1]!;
    }
    // Otherwise every cell shares the same single class string.
    return classes[0]!;
  }
}

/* -------------------------------------------------------------------------- */
/* 2. Buttons + badges                                                        */
/* -------------------------------------------------------------------------- */

/**
 * ButtonsBadgesDemo — real `.btn` variants/sizes and `.badge` counts. Pure
 * markup; Bootstrap does all the work.
 */
@Component({
  selector: 'app-bootstrap-buttons-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bsd-group">
      <span class="bsd-label">variants</span>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary">Primary</button>
        <button type="button" class="btn btn-secondary">Secondary</button>
        <button type="button" class="btn btn-success">Success</button>
        <button type="button" class="btn btn-danger">Danger</button>
        <button type="button" class="btn btn-warning">Warning</button>
        <button type="button" class="btn btn-outline-primary">Outline</button>
      </div>
    </div>

    <div class="bsd-group">
      <span class="bsd-label">sizes &amp; state</span>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button type="button" class="btn btn-primary btn-lg">Large</button>
        <button type="button" class="btn btn-primary">Default</button>
        <button type="button" class="btn btn-primary btn-sm">Small</button>
        <button type="button" class="btn btn-primary" disabled>Disabled</button>
      </div>
    </div>

    <div class="bsd-group">
      <span class="bsd-label">badges</span>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <span class="badge text-bg-primary">Primary</span>
        <span class="badge text-bg-secondary">Secondary</span>
        <span class="badge rounded-pill text-bg-success">Pill</span>
        <button type="button" class="btn btn-primary position-relative">
          Inbox
          <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill text-bg-danger">
            9
          </span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .bsd-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .bsd-label {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ButtonsBadgesDemo {}

/* -------------------------------------------------------------------------- */
/* 3. Card + dismissible alerts                                               */
/* -------------------------------------------------------------------------- */

/**
 * CardAlertDemo — a real `.card` and four `.alert` variants. Alerts are
 * dismissible: clicking the close button sets a signal that hides that alert
 * (Bootstrap's JS would do this automatically; we load CSS only, so the
 * dismiss is wired with a signal + `@if`).
 */
@Component({
  selector: 'app-bootstrap-card-alert-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-start gap-3">
      <div class="card" style="width: 18rem;">
        <div class="card-body">
          <h5 class="card-title">Card title</h5>
          <h6 class="card-subtitle mb-2 text-body-secondary">Card subtitle</h6>
          <p class="card-text">
            A Bootstrap card is a flexible container with a padded
            <code>.card-body</code> and titled/ text helpers.
          </p>
          <a href="#" class="btn btn-primary">Action</a>
        </div>
      </div>

      <div class="alerts">
        @for (a of alertStates; track a.id) {
          @if (!dismissed()[a.id]) {
            <div
              class="alert alert-{{ a.variant }} alert-dismissible fade show d-flex align-items-center"
              role="alert"
            >
              <strong>{{ a.title }}</strong>
              <span class="ms-2">{{ a.body }}</span>
              <button
                type="button"
                class="btn-close"
                aria-label="Close"
                (click)="dismiss(a.id)"
              ></button>
            </div>
          }
        }
        @if (allDismissed()) {
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="reset()">
            Restore alerts
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .alerts {
        flex: 1 1 280px;
        min-width: 240px;
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class CardAlertDemo {
  readonly alertStates = [
    { id: 'success', variant: 'success', title: 'Saved.', body: 'Your changes are stored.' },
    { id: 'warning', variant: 'warning', title: 'Heads up.', body: 'This draft is unsaved.' },
    { id: 'danger', variant: 'danger', title: 'Error.', body: 'Could not reach the server.' },
    { id: 'info', variant: 'info', title: 'Tip.', body: 'Press ⌘K to search.' },
  ] as const;

  /** dismissal state per alert id — a plain record kept in a signal. */
  readonly dismissed = signal<Record<string, boolean>>({});

  dismiss(id: string): void {
    this.dismissed.update((m) => ({ ...m, [id]: true }));
  }

  reset(): void {
    this.dismissed.set({});
  }

  allDismissed(): boolean {
    return this.alertStates.every((a) => this.dismissed()[a.id]);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. Form                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * FormDemo — real Bootstrap form controls wired to signals. Two-way value
 * flows via `[value]` + `(input)`; the readout below is the app's own
 * design-system typography, proving the two systems coexist on one page.
 */
@Component({
  selector: 'app-bootstrap-form-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="bsd-form" (submit)="$event.preventDefault()">
      <div class="mb-3">
        <label for="bsd-name" class="form-label">Name</label>
        <input
          id="bsd-name"
          type="text"
          class="form-control"
          placeholder="Ada Lovelace"
          [value]="name()"
          (input)="onName($event)"
        />
      </div>

      <div class="mb-3">
        <label for="bsd-role" class="form-label">Role</label>
        <select
          id="bsd-role"
          class="form-select"
          [value]="role()"
          (change)="onRole($event)"
        >
          @for (r of roles; track r) {
            <option [value]="r">{{ r }}</option>
          }
        </select>
      </div>

      <div class="mb-3 form-check">
        <input
          id="bsd-sub"
          type="checkbox"
          class="form-check-input"
          [checked]="subscribed()"
          (change)="subscribed.set(!subscribed())"
        />
        <label class="form-check-label" for="bsd-sub">Email me updates</label>
      </div>

      <button type="submit" class="btn btn-primary">Submit</button>
    </form>

    <p class="readout">
      <strong>{{ name() || '—' }}</strong> · {{ role() }} ·
      <span>{{ subscribed() ? 'subscribed' : 'not subscribed' }}</span>
    </p>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .bsd-form {
        max-width: 420px;
      }
      .readout {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
        max-width: 420px;
      }
    `,
  ],
})
class FormDemo {
  readonly roles = ['Engineer', 'Designer', 'Product manager'] as const;
  readonly name = signal('');
  readonly role = signal<string>(this.roles[0]!);
  readonly subscribed = signal(false);

  onName(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onRole(event: Event): void {
    this.role.set((event.target as HTMLSelectElement).value);
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Navbar (static)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * NavbarDemo — a simplified static Bootstrap navbar. The collapse/toggle
 * behaviour needs Bootstrap's JS bundle, which is intentionally NOT loaded
 * here (CSS only), so the links are shown inline and that's called out in
 * prose. This is itself a teaching point: Bootstrap's interactive components
 * need its JS, and in Angular you'd reach for `ng-bootstrap`/`ngx-bootstrap`
 * instead of `bootstrap.bundle.js`.
 */
@Component({
  selector: 'app-bootstrap-navbar-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="navbar navbar-expand-lg bg-body-tertiary rounded">
      <div class="container-fluid">
        <a class="navbar-brand" href="#">Brand</a>
        <div class="d-flex">
          <ul class="navbar-nav flex-row gap-3">
            <li class="nav-item">
              <a class="nav-link active" aria-current="page" href="#">Home</a>
            </li>
            <li class="nav-item"><a class="nav-link" href="#">Docs</a></li>
            <li class="nav-item"><a class="nav-link disabled" aria-disabled="true">Pro</a></li>
          </ul>
        </div>
      </div>
    </nav>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
class NavbarDemo {}

/* -------------------------------------------------------------------------- */
/* 6. Utilities (spacing / flex / text)                                       */
/* -------------------------------------------------------------------------- */

/**
 * UtilitiesDemo — the same handful of utility classes (`.d-flex`, `.gap-3`,
 * `.mt-3`, `.p-3`, `.text-center`, `.fw-bold`, `.text-bg-*`) rendered live.
 * Each tile is pure Bootstrap utilities — no custom CSS on the tiles themselves.
 */
@Component({
  selector: 'app-bootstrap-utilities-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- spacing + colour utilities -->
    <div class="p-3 mb-3 rounded text-bg-primary">
      <code>.p-3 .mb-3 .text-bg-primary</code> — padding + margin + colour
      utilities compose into a tinted box.
    </div>

    <!-- flex utilities -->
    <div class="d-flex justify-content-between align-items-center mb-3 p-3 bg-body-secondary rounded">
      <span class="fw-bold">.d-flex .justify-content-between</span>
      <span class="badge text-bg-secondary">.badge</span>
    </div>

    <!-- text utilities -->
    <div class="text-center text-danger fw-bold text-uppercase mb-3">
      .text-center .text-danger .fw-bold .text-uppercase
    </div>

    <!-- spacing scale (mt-0 → mt-5) -->
    <div class="d-flex flex-column align-items-start gap-1">
      <span>.mt-0</span>
      <div class="w-25 py-1 bg-primary-subtle border border-primary rounded mt-0"></div>
      <span>.mt-3</span>
      <div class="w-25 py-1 bg-primary-subtle border border-primary rounded mt-3"></div>
      <span>.mt-5</span>
      <div class="w-25 py-1 bg-primary-subtle border border-primary rounded mt-5"></div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class UtilitiesDemo {}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-bootstrap-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    GridDemo,
    ButtonsBadgesDemo,
    CardAlertDemo,
    FormDemo,
    NavbarDemo,
    UtilitiesDemo,
  ],
  templateUrl: './bootstrap_view.html',
  styleUrl: './bootstrap_view.scss',
})
export class BootstrapView implements OnInit {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;

  private readonly doc = inject(DOCUMENT);

  /**
   * Bootstrap is attached here as a CDN `<link>` while this screen is mounted
   * and removed on destroy. Held so `DestroyRef` can detach it deterministically.
   * NOTE: while mounted it IS global — see the prose block in the template
   * (the "scoping" section) for why this is the cleanest option for a teaching
   * screen and what the trade-off is.
   */
  private link: HTMLLinkElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.link) {
        this.link.remove();
        this.link = null;
      }
    });
  }

  ngOnInit(): void {
    // Guard against double-attach (e.g. strict-mode double effect runs).
    const existing = this.doc.querySelector<HTMLLinkElement>(
      'link[data-bootstrap-demo="true"]',
    );
    if (existing) {
      this.link = existing;
      return;
    }
    const link = this.doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    link.setAttribute('data-bootstrap-demo', 'true');
    this.doc.head.appendChild(link);
    this.link = link;
  }
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  install: `# Bootstrap ships a pre-built CSS bundle (and optional JS bundle
# for the interactive components: dropdowns, modals, collapses…).
npm install bootstrap

// In Angular, load the CSS ONCE globally (src/styles.scss):
@import 'bootstrap/dist/css/bootstrap.min.css';

// Or register it under "styles" in angular.json:
//   "styles": ["node_modules/bootstrap/dist/css/bootstrap.min.css", "src/styles.scss"]`,
  threeWays: `// Three ways to add Bootstrap in Angular — pick by how isolated you want it.

// 1. GLOBAL via angular.json "styles" (most common). Affects the WHOLE app.
//    "styles": ["node_modules/bootstrap/dist/css/bootstrap.min.css", "src/styles.scss"]

// 2. GLOBAL via CDN <link> in src/index.html <head>.
//    <link rel="stylesheet"
//          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">

// 3. SCOPED to one route/component — attach the <link> on init, remove on destroy.
//    (This is what THIS screen does so Bootstrap never reaches the rest of the app.)
@Component({ /* … */ })
export class BootstrapView implements OnInit {
  private readonly doc = inject(DOCUMENT);
  private link: HTMLLinkElement | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.link?.remove());
  }

  ngOnInit() {
    const link = this.doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
    this.doc.head.appendChild(link);
    this.link = link;
  }
}`,
  grid: `<!-- Bootstrap's layout is a 12-column grid: container > row > col-*.
     Breakpoints are baked into the class name: col-<bp>-<span>. -->
<div class="container">
  <div class="row">
    <!-- full width on mobile, half on md+, third on lg+ -->
    <div class="col-12 col-md-6 col-lg-4">A</div>
    <div class="col-12 col-md-6 col-lg-4">B</div>
    <div class="col-12 col-md-6 col-lg-4">C</div>
  </div>
</div>

<!-- Breakpoint ladder (min-width, mobile-first):
     col-     → xs (always)
     col-sm-  → ≥ 576px
     col-md-  → ≥ 768px
     col-lg-  → ≥ 992px
     col-xl-  → ≥ 1200px
     col-xxl- → ≥ 1400px -->`,
  components: `<!-- Buttons: a base .btn plus a variant. -->
<button type="button" class="btn btn-primary">Save</button>
<button type="button" class="btn btn-outline-danger">Delete</button>
<button type="button" class="btn btn-primary btn-sm">Small</button>

<!-- Badges: counts and tags. -->
<span class="badge text-bg-secondary">New</span>
<button class="btn btn-primary position-relative">
  Inbox
  <span class="position-absolute top-0 start-100 translate-middle
               badge rounded-pill text-bg-danger">9</span>
</button>

<!-- Card: a flexible content container. -->
<div class="card" style="width: 18rem;">
  <div class="card-body">
    <h5 class="card-title">Title</h5>
    <p class="card-text">Some quick example text.</p>
    <a href="#" class="btn btn-primary">Go</a>
  </div>
</div>

<!-- Alerts: contextual feedback. .alert-dismissible needs Bootstrap's JS
     to close; without it, wire the close yourself (signal + @if). -->
<div class="alert alert-success" role="alert">Saved.</div>`,
  form: `<!-- Bootstrap form pattern: .mb-3 rows, .form-label + .form-control / .form-select. -->
<form>
  <div class="mb-3">
    <label for="name" class="form-label">Name</label>
    <input id="name" type="text" class="form-control" placeholder="Ada Lovelace" />
  </div>

  <div class="mb-3">
    <label for="role" class="form-label">Role</label>
    <select id="role" class="form-select">
      <option>Engineer</option>
      <option>Designer</option>
    </select>
  </div>

  <div class="mb-3 form-check">
    <input id="sub" type="checkbox" class="form-check-input" />
    <label for="sub" class="form-check-label">Email me updates</label>
  </div>

  <button type="submit" class="btn btn-primary">Submit</button>
</form>`,
  navbar: `<!-- A static navbar. The expand/collapse toggle (navbar-toggler) needs
     Bootstrap's JS bundle. In Angular prefer ng-bootstrap / ngx-bootstrap,
     which reimplement those behaviours as directives — NOT bootstrap.bundle.js. -->
<nav class="navbar navbar-expand-lg bg-body-tertiary">
  <div class="container-fluid">
    <a class="navbar-brand" href="#">Brand</a>
    <ul class="navbar-nav">
      <li class="nav-item"><a class="nav-link active" aria-current="page" href="#">Home</a></li>
      <li class="nav-item"><a class="nav-link" href="#">Docs</a></li>
    </ul>
  </div>
</nav>`,
  utilities: `<!-- Spacing: {m|p}{t|b|l|r|x|y}-{0..5}. "m" = margin, "p" = padding. -->
<div class="mt-3 mb-2 p-3 bg-body-secondary rounded">spaced box</div>

<!-- Flex: d-flex + justify-content-* + align-items-* + gap-* -->
<div class="d-flex justify-content-between align-items-center gap-3">
  <span>left</span><span>right</span>
</div>

<!-- Text: text-center, fw-bold, text-uppercase, text-danger, text-bg-primary -->
<div class="text-center fw-bold text-uppercase text-danger">label</div>`,
  comparison: `<!-- Same button, two philosophies. This app uses its OWN token system.

     Bootstrap: pick a pre-designed component class. Fast, opinionated. -->
<button class="btn btn-primary">Save</button>

<!-- This app: compose the look from var(--…) tokens (no default look to fight).
     .btn-primary's #0d6efd is Bootstrap's brand; ours is var(--color-primary). -->
<button class="app-btn-primary">Save</button>

/* The app's own button — consumes design-system tokens, no framework. */
.app-btn-primary {
  padding: var(--space-xs) var(--space-md);
  border: none;
  border-radius: var(--radius-md);
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-button-card);
}
.app-btn-primary:hover { background-color: var(--color-primary-container); }`,
  jsNote: `// Bootstrap's interactive components (dropdown, modal, collapse, offcanvas,
// toast, tab) need its JavaScript. In an Angular app you have three options:

// 1. Load the bundle once (NOT recommended — it mutates the DOM outside
//    Angular's change detection and fights its renderer):
//    <script src="bootstrap/dist/js/bootstrap.bundle.min.js"></script>

// 2. Use an Angular-native port — RECOMMENDED:
//    ng-bootstrap (ng-bootstrap.github.io) or ngx-bootstrap. They reimplement
//    every interactive component as a standalone directive/component driven by
//    templates + signals, so change detection stays intact.

// 3. Drive the few classes yourself with signals + @if (what the dismissible
//    alert on this screen does — no JS dependency at all).`,
};

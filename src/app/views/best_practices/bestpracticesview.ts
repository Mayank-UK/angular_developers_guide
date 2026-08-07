import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';

/**
 * BestPracticesView — the capstone "how to do things the BEST way in Angular"
 * reference: performance, efficiency, maintainability.
 *
 * This is not a list of invented rules. Each item below is the fix for a
 * specific failure mode — a slow re-render, a stale view, a leak, an
 * inaccessible button, a refactor that breaks because the wrong thing was
 * optimised. The throughline: change detection is cheap until it isn't, code
 * is readable until it isn't, and both are defended by the same handful of
 * habits. Write the clear version first, profile when something is actually
 * slow, then apply the targeted fix.
 *
 * This screen is ALSO the quality bar the rest of the app is held to. Every
 * practice below is one this codebase already follows (OnPush + signals across
 * all views, `inject()` everywhere, `loadComponent` lazy routes, `track` in
 * every `@for`, const-object + literal-union instead of enums, the DI seam
 * that keeps views free of DTO/DAO/HttpClient imports). The do/don't pairs
 * cite real do-examples from the app; the live demos make the abstract claims
 * visible — an OnPush vs default change-detection visualizer, and a
 * `track $index` vs `track item.id` list that scrambles component state when
 * you get it wrong.
 *
 * NOTE: the exported `BestPracticesView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper components (DoDontCard,
 * ChangeDetectionDemo, TrackComparisonDemo) that are block-scoped declarations
 * — the main component must come AFTER every helper it names so its decorator
 * does not read an uninitialized binding at module-evaluation time (the TDZ
 * rule the other view screens follow).
 */

/* -------------------------------------------------------------------------- */
/* Local live demos + helpers — declared BEFORE the exported view (TDZ rule).  */
/* -------------------------------------------------------------------------- */

/**
 * DoDontCard — a polished, side-by-side Do ✅ / Don't ❌ comparison card with
 * two CodeBlocks. The single most-used structural primitive on this screen:
 * every practice is shown as a concrete do-vs-don't pair rather than prose
 * alone, because the difference is almost always visible in three lines of
 * code. Reused across the OnPush, track, standalone, lazy, signals-vs-RxJS,
 * inject-vs-constructor, DestroyRef, computed, typed-forms, and a11y sections.
 */
@Component({
  selector: 'app-do-dont',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeBlock],
  template: `
    <div class="card">
      <p class="card-title">{{ title() }}</p>
      @if (prose()) {
        <p class="card-prose">{{ prose() }}</p>
      }
      <div class="pair">
        <div class="col col-do">
          <span class="badge badge-do">&#9989; Do</span>
          <ui-code-block
            [code]="doCode()"
            [language]="language()"
            [defaultOpen]="true"
          />
        </div>
        <div class="col col-dont">
          <span class="badge badge-dont">&#10060; Don't</span>
          <ui-code-block
            [code]="dontCode()"
            [language]="language()"
            [defaultOpen]="true"
          />
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .card-title {
        margin: 0;
        font-size: var(--text-title-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .card-prose {
        margin: 0;
        font-size: var(--text-body-sm);
        line-height: 1.7;
        color: var(--color-on-surface-variant);
        white-space: pre-line;
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--space-sm);
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .badge {
        align-self: flex-start;
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-pill);
        font-size: var(--text-overline);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .badge-do {
        color: var(--color-on-secondary);
        background: var(--color-secondary);
      }
      .badge-dont {
        color: var(--color-on-error);
        background: var(--color-error);
      }
    `,
  ],
})
export class DoDontCard {
  readonly title = input.required<string>();
  readonly prose = input<string>('');
  readonly doCode = input.required<string>();
  readonly dontCode = input.required<string>();
  readonly language = input<string>('ts');
}

/* -------------------------------------------------------------------------- */
/* CD-demo children — declared BEFORE the visualizer that imports them (TDZ).  */
/* -------------------------------------------------------------------------- */

/**
 * OnPushChild — OnPush component that reads its signal input `value`. Its
 * render count ticks ONLY when `value` changes (or an event fires from inside
 * it). The whole point of the demo.
 */
@Component({
  selector: 'app-onpush-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="row">
      <span class="label">value()</span>
      <code>{{ value() }}</code>
      <span class="label">renders</span>
      <strong class="count">{{ renderTick() }}</strong>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .label {
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
        color: var(--color-primary);
      }
      .count {
        margin-left: auto;
        font-family: var(--font-mono);
        color: var(--color-secondary);
      }
    `,
  ],
})
class OnPushChild {
  readonly value = input.required<number>();
  private renders = 0;

  /** Visualisation escape hatch — counts change-detection visits. */
  renderTick(): number {
    return ++this.renders;
  }
}

/**
 * DefaultChild — same template + same input, but DEFAULT change detection
 * (no OnPush). Its render count ticks on every CD pass over the parent,
 * including the noise click that changed nothing. The contrast that earns
 * OnPush its keep.
 */
@Component({
  selector: 'app-default-child',
  // NOTE: ChangeDetectionStrategy.Default omitted on purpose — this is the one
  // place in the whole app that ships default CD, and only to make the demo
  // honest. Every other component is OnPush.
  imports: [],
  template: `
    <div class="row">
      <span class="label">value()</span>
      <code>{{ value() }}</code>
      <span class="label">renders</span>
      <strong class="count">{{ renderTick() }}</strong>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .label {
        font-size: var(--text-overline);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      code {
        font-family: var(--font-mono);
        color: var(--color-primary);
      }
      .count {
        margin-left: auto;
        font-family: var(--font-mono);
        color: var(--color-error);
      }
    `,
  ],
})
class DefaultChild {
  /** Signal input — read as value() in the template like every other component. */
  readonly value = input.required<number>();
  private renders = 0;

  /** Visualisation escape hatch — counts change-detection visits. */
  renderTick(): number {
    return ++this.renders;
  }
}

/* -------------------------------------------------------------------------- */
/* CENTERPIECE #1 — OnPush + signals vs default change detection.             */
/* -------------------------------------------------------------------------- */

/**
 * ChangeDetectionVisualizer — the live performance demo. Two sibling children
 * rendered by the same parent, each with a "render count" that ticks every
 * time Angular's change detection visits the component's template. The parent
 * offers two buttons: "bump value (signal write)" — the only thing either
 * child actually reads — and "fire noise event" — a button click that triggers
 * a change-detection pass on the whole tree WITHOUT changing the value.
 *
 * What you see:
 *  • On the noise click, the OnPush child's count stays FLAT (its signal input
 *    didn't change, so OnPush skips it) while the default-CD child's count
 *    climbs on every click.
 *  • On the value bump, BOTH counts climb — OnPush still re-renders when the
 *    signal it reads actually changes.
 *
 * That gap — multiplied across a real component tree on a busy page — is the
 * entire case for OnPush + signals. A signal write schedules change detection
 * on exactly the components that read it; no zone, no markForCheck, no stale
 * view, and (the modern direction) no zone.js at all.
 *
 * NOTE on the render-counting technique: a method invoked from the template
 * binding `{{ renderTick() }}` is re-evaluated on every change-detection pass
 * over that template, so incrementing a counter inside it is the documented
 * way to count CD visits (there is no effect-free way to observe CD). It is a
 * visualisation escape hatch, not a pattern to ship.
 */
@Component({
  selector: 'app-cd-visualizer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OnPushChild, DefaultChild],
  template: `
    <div class="demo">
      <div class="controls">
        <button type="button" class="btn" (click)="bumpValue()">
          bump value (signal write)
        </button>
        <button type="button" class="btn btn-ghost" (click)="fireNoise()">
          fire noise event (CD, no signal change)
        </button>
      </div>

      <div class="readout">
        <span class="pill">value signal: <strong>{{ value() }}</strong></span>
        <span class="pill pill-ghost">noise clicks: <strong>{{ noise() }}</strong></span>
      </div>

      <div class="pair">
        <div class="col">
          <div class="col-head">
            <span class="tag tag-good">OnPush + signal input</span>
            <span class="sub">re-renders only when value() changes</span>
          </div>
          <div class="stage">
            <app-onpush-child [value]="value()" />
          </div>
          <p class="explain">
            Inputs are signals; OnPush skips this subtree when nothing it reads
            has changed. The noise click fires a CD pass that touches the parent
            and the default child but leaves this child alone.
          </p>
        </div>

        <div class="col">
          <div class="col-head">
            <span class="tag tag-bad">Default change detection</span>
            <span class="sub">re-renders on every CD pass</span>
          </div>
          <div class="stage">
            <app-default-child [value]="value()" />
          </div>
          <p class="explain">
            Without OnPush, Angular checks this component on every pass —
            including the noise click that changed nothing it reads. On a real
            page this is the slow path.
          </p>
        </div>
      </div>
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
      .btn {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-md);
        background: var(--color-primary);
        color: var(--color-on-primary);
        font-family: inherit;
        font-size: var(--text-body-sm);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }
      .btn:hover {
        background: var(--color-primary-container);
        border-color: var(--color-primary-container);
      }
      .btn-ghost {
        background: transparent;
        color: var(--color-on-surface);
        border-color: var(--color-outline);
      }
      .btn-ghost:hover {
        background: var(--color-surface-tint);
        border-color: var(--color-on-surface-variant);
      }
      .readout {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .pill {
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-pill);
        background: var(--color-surface-tint);
        border: 1px solid var(--color-outline);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
      }
      .pill strong {
        color: var(--color-primary);
      }
      .pill-ghost {
        background: transparent;
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: var(--space-sm);
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .col-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tag {
        align-self: flex-start;
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-pill);
        font-size: var(--text-overline);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .tag-good {
        color: var(--color-on-secondary);
        background: var(--color-secondary);
      }
      .tag-bad {
        color: var(--color-on-error);
        background: var(--color-error);
      }
      .sub {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .stage {
        padding: var(--space-sm);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .explain {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ChangeDetectionVisualizer {
  /** The signal both children read as an input. */
  readonly value = signal(0);
  /** Noise counter — proves the click fires a CD pass without touching value. */
  readonly noise = signal(0);

  bumpValue(): void {
    this.value.update((v) => v + 1);
  }

  fireNoise(): void {
    this.noise.update((n) => n + 1);
  }
}

/* -------------------------------------------------------------------------- */
/* CENTERPIECE #2 — `track $index` vs `track item.id` in `@for`.              */
/* -------------------------------------------------------------------------- */

interface TrackRow {
  readonly id: number;
  readonly name: string;
}

/**
 * TrackItem — one row in the list. Holds LOCAL state (a `note` signal bound to
 * a text input) that must travel with the item when the list mutates. This is
 * the state whose loss makes `track $index` a correctness bug, not a perf tip:
 * delete the second of three rows and the third row's TrackItem — its note,
 * its focus, its component state — gets handed to the second row's id.
 */
@Component({
  selector: 'app-track-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="row">
      <span class="id">#{{ row().id }}</span>
      <span class="name">{{ row().name }}</span>
      <input
        class="note"
        type="text"
        #noteInput
        [value]="note()"
        (input)="note.set(noteInput.value)"
        placeholder="type a note…"
        aria-label="note for row"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .id {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        min-width: 28px;
      }
      .name {
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
        min-width: 70px;
      }
      .note {
        flex: 1;
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background: var(--color-surface-variant);
        color: var(--color-on-surface);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        outline: none;
      }
      .note:focus {
        border-color: var(--color-primary);
      }
    `,
  ],
})
class TrackItem {
  readonly row = input.required<TrackRow>();
  /** Local component state — what gets scrambled by `track $index`. */
  readonly note = signal('');
}

/**
 * TrackComparisonDemo — two lists rendered from the same source array, each
 * rendered with a different `track` expression. Type a unique note into each
 * row, then delete one from the middle:
 *
 *  • Right column (`track row.id`) — the notes travel with their row. The
 *    component instance is keyed by id, so deleting id=2 leaves id=3's note
 *    untouched. Correct.
 *  • Left column (`track $index`) — Angular reuses the component instance at
 *    each position, so id=3's component (and its note) is now shown against
 *    id=2's data. The notes appear to "shift up". That is data loss.
 *
 * Angular REQUIRES a `track` expression in every `@for` (it is a build error
 * without one), so the bug is never "forgot track" — it is "chose the wrong
 * expression". Use a real id from the data; reach for `$index` only for pure
 * presentational lists that hold no component state and never mutate.
 */
@Component({
  selector: 'app-track-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TrackItem],
  template: `
    <div class="demo">
      <div class="bar">
        <p class="lead">
          Type a unique note into each row, then
          <strong>delete the middle row</strong> and watch what happens to the
          notes below it.
        </p>
        <button type="button" class="btn" (click)="reset()">reset list</button>
      </div>

      <div class="pair">
        <div class="col">
          <div class="col-head">
            <span class="tag tag-bad">track $index</span>
            <span class="sub">positional key — state scrambles on delete</span>
          </div>
          <div class="list">
            @for (row of rows(); track $index) {
              <div class="row-wrap">
                <app-track-item [row]="row" />
                <button
                  type="button"
                  class="del"
                  (click)="remove(row.id)"
                  aria-label="delete row"
                >
                  &times;
                </button>
              </div>
            } @empty {
              <p class="empty">list empty — reset to try again.</p>
            }
          </div>
        </div>

        <div class="col">
          <div class="col-head">
            <span class="tag tag-good">track row.id</span>
            <span class="sub">stable key — state travels with the row</span>
          </div>
          <div class="list">
            @for (row of rows(); track row.id) {
              <div class="row-wrap">
                <app-track-item [row]="row" />
                <button
                  type="button"
                  class="del"
                  (click)="remove(row.id)"
                  aria-label="delete row"
                >
                  &times;
                </button>
              </div>
            } @empty {
              <p class="empty">list empty — reset to try again.</p>
            }
          </div>
        </div>
      </div>

      <p class="footnote">
        Each column renders its own independent <code>&#64;for</code>; the
        underlying Angular rule is the same in both — every
        <code>&#64;for</code> must declare a <code>track</code> expression, and
        that expression decides which component instance owns which row across
        renders. The left column's bug is not "missing track", it is "chose the
        wrong expression".
      </p>
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
      .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
      }
      .lead {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .btn {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-family: inherit;
        font-size: var(--text-body-sm);
        cursor: pointer;
      }
      .btn:hover {
        border-color: var(--color-primary);
      }
      .pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: var(--space-sm);
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .col-head {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tag {
        align-self: flex-start;
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-pill);
        font-size: var(--text-overline);
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      .tag-good {
        color: var(--color-on-secondary);
        background: var(--color-secondary);
      }
      .tag-bad {
        color: var(--color-on-error);
        background: var(--color-error);
      }
      .sub {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .row-wrap {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .del {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-sm);
        background: var(--color-surface);
        color: var(--color-on-surface-variant);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }
      .del:hover {
        border-color: var(--color-error);
        color: var(--color-error);
      }
      .empty {
        margin: 0;
        padding: var(--space-sm);
        text-align: center;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        border: 1px dashed var(--color-outline);
        border-radius: var(--radius-md);
      }
      .footnote {
        margin: 0;
        font-size: var(--text-caption);
        line-height: 1.6;
        color: var(--color-on-surface-variant);
      }
      .footnote code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
    `,
  ],
})
class TrackComparisonDemo {
  private static readonly SEED: readonly TrackRow[] = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Bravo' },
    { id: 3, name: 'Charlie' },
    { id: 4, name: 'Delta' },
  ];

  readonly rows = signal<readonly TrackRow[]>([...TrackComparisonDemo.SEED]);

  remove(id: number): void {
    this.rows.update((list) => list.filter((r) => r.id !== id));
  }

  reset(): void {
    this.rows.set([...TrackComparisonDemo.SEED]);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported screen — declared AFTER its helper imports (TDZ rule).         */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-best-practices-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    DoDontCard,
    ChangeDetectionVisualizer,
    TrackComparisonDemo,
  ],
  templateUrl: './best_practices_view.html',
  styleUrl: './best_practices_view.scss',
})
export class BestPracticesView {
  /** Code listings rendered by the page's CodeBlocks + DoDontCards. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> / DoDontCard elements.   */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  onpushDo: `// ✅ OnPush + signals: a signal WRITE is the change-detection trigger.
// No zone, no markForCheck, no stale view. This is how EVERY component in
// this app is written.
@Component({
  selector: 'app-todo-list',
  changeDetection: ChangeDetectionStrategy.OnPush,   // <- the contract
  template: \`
    @for (t of visible(); track t.id) {               // <- signals read in template
      <app-todo-row [todo]="t" />
    } @empty { <p>Nothing here.</p> }
  \`,
})
export class TodoListView {
  private readonly todos = signal<readonly Todo[]>([]);
  readonly filter = signal<TodoFilter>('all');

  // computed = memoised selector: re-derives only when its sources change.
  readonly visible = computed(() =>
    this.todos().filter((t) => matchesFilter(t, this.filter())),
  );
}`,
  onpushDont: `// ❌ Default change detection + mutable fields. Every event anywhere in
// the tree re-checks this component, and mutating an array in place won't
// even trigger a re-render (the reference didn't change).
@Component({
  selector: 'app-todo-list',
  // no changeDetection: ChangeDetectionStrategy.OnPush  <- defaults to Default
  template: \`
    <div *ngFor="let t of todos">{{ t.title }}</div>    <- no track, mutable
  \`,
})
export class TodoListView {
  todos: Todo[] = [];                                  // mutable, not a signal

  add(todo: Todo) {
    this.todos.push(todo);                             // in-place mutation
    // nothing re-renders, and the whole tree gets checked anyway.
  }
}`,
  trackDo: `// ✅ Stable id from the data — Angular reuses the DOM node + preserves the
// child component's state (input value, focus, animations) across reorders,
// filters, inserts, deletes.
@for (todo of todos(); track todo.id) {
  <app-todo-row [todo]="todo" />
} @empty {
  <p>No todos yet.</p>
}`,
  trackDont: `// ❌ track $index keys by POSITION, so deleting a middle row makes the
// rows below inherit the deleted row's component state. Correctness bug, not
// a perf tip. (Also: Angular *requires* a track expression — the real bug is
// choosing $index over a real id.)
@for (todo of todos(); track $index) {
  <app-todo-row [todo]="todo" />
}`,
  standaloneDo: `// ✅ Standalone component — imports its dependencies directly, no NgModule
// needed. Tree-shakable, lazy-loadable with loadComponent, the only style this
// app uses.
@Component({
  selector: 'app-post-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, TruncatePipe],          // <- deps on the component
  template: \` <article>{{ post.body | truncate:80 }}</article> \`,
})
export class PostCard {
  readonly post = input.required<Post>();
}`,
  standaloneDont: `// ❌ NgModule boilerplate — declares + exports the component in a shared
// module every consumer must list in imports. More files, more indirection,
// worse tree-shaking, harder lazy loading. Left behind in modern Angular.
@NgModule({
  declarations: [PostCard],
  imports: [CommonModule, TruncatePipeModule],
  exports: [PostCard],
})
export class PostCardModule {}

@Component({ selector: 'app-post-card', /* ... */ })
export class PostCard {}`,
  lazyDo: `// ✅ Lazy routes — each screen is its own chunk loaded on first navigation.
// loadComponent for a single standalone component; loadChildren for a whole
// child Routes array with its own nested <router-outlet>.
// (This is exactly how src/app/app.routes.ts is written.)
export const routes: Routes = [
  {
    path: 'best-practices',
    loadComponent: () =>
      import('./views/best_practices/bestpracticesview')
        .then((m) => m.BestPracticesView),
    title: 'Best practices',
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
];`,
  lazyDont: `// ❌ Eager import — every screen ships in the initial bundle, so the user
// downloads the whole app before they see the first page. No code splitting.
import { BestPracticesView } from './views/best_practices/bestpracticesview';

export const routes: Routes = [
  { path: 'best-practices', component: BestPracticesView },
];`,
  signalsDo: `// ✅ Signals for LOCAL/component state — ~90% of UI state. OnPush updates
// for free, no operator boilerplate, plain values in the template.
export class SearchBox {
  private readonly query = signal('');
  readonly results = computed(() =>            // memoised derivation
    this.all().filter((p) => p.title.includes(this.query())),
  );
  onInput(v: string) { this.query.set(v); }    // signal write = CD trigger
}`,
  signalsDont: `// ❌ BehaviorSubject + async pipe for a value only ONE component owns.
// Works, but buys you the operator ceremony without the multi-subscriber /
// combine/debounce power RxJS is actually for. Reach for RxJS for SERVER
// state (HttpClient), events, and orchestration — not local fields.
export class SearchBox {
  private readonly query$ = new BehaviorSubject('');
  readonly results$ = this.query$.pipe(
    map((q) => this.all().filter((p) => p.title.includes(q))),
  );
  onInput(v: string) { this.query$.next(v); }
}`,
  injectDo: `// ✅ inject() as a readonly field initialiser — sits next to signals,
// reads top-to-bottom, and is the ONLY option inside functional resolvers,
// guards, interceptors, and useFactory bodies.
export class PostsView {
  private readonly getPosts = inject(GET_POSTS_USE_CASE);
  private readonly scenario = inject(ScenarioService);
  readonly loading = signal(false);
}`,
  injectDont: `// ❌ Constructor injection only because "that's how it used to be done".
// Works, but separates deps from the fields that use them, can't be used in
// places with no constructor of their own (interceptor fns, route guards),
// and reads worse next to modern signal fields.
export class PostsView {
  private readonly loading = signal(false);

  constructor(
    private readonly getPosts: GetPostsUseCase,
    private readonly scenario: ScenarioService,
  ) {}
}`,
  teardownDo: `// ✅ DestroyRef + takeUntilDestroyed: teardown tied to the injection
// context, no ngOnDestroy interface, no manual subject. The subscription /
// effect / listener dies when the component does — automatically.
export class PriceTicker {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // RxJS subscription: auto-unsubscribes on component destroy.
    this.prices$.pipe(takeUntilDestroyed()).subscribe((p) => this.last.set(p));

    // Imperative browser API: cleaned up in the same hook.
    const controller = new AbortController();
    this.destroyRef.onDestroy(() => controller.abort());
    navigator.geolocation.watchPosition(/* ... */, { signal: controller.signal });
  }
}`,
  teardownDont: `// ❌ ngOnDestroy + a Subject + a chain of .pipe(takeUntil(this.destroy$)).
// Works, but is more code for the same lifetime guarantee, forces you to
// implement an interface, and is easy to forget on a new subscription.
export class PriceTicker implements OnDestroy {
  private readonly destroy$ = new Subject<void>();

  constructor() {
    this.prices$
      .pipe(takeUntil(this.destroy$))
      .subscribe((p) => this.last.set(p));
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}`,
  computedDo: `// ✅ computed() = lazy + memoised selector. Store the minimum (raw list +
// filter), derive everything else. Re-runs only when a source it reads
// changes; otherwise returns the cached value.
export class TodoList {
  private readonly todos = signal<readonly Todo[]>([]);
  readonly filter = signal<'all' | 'done' | 'active'>('all');

  readonly remaining = computed(() => this.todos().filter((t) => !t.done).length);
  readonly visible = computed(() =>
    this.todos().filter((t) => matchFilter(t, this.filter())),
  );
}`,
  computedDont: `// ❌ Store the derived value in a separate signal and re-compute it by hand
// in every method that touches a source. Easy to miss a call site; the
// derived signal drifts out of sync with the truth.
export class TodoList {
  private readonly todos = signal<readonly Todo[]>([]);
  readonly remaining = signal(0);

  add(todo: Todo) {
    this.todos.update((t) => [...t, todo]);
    this.remaining.set(this.todos().filter((x) => !x.done).length); // forget once -> bug
  }
  toggle(id: number) {
    this.todos.update(/* ... */);
    this.remaining.set(this.todos().filter((x) => !x.done).length); // and again
  }
}`,
  loopDo: `// ✅ Derive with computed; sync external systems in an effect that NEVER
// writes a signal it also reads. One source of truth, no loop.
export class Cart {
  private readonly items = signal<readonly Item[]>([]);
  readonly total = computed(() => sum(this.items()));

  constructor() {
    // side-effect only — persists to localStorage, reads items(), writes nothing.
    effect(() => localStorage.setItem('cart', JSON.stringify(this.items())));
  }
}`,
  loopDont: `// ❌ Effect that writes a signal it reads -> infinite change-detection loop.
// Angular caps the cycle and throws NG0100 (ExpressionChangedAfter... in dev).
export class Cart {
  private readonly items = signal<readonly Item[]>([]);

  constructor() {
    effect(() => {
      const items = this.items();          // read
      this.items.set([...items, fee]);     // write a signal we just read -> loop
    });
  }
}`,
  formsDo: `// ✅ Typed reactive form. The generic flows the field types into controls
// so form.value is typed (string | null), not any. Strict TS catches a typo'd
// control name at compile time.
interface LoginForm { email: string; password: string; }

const form = new FormGroup<LoginForm>({
  email:    new FormControl('', { nonNullable: true }),
  password: new FormControl('', { nonNullable: true }),
});

form.value;        // Partial<LoginForm> — typed
form.controls.email.setValue(123);  // ❌ type error — expects string`,
  formsDont: `// ❌ Untyped form. form.value is any, control names are unchecked strings,
// and a typo (emial) compiles fine and silently fails at runtime.
const form = new FormGroup({
  email:    new FormControl(''),
  password: new FormControl(''),
});

form.value;                    // any
form.controls.emial.setValue('x');   // ✅ "compiles" — silent bug`,
  a11yDo: `<!-- ✅ Semantic button + label + focus-visible. Keyboard, screen-reader,
and Testing Library (getByRole('button', { name: 'Add' })) all work for free. -->
<label for="email">Email</label>
<input id="email" type="email" [(ngModel)]="email" />

<button type="button" (click)="add()" class="add-btn">Add</button>

<!-- focus-visible styling in CSS shows keyboard users where they are -->
<style>
  .add-btn:focus-visible { outline: 2px solid var(--color-primary); }
</style>`,
  a11yDont: `<!-- ❌ div "button": no keyboard focus, no Enter/Space, no role, not
queryable by role/name. Inaccessible AND untestable. -->
<div class="fake-btn" (click)="add()">Add</div>

<input type="email" [(ngModel)]="email" placeholder="email" />
<!-- no <label>, no for/id link — screen readers announce "edit text", nothing else -->`,
  zoneless: `// The modern direction: zoneless change detection. With signals as the CD
// trigger, Angular no longer needs zone.js's monkey-patched event timers to
// know when to check — a signal write schedules the check itself. Smaller
// bundle (no zone.js), faster CD, fewer "why did this re-render?" surprises.
//
// Provide it at the root:
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    // ...
  ],
};
//
// Going zoneless is a migration: every component must drive CD from signals
// (or markForCheck/onPush + events), not rely on zone.js auto-detecting
// setInterval/XHR/Promise resolutions. This app is already written the
// zoneless-ready way (OnPush + signals everywhere) — flipping the provider on
// is the intended end state.`,
  immutability: `// OnPush + immutability: OnPush checks a component only when an INPUT
// reference changes (or a signal it reads writes, or an event fires in it).
// Mutating an array/object in place keeps the same reference -> the OnPush
// view does NOT re-render. Always produce a NEW reference.

export class TodoList {
  private readonly todos = signal<readonly Todo[]>([]);

  toggle(id: number) {
    // ✅ new array (new reference) + new todo object -> OnPush re-renders
    this.todos.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  // ❌ in-place mutation — same array reference, OnPush skips the update
  badToggle(id: number) {
    const t = this.todos().find((x) => x.id === id);
    if (t) t.done = !t.done;          // mutated in place — view goes stale
  }
}`,
  ecaaic: `// ExpressionChangedAfterItHasBeenChecked (NG0100) — the classic dev-mode
// error. Dev mode runs change detection TWICE per cycle to catch values that
// change DURING the same pass they were read. A common trigger: updating a
// parent's signal from a child's constructor/effect synchronously.

// ❌ throws in dev: parent reads value(), child writes it in the same pass
export class Parent {
  readonly value = signal(0);
  template = \`<child [value]="value()" />\`;
}

class Child {
  constructor(private parent: Parent) {
    this.parent.value.set(1);   // mutated during the same CD pass that read it
  }
}

// ✅ fix: defer the write out of the current synchronous CD pass, or — better
// — restructure so the value is DERIVED (computed) instead of mutated.
class Child {
  constructor() {
    queueMicrotask(() => /* ... */);          // defer, OR
  }
}
// The real fix is usually architectural: if it can be computed, compute it.`,
  qualityBar: `// This screen is the bar the rest of the app is held to. Every view in
// src/app/views/ already follows it — verify any new code against this list:
//
//   • Standalone OnPush component, changeDetection: ChangeDetectionStrategy.OnPush
//   • Signals for local state; computed() for derived values; effect() only
//     for side-effects (never to derive state)
//   • inject() for dependencies, never constructor injection
//   • @for ... track <stable-id> (track is REQUIRED; choose a real id)
//   • input()/model()/output() signal APIs, not @Input()/@Output()
//   • const-object + literal-union types, NEVER enum (erasable-only TS)
//   • takeUntilDestroyed / DestroyRef for subscriptions + browser APIs
//   • Views resolve data via inject(<USE_CASE_TOKEN>) — never HttpClient /
//     DTO / repository-impl imports (the dependency rule)
//   • Reuse ui/components primitives; single-use helpers stay local
//   • Strict TS everywhere; typed reactive forms; no \`any\` in event handlers`,
};

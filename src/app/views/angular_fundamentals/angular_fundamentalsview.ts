import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
  input,
  model,
  ViewContainerRef,
  ComponentRef,
} from '@angular/core';
import { DecimalPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { HighlightDirective } from './highlight.directive';
import { TruncatePipe } from './truncate.pipe';
import { AlertBox } from './alert-box';

/**
 * AngularFundamentalsView — one consolidated screen covering the Angular mental
 * model and its core building blocks: components & templates, signals, two-way
 * binding, structural + attribute directives, pipes (built-in + custom),
 * modules vs standalone, content projection, and dynamic components.
 *
 * The screen leans on the shared design-system primitives (SectionWrapper,
 * ContentGroupWrapper, TextBlock, CodeBlock, Example) so styling stays
 * consistent with the rest of the app. Interactive demos are kept as local
 * components in this file: they're only used here (see the "single file → local
 * helper" rule). The custom directive, pipe, and dynamically-created component
 * live in sibling files because their source is rendered verbatim as teaching
 * material and they each illustrate a distinct Angular concept.
 *
 * All components are standalone + OnPush and use the signal `input()` / `output()`
 * / `model()` APIs. Modern control flow (@if / @for / @switch) is used throughout.
 *
 * NOTE: the exported `AngularFundamentalsView` component is declared at the
 * BOTTOM of this file. Its `imports` reference local helper classes, which are
 * block-scoped class declarations (TDZ), so the main component must come after
 * every helper it names — otherwise the decorator would read an uninitialized
 * binding at module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types                                                         */
/* -------------------------------------------------------------------------- */

const SEVERITIES = { info: 'info', warn: 'warn', error: 'error' } as const;
type Severity = (typeof SEVERITIES)[keyof typeof SEVERITIES];

/* -------------------------------------------------------------------------- */
/* 1. What is Angular                                                         */
/* -------------------------------------------------------------------------- */
// Section rendered inline in the template (intro + one-way data flow + DI).

/* -------------------------------------------------------------------------- */
/* 3. Components & templates — live demo                                      */
/* -------------------------------------------------------------------------- */

/**
 * ProfileCard — local presentational component driven entirely by `input()`.
 * Mirrors the react fundamentals `<Profile/>` demo: change the data at the call
 * site and Angular's change detection updates only what changed.
 */
@Component({
  selector: 'app-profile-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="profile">
      <span
        class="status"
        [style.background-color]="online() ? 'var(--color-secondary)' : 'var(--color-outline)'"
        aria-hidden="true"
      ></span>
      <div>
        <p class="name">{{ name() }}</p>
        <p class="role">{{ role() }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .profile {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
      }
      .status {
        display: inline-block;
        height: 10px;
        width: 10px;
        border-radius: var(--radius-pill);
      }
      .name {
        margin: 0;
        font-size: var(--text-body);
        font-weight: 500;
        color: var(--color-on-surface);
      }
      .role {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ProfileCardDemo {
  readonly name = input.required<string>();
  readonly role = input.required<string>();
  readonly online = input<boolean>(false);
}

/** Two ProfileCards with different props — the live "props drive the output" demo. */
@Component({
  selector: 'app-profile-card-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProfileCardDemo],
  template: `
    <div class="rows">
      <app-profile-card name="Ada Lovelace" role="Engineer" [online]="true" />
      <app-profile-card name="Alan Turing" role="Researcher" [online]="false" />
    </div>
  `,
  styles: [
    `
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
    `,
  ],
})
class ProfileCardHost {}

/* -------------------------------------------------------------------------- */
/* 4. Signals — working counter demo                                          */
/* -------------------------------------------------------------------------- */

/** Counter — the canonical signals demo. Local + independent per instance. */
@Component({
  selector: 'app-counter-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="row">
      <button type="button" class="ghost" (click)="dec()">−</button>
      <span class="value">{{ count() }}</span>
      <button type="button" class="solid" (click)="inc()">+</button>
      <button type="button" class="reset" (click)="reset()">reset</button>
    </div>
  `,
  styles: [
    `
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .value {
        min-width: 2ch;
        text-align: center;
        font-size: var(--text-title);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--color-on-surface);
      }
      .ghost,
      .reset {
        border: 1px solid var(--color-outline);
        background: transparent;
        color: var(--color-on-surface);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border-radius: var(--radius-md);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .solid {
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body);
        border: none;
        border-radius: var(--radius-md);
        background-color: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .solid:hover {
        box-shadow: var(--shadow-button-card-hover);
        background-color: var(--color-primary-container);
      }
      .reset {
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--text-caption);
        border-radius: var(--radius-md);
        color: var(--color-on-surface-variant);
      }
      .reset:hover {
        background-color: var(--color-surface-variant);
      }
    `,
  ],
})
class CounterDemo {
  readonly count = signal(0);

  inc(): void {
    // Functional update — safest when the next value depends on the previous.
    this.count.update((c) => c + 1);
  }
  dec(): void {
    this.count.update((c) => c - 1);
  }
  reset(): void {
    this.count.set(0);
  }
}

/* -------------------------------------------------------------------------- */
/* 5. Two-way binding — model() demo                                          */
/* -------------------------------------------------------------------------- */

/**
 * TwoWayDemo — `[(ngModel)]`-style binding done with the signal `model()` API.
 * The child owns a `model()`; the parent binds `[(message)]`, so the parent's
 * signal updates when the child emits, and the child re-renders when the parent
 * changes. That round-trip is two-way binding — "banana in a box" `[()]`.
 */
@Component({
  selector: 'app-two-way-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <label class="caption">Parent → child binding</label>
      <input
        class="input"
        #msgInput
        [value]="message()"
        (input)="message.set(msgInput.value)"
        placeholder="type here"
      />
      <p class="mirror">
        Child reads: <span class="strong">{{ message() || '—' }}</span>
      </p>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .caption {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .input {
        width: 100%;
        max-width: 320px;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
      }
      .mirror {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .strong {
        color: var(--color-on-surface);
      }
    `,
  ],
})
class TwoWayDemo {
  /** `model()` declares a two-way input — writable from inside, subscribable out. */
  readonly message = model<string>('');
}

/**
 * TwoWayHost — the parent side of the two-way-binding demo. It owns a signal
 * and binds the child with `[(message)]` ("banana in a box"). Typing in either
 * the parent input or the child input updates both, because `model()` emits a
 * `messageChange` event the parent subscribes to automatically.
 */
@Component({
  selector: 'app-two-way-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TwoWayDemo],
  template: `
    <div class="col">
      <label class="caption">Parent owns this signal</label>
      <input
        class="input"
        #parentInput
        [value]="parentValue()"
        (input)="parentValue.set(parentInput.value)"
        placeholder="parent input"
      />
      <p class="mirror">
        Parent reads: <span class="strong">{{ parentValue() || '—' }}</span>
      </p>
      <!-- Two-way: parent → child and child → parent in one binding. -->
      <app-two-way-demo [(message)]="parentValue" />
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .caption {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .input {
        width: 100%;
        max-width: 320px;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
      }
      .mirror {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .strong {
        color: var(--color-on-surface);
      }
    `,
  ],
})
class TwoWayHost {
  readonly parentValue = signal('');
}

/* -------------------------------------------------------------------------- */
/* 6. Structural directives — @if / @for / @switch live demo                  */
/* -------------------------------------------------------------------------- */

interface Task {
  readonly id: number;
  readonly label: string;
}

/**
 * StructuralDemo — exercises modern control flow:
 *  - @if for either/or rendering
 *  - @for with a stable `track` (the lesson equivalent of React's `key`)
 *  - @switch over a literal union
 *
 * The legacy `*ngIf` / `*ngFor` / `*ngSwitch` still exist, but @if/@for/@switch
 * (Angular 17+) ship in the template compiler — no module import, better types,
 * and significantly faster change detection.
 */
@Component({
  selector: 'app-structural-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <!-- @if / else -->
      <div class="row">
        <button type="button" class="solid" (click)="toggle()">
          {{ visible() ? 'Hide' : 'Show' }} message
        </button>
        @if (visible()) {
          <span class="pill">✅ The message is visible.</span>
        } @else {
          <span class="muted">(nothing rendered)</span>
        }
      </div>

      <!-- @switch over a literal union -->
      <div class="row">
        <label class="caption">severity</label>
        <select class="select" #severitySelect [value]="severity()" (change)="setSeverity(severitySelect.value)">
          @for (s of severityOptions; track s) {
            <option [value]="s">{{ s }}</option>
          }
        </select>
        @switch (severity()) {
          @case ('info') {
            <span class="chip info">ℹ️ informational</span>
          }
          @case ('warn') {
            <span class="chip warn">⚠️ heads up</span>
          }
          @case ('error') {
            <span class="chip error">✖️ needs action</span>
          }
        }
      </div>

      <!-- @for with a stable track key + add/remove -->
      <div class="tasks">
        <div class="row">
          <input
            class="input"
            #taskInput
            [value]="draft()"
            (input)="draft.set(taskInput.value)"
            (keydown.enter)="add()"
            placeholder="Add a task…"
          />
          <button type="button" class="solid" (click)="add()">Add</button>
        </div>
        <ul class="list">
          @for (t of tasks(); track t.id) {
            <li class="task">
              <span>{{ t.label }}</span>
              <button type="button" class="link" (click)="remove(t.id)">remove</button>
            </li>
          } @empty {
            <li class="muted">No tasks yet.</li>
          }
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .caption {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .pill {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-md);
        background-color: var(--color-surface-tint);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .muted {
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .chip {
        padding: var(--space-xs) var(--space-sm);
        border-radius: var(--radius-pill);
        font-size: var(--text-caption);
      }
      .chip.info {
        background-color: color-mix(in srgb, var(--color-info) 18%, transparent);
        color: var(--color-info);
      }
      .chip.warn {
        background-color: color-mix(in srgb, var(--color-warning) 18%, transparent);
        color: var(--color-warning);
      }
      .chip.error {
        background-color: color-mix(in srgb, var(--color-critical) 18%, transparent);
        color: var(--color-critical);
      }
      .select,
      .input {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus,
      .select:focus {
        border-color: var(--color-primary);
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
        box-shadow: var(--shadow-button-card-hover);
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .task {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .link {
        border: none;
        background: transparent;
        padding: 0 var(--space-xs);
        color: var(--color-on-surface-variant);
        font-size: var(--text-caption);
      }
      .link:hover {
        color: var(--color-critical);
      }
    `,
  ],
})
class StructuralDemo {
  readonly visible = signal(true);
  readonly severity = signal<Severity>('info');
  readonly severityOptions: readonly Severity[] = ['info', 'warn', 'error'];

  readonly tasks = signal<readonly Task[]>([
    { id: 1, label: 'Learn the template syntax' },
    { id: 2, label: 'Build a component' },
  ]);
  readonly draft = signal('');

  private nextId = 3;

  toggle(): void {
    this.visible.update((v) => !v);
  }
  setSeverity(value: string): void {
    // The <option>s are exactly `severityOptions` (the Severity union), so the
    // selected string is provably a Severity — narrow it back to the union.
    this.severity.set(value as Severity);
  }
  add(): void {
    const label = this.draft().trim();
    if (!label) return;
    this.tasks.update((list) => [...list, { id: this.nextId++, label }]);
    this.draft.set('');
  }
  remove(id: number): void {
    this.tasks.update((list) => list.filter((t) => t.id !== id));
  }
}

/* -------------------------------------------------------------------------- */
/* 8. Content projection — ng-content with select                             */
/* -------------------------------------------------------------------------- */

/**
 * ProjectionCard — demonstrates `<ng-content>` with projection slots. The
 * parent passes content in; the card decides where it lands. `select` targets
 * a specific element/attribute, the slot-less `<ng-content>` catches the rest.
 */
@Component({
  selector: 'app-projection-card-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card">
      <header class="header">
        <!-- [card-title] is a projection hook, not a real attribute the user sees -->
        <ng-content select="[card-title]" />
      </header>
      <div class="body">
        <ng-content />
      </div>
      <footer class="footer">
        <ng-content select="[card-actions]" />
      </footer>
    </article>
  `,
  styles: [
    `
      .card {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        overflow: hidden;
      }
      .header {
        padding: var(--space-sm) var(--space-md);
        border-bottom: 1px solid var(--color-outline);
        font-size: var(--text-title-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .body {
        padding: var(--space-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
      .footer {
        display: flex;
        gap: var(--space-sm);
        padding: var(--space-sm) var(--space-md);
        border-top: 1px solid var(--color-outline);
        background-color: var(--color-surface-tint);
      }
    `,
  ],
})
class ProjectionCardDemo {}

/**
 * Host that shows the projection call-site: how the parent nests projected
 * nodes. Kept as a separate local component so the card markup stays readable.
 */
@Component({
  selector: 'app-projection-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectionCardDemo],
  template: `
    <app-projection-card-demo>
      <span card-title>Projected card</span>
      <p>
        Everything between the component's tags lands in its default
        <code>&lt;ng-content /&gt;</code> slot. Named slots pull specific nodes
        into their own region.
      </p>
      <button type="button">Action one</button>
      <button type="button" card-actions>Projected action</button>
    </app-projection-card-demo>
  `,
})
class ProjectionHost {}

/* -------------------------------------------------------------------------- */
/* 9. Dynamic components — ViewContainerRef.createComponent                  */
/* -------------------------------------------------------------------------- */

/**
 * DynamicComponentsDemo — builds an `AlertBox` imperatively. The host holds a
 * `<ng-container #anchor>` and uses `viewChild` + `ViewContainerRef` to attach
 * the component at runtime, sets its inputs, and tears it down on demand.
 *
 * `createComponent` returns a `ComponentRef`; `setInput` updates inputs without
 * a static template binding, and `destroy()` removes the view.
 */
@Component({
  selector: 'app-dynamic-components-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <input
          class="input"
          #alertInput
          [value]="draft()"
          (input)="draft.set(alertInput.value)"
          placeholder="message for the dynamic alert"
          (keydown.enter)="spawn()"
        />
        <button type="button" class="solid" (click)="spawn()">Create</button>
        <button type="button" class="ghost" (click)="clear()">Clear all</button>
      </div>

      <!-- Anchor where created components are inserted. A <ng-container> is the
           canonical ViewContainerRef anchor: it renders nothing itself, and the
           container inserts each created component right here in order. -->
      <div class="anchors">
        <ng-container #anchor />
      </div>
    </div>
  `,
  styles: [
    `
      .col {
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
      .input {
        flex: 1;
        min-width: 200px;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background-color: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body);
        outline: none;
      }
      .input:focus {
        border-color: var(--color-primary);
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
        box-shadow: var(--shadow-button-card-hover);
      }
      .ghost {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface);
        font-size: var(--text-body);
      }
      .ghost:hover {
        background-color: var(--color-surface-variant);
      }
      .anchors {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
    `,
  ],
})
class DynamicComponentsDemo {
  // The canonical Angular form: read a ViewContainerRef straight off the
  // anchor node (a <ng-container #anchor> in the template). createComponent
  // then inserts each new view at that anchor, in order — no DOM relocation
  // (appendChild) or manual outlet juggling. This is the textbook VCR pattern.
  private readonly vcr = viewChild.required('anchor', { read: ViewContainerRef });

  readonly draft = signal('');
  private readonly created: ComponentRef<AlertBox>[] = [];

  spawn(): void {
    const message = this.draft().trim() || `Dynamic alert #${this.created.length + 1}`;
    const ref = this.vcr().createComponent(AlertBox);
    ref.setInput('message', message);
    this.created.push(ref);
    this.draft.set('');
  }

  clear(): void {
    for (const ref of this.created) {
      ref.destroy();
    }
    this.created.length = 0;
  }
}

/* -------------------------------------------------------------------------- */
/* 11. Where next chips                                                       */
/* -------------------------------------------------------------------------- */

interface Chip {
  readonly label: string;
  readonly note: string;
}

@Component({
  selector: 'app-where-next-chips',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (c of chips; track c.label) {
      <div class="chip">
        <span class="label">{{ c.label }}</span>
        <span class="note">— {{ c.note }}</span>
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
      .chip {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
      }
      .label {
        font-size: var(--text-body-sm);
        font-weight: 500;
        color: var(--color-on-surface);
      }
      .note {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class WhereNextChips {
  readonly chips: readonly Chip[] = [
    { label: 'Lifecycle', note: 'OnInit / AfterView / OnDestroy + effects' },
    { label: 'Navigation', note: 'Router, lazy loading, guards, resolvers' },
    { label: 'State management', note: 'signals, NgRx, SignalStore, RxJS' },
  ];
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-angular-fundamentals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    TextBlock,
    CodeBlock,
    Example,
    ContentGroupWrapper,
    DecimalPipe,
    DatePipe,
    UpperCasePipe,
    HighlightDirective,
    TruncatePipe,
    // AlertBox is intentionally NOT imported here — the dynamic-components
    // section creates it imperatively with ViewContainerRef.
    ProfileCardHost,
    CounterDemo,
    TwoWayHost,
    StructuralDemo,
    ProjectionHost,
    DynamicComponentsDemo,
    WhereNextChips,
  ],
  templateUrl: './angular_fundamentals_view.html',
  styleUrl: './angular_fundamentals_view.scss',
})
export class AngularFundamentalsView {
  // A few demo values the template reads directly (attribute-directive host,
  // pipes demo). Kept here so the rendered examples live next to the prose.
  // NOTE: \`now\` is deliberately a plain (non-signal) snapshot. The pipes demo
  // teaches template TRANSFORMS ({{ value | pipe }}), not reactivity — a frozen
  // timestamp is the right sample. A live ticking clock would belong on the
  // Signals screen (a signal + effect/interval), not here.
  readonly now = new Date();
  readonly pi = Math.PI;
  readonly longText =
    'Angular pipes transform template values — this sentence is long on purpose so the custom truncate pipe has something to cut.';

  /** Code listings rendered by the page's CodeBlocks. Kept here (not inline in
   *  the HTML) so the template stays readable and the strings get full TS
   *  string-literal highlighting/editing. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  component: `import { Component, input } from '@angular/core';

@Component({
  selector: 'app-profile-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<p>Hello, {{ name() }}!</p>\`,
})
export class ProfileCard {
  // A required input, read as a signal.
  readonly name = input.required<string>();
  // An optional input with a default.
  readonly online = input<boolean>(false);
}

// Usage in a parent template:
// <app-profile-card name="Sam" [online]="true" />`,
  signals: `import { signal, computed, effect } from '@angular/core';

const count = signal(0);            // a reactive cell
const double = computed(() => count() * 2);  // derived; re-runs when count changes

effect(() => console.log('count is', count()));  // side effect on change

count.set(5);                       // overwrite
count.update((c) => c + 1);         // derive next from previous
// double() === 12`,
  twoWay: `import { Component, model, signal } from '@angular/core';

@Component({
  selector: 'app-child',
  template: \`<input [value]="message()" (input)="message.set($any($event.target).value)" />\`,
})
class Child {
  // model() = input + matching output ("messageChange").
  readonly message = model<string>('');
}

// Parent template — "banana in a box" two-way binding:
// <app-child [(message)]="parentValue" />
@Component({ /* … */ })
class Parent {
  readonly parentValue = signal('');
}`,
  structural: `<!-- @if / @else — either/or -->
@if (isLoggedIn()) {
  <app-dashboard />
} @else {
  <app-sign-in />
}

<!-- @for — track is the equivalent of React's key -->
<ul>
  @for (t of tasks(); track t.id) {
    <li>{{ t.label }}</li>
  } @empty {
    <li>No tasks yet.</li>
  }
</ul>

<!-- @switch over a literal union -->
@switch (severity()) {
  @case ('info')  { <span>ℹ️</span> }
  @case ('warn')  { <span>⚠️</span> }
  @case ('error') { <span>✖️</span> }
}`,
  attribute: `import { Directive, ElementRef, HostBinding, HostListener, input, inject } from '@angular/core';

@Directive({ selector: '[appHighlight]' })
export class HighlightDirective {
  readonly appHighlight = input('var(--color-secondary-container)');
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostBinding('style.transition') transition = 'background-color 120ms ease';

  @HostListener('mouseenter') onEnter() {
    this.el.nativeElement.style.backgroundColor = this.appHighlight();
  }

  @HostListener('mouseleave') onLeave() {
    this.el.nativeElement.style.backgroundColor = '';
  }
}`,
  pipe: `import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncate', standalone: true })
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 30, ellipsis = '…'): string {
    if (!value) return '';
    if (value.length <= limit) return value;
    return value.slice(0, limit).trimEnd() + ellipsis;
  }
}

// {{ longText | truncate:40:'…' }}`,
  standalone: `// app.routes.ts — a lazy-loaded standalone route. No NgModule required.
export const routes: Routes = [
  {
    path: 'angular-fundamentals',
    loadComponent: () =>
      import('./views/angular_fundamentals/angular_fundamentals_view')
        .then((m) => m.AngularFundamentalsView),
    title: 'Angular fundamentals',
  },
];

// The component itself lists its dependencies inline:
@Component({
  selector: 'app-x',
  standalone: true,           // default since Angular 19; shown for clarity
  imports: [CommonModule, RouterLink, HighlightDirective],
  template: \`…\`,
})
export class X {}`,
  projection: `<!-- Reusable card with three projection slots. -->
@Component({
  selector: 'app-projection-card',
  template: \`
    <article>
      <header><ng-content select="[card-title]" /></header>
      <div><ng-content /></div>            <!-- default slot -->
      <footer><ng-content select="[card-actions]" /></footer>
    </article>
  \`,
})
class ProjectionCard {}

<!-- Parent call site: nodes are routed into slots by attribute. -->
<app-projection-card>
  <span card-title>Projected card</span>
  <p>Body content lands in the default slot.</p>
  <button card-actions>Action</button>
</app-projection-card>`,
  dynamic: `import { Component, viewChild, ViewContainerRef, signal } from '@angular/core';

@Component({ /* … */ })
export class DynamicDemo {
  // Read a ViewContainerRef off a <ng-container #anchor> in the template.
  private readonly vcr = viewChild.required('anchor', { read: ViewContainerRef });
  readonly draft = signal('');

  spawn(): void {
    const ref = this.vcr().createComponent(AlertBox);   // imperative!
    ref.setInput('message', this.draft());
    // createComponent inserts the new view at the anchor, in order.
    // Later: ref.destroy() to tear it down.
  }
}`,
} as const;

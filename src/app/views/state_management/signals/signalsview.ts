import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  linkedSignal,
  model,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import {
  takeUntilDestroyed,
  toSignal,
  toObservable,
} from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

/**
 * SignalsView — local / component state with Angular Signals.
 *
 * This is the "which state are you managing?" hub's LOCAL-state answer: the
 * built-in, no-library reactive primitive that holds the state of ONE
 * component (or a small subtree). It is the foundation and the fallback for
 * ~90% of state in a well-factored app — reach for it before reaching for a
 * store. The store siblings (NgRx / SignalStore) and the server-state sibling
 * (RxJS) build ON TOP of this vocabulary; if a signal can hold it, a signal
 * should.
 *
 * Coverage: `signal` (the reactive cell) + the `WritableSignal` API
 * (`set`/`update`/`asReadonly`), `computed` (derive, don't duplicate),
 * `effect` (reactive side-effects), `linkedSignal` (a WRITABLE computed),
 * `toSignal`/`toObservable` (the RxJS bridges), signal inputs `input()` and
 * two-way `model()`, signal queries `viewChild`/`contentChild`, and why
 * signals + OnPush is the modern local-state answer (signal writes ARE the
 * change-detection trigger — no zone, no markForCheck).
 *
 * The CENTERPIECE is a fully functional todo app built entirely from signals:
 * add, toggle, filter all/active/done, clear done, and counts via `computed`.
 *
 * NOTE: the exported `SignalsView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper classes that are block-scoped class
 * declarations (TDZ), so the main component must come AFTER every helper it
 * names — otherwise the decorator would read an uninitialized binding at
 * module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* Shared local types + seed                                                   */
/* -------------------------------------------------------------------------- */

/** A single todo item. An interface (not a type) — extendable, declarable. */
interface Todo {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

/**
 * TODO_FILTERS — a const-object + literal union, NEVER an enum. This project
 * targets erasable-only TypeScript, and enums are not erasable; the const-
 * object gives runtime values AND a literal union from one declaration.
 */
const TODO_FILTERS = {
  all: 'all',
  active: 'active',
  done: 'done',
} as const;
type TodoFilter = (typeof TODO_FILTERS)[keyof typeof TODO_FILTERS];

const TODO_FILTER_LABELS: Record<TodoFilter, string> = {
  all: 'All',
  active: 'Active',
  done: 'Done',
};

/** Stable id source for todos (Date.now() would break on rapid adds). */
let todoIdSeq = 1000;
function nextTodoId(): number {
  return ++todoIdSeq;
}

const TODO_SEED: readonly Todo[] = [
  { id: 1, text: 'Read the Signals guide', done: true },
  { id: 2, text: 'Build the todo demo', done: false },
  { id: 3, text: 'Compare with the other tools', done: false },
];

/* -------------------------------------------------------------------------- */
/* 1. TodoDemo — the centerpiece (signal + computed + WritableSignal API)      */
/* -------------------------------------------------------------------------- */

/**
 * TodoDemo — a complete, working todo app built entirely from signals.
 *
 * Source of truth is ONE `signal<readonly Todo[]>`. Adding, toggling, and
 * clearing are "produce a new array with the change applied" via `update` —
 * never mutate, because signal equality is `===` and a mutation would not
 * register as a change. The filter is a second signal. EVERYTHING else
 * (visible list, remaining count, total, done count) is `computed` from those
 * two — derived, never duplicated.
 */
@Component({
  selector: 'app-signals-todo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="todo">
      <!-- Add row -->
      <div class="add-row">
        <input
          #box
          class="todo-input"
          [value]="draft()"
          (input)="onDraft(box.value)"
          (keydown.enter)="add()"
          placeholder="Add a todo…"
          aria-label="Add a todo"
        />
        <button type="button" class="btn primary" (click)="add()">Add</button>
        <button
          type="button"
          class="btn ghost"
          (click)="clearDone()"
          [disabled]="doneCount() === 0"
        >
          Clear done
        </button>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar" role="group" aria-label="Filter todos">
        @for (opt of filterOptions; track opt) {
          <button
            type="button"
            class="chip"
            [class.active]="filter() === opt"
            (click)="setFilter(opt)"
          >
            {{ labels[opt] }}
          </button>
        }
      </div>

      <!-- List -->
      @if (visible().length === 0) {
        <p class="empty">
          {{ filter() === 'all' ? 'Nothing yet — add one above.' : 'Nothing in this filter.' }}
        </p>
      } @else {
        <ul class="list">
          @for (t of visible(); track t.id) {
            <li class="item" [class.done]="t.done">
              <label class="tick">
                <input
                  type="checkbox"
                  [checked]="t.done"
                  (change)="toggle(t.id)"
                />
                <span class="text">{{ t.text }}</span>
              </label>
              <button
                type="button"
                class="remove"
                [attr.aria-label]="'Remove ' + t.text"
                (click)="remove(t.id)"
              >
                ✕
              </button>
            </li>
          }
        </ul>
      }

      <!-- Counts — all computed -->
      <p class="counts">
        <strong>{{ remaining() }}</strong> remaining ·
        <strong>{{ total() }}</strong> total ·
        <strong>{{ doneCount() }}</strong> done
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .todo {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .add-row {
        display: flex;
        gap: var(--space-xs);
      }
      .todo-input {
        flex: 1;
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body-sm);
        outline: none;
      }
      .todo-input:focus {
        border-color: var(--color-primary);
      }
      .btn {
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body-sm);
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn.primary {
        background: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .btn.primary:hover {
        background: var(--color-primary-container);
      }
      .btn.ghost {
        border-color: var(--color-outline);
        color: var(--color-on-surface);
        background: transparent;
      }
      .btn.ghost:hover:not(:disabled) {
        background: var(--color-surface-variant);
      }
      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .filter-bar {
        display: flex;
        gap: var(--space-xs);
      }
      .chip {
        border: 1px solid var(--color-outline);
        background: transparent;
        color: var(--color-on-surface-variant);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .chip.active {
        border-color: var(--color-primary);
        background: var(--color-surface);
        color: var(--color-primary);
      }
      .empty {
        border: 1px dashed var(--color-outline);
        background: var(--color-surface);
        border-radius: var(--radius-md);
        padding: var(--space-md);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        text-align: center;
      }
      .list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
      }
      .tick {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        flex: 1;
        cursor: pointer;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .tick input {
        accent-color: var(--color-primary);
      }
      .item.done .text {
        text-decoration: line-through;
        color: var(--color-on-surface-variant);
      }
      .remove {
        border: none;
        background: transparent;
        color: var(--color-on-surface-variant);
        cursor: pointer;
        border-radius: var(--radius-sm);
        padding: 0 var(--space-xs);
        font-size: var(--text-caption);
      }
      .remove:hover {
        color: var(--color-on-surface);
        background: var(--color-surface-variant);
      }
      .counts {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class TodoDemo {
  /** Source of truth #1: the list. `asReadonly` exposes a read-only view. */
  private readonly _todos = signal<readonly Todo[]>(TODO_SEED);
  readonly todos = this._todos.asReadonly();

  /** Source of truth #2: the active filter. */
  readonly filter = signal<TodoFilter>(TODO_FILTERS.all);

  /** UI draft for the add box — local, ephemeral, NOT derived. */
  readonly draft = signal('');

  /** Derived — the visible list. Recomputes when todos OR filter change. */
  readonly visible = computed(() => {
    const f = this.filter();
    const all = this.todos();
    if (f === TODO_FILTERS.active) return all.filter((t) => !t.done);
    if (f === TODO_FILTERS.done) return all.filter((t) => t.done);
    return all;
  });

  /** Derived — counts. Always correct, always free. */
  readonly remaining = computed(
    () => this.todos().filter((t) => !t.done).length,
  );
  readonly doneCount = computed(
    () => this.todos().filter((t) => t.done).length,
  );
  readonly total = computed(() => this.todos().length);

  readonly filterOptions: readonly TodoFilter[] = [
    TODO_FILTERS.all,
    TODO_FILTERS.active,
    TODO_FILTERS.done,
  ];
  readonly labels = TODO_FILTER_LABELS;

  onDraft(value: string): void {
    this.draft.set(value);
  }

  add(): void {
    const text = this.draft().trim();
    if (!text) return;
    // `update` — derive the next state from the previous. Never mutate.
    this._todos.update((list) => [
      ...list,
      { id: nextTodoId(), text, done: false },
    ]);
    this.draft.set('');
  }

  toggle(id: number): void {
    this._todos.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  remove(id: number): void {
    this._todos.update((list) => list.filter((t) => t.id !== id));
  }

  clearDone(): void {
    this._todos.update((list) => list.filter((t) => !t.done));
  }

  setFilter(f: TodoFilter): void {
    this.filter.set(f);
  }
}

/* -------------------------------------------------------------------------- */
/* 2. ComputedDemo — derive, don't duplicate                                   */
/* -------------------------------------------------------------------------- */

/**
 * ComputedDemo — the #1 rule of signals: STORE the minimum, DERIVE the rest.
 * A `computed` is lazy (runs only when read), memoised (reuses the last value
 * until a dependency changes), and tracks its dependencies automatically.
 * "Remaining count", "is the form valid", a formatted price: all derived.
 */
@Component({
  selector: 'app-signals-computed-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="box">
      <div class="row">
        <button type="button" class="btn" (click)="dec()" aria-label="decrement">−</button>
        <span class="num">{{ count() }}</span>
        <button type="button" class="btn" (click)="inc()" aria-label="increment">+</button>
      </div>
      <p class="readout">
        <code>computed</code> double = <strong>{{ double() }}</strong> ·
        parity = <strong>{{ parity() }}</strong>
      </p>
      <p class="hint">
        double and parity recompute only when count changes — and only if read.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .box {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }
      .btn {
        width: 36px;
        height: 36px;
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-title);
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .num {
        font-size: var(--text-headline);
        font-weight: 600;
        min-width: 2ch;
        text-align: center;
        color: var(--color-on-surface);
      }
      .readout,
      .hint {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .readout code,
      .hint code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ComputedDemo {
  readonly count = signal(0);
  readonly double = computed(() => this.count() * 2);
  readonly parity = computed(() =>
    this.count() % 2 === 0 ? 'even' : 'odd',
  );

  inc(): void {
    this.count.update((c) => c + 1);
  }
  dec(): void {
    this.count.update((c) => c - 1);
  }
}

/* -------------------------------------------------------------------------- */
/* 3. EffectDemo — reactive side-effects, logged on screen                     */
/* -------------------------------------------------------------------------- */

interface EffectLogEntry {
  readonly order: number;
  readonly message: string;
}

/**
 * EffectDemo — an `effect` runs a side-effect whenever a signal it reads
 * changes. Use effects for wiring signals to the OUTSIDE world: logging,
 * analytics, persisting to localStorage, talking to a non-signal API. Do NOT
 * use them to write other signals (that's what `computed`/`linkedSignal` are
 * for) — that creates update cycles Angular will refuse to schedule.
 *
 * The on-screen log shows the effect firing as the signal changes. The effect
 * is created in the constructor (the injection context) so Angular owns its
 * lifetime and tears it down with the component.
 */
@Component({
  selector: 'app-signals-effect-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button type="button" class="btn" (click)="bump()">bump count</button>
        <span class="num">{{ count() }}</span>
        <button
          type="button"
          class="btn ghost"
          (click)="clearLog()"
        >
          clear log
        </button>
      </div>
      <p class="hint">
        effect tracks <code>count()</code> — each change appends to the log.
      </p>
      <ul class="log">
        @for (e of entries(); track e.order) {
          <li>
            <span class="ord">#{{ e.order }}</span>
            <span class="msg">{{ e.message }}</span>
          </li>
        } @empty {
          <li class="muted">(log cleared — bump to fire the effect again)</li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .btn.ghost {
        border-style: dashed;
      }
      .num {
        font-size: var(--text-title);
        font-weight: 600;
        min-width: 2ch;
        text-align: center;
        color: var(--color-on-surface);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .hint code {
        font-family: var(--font-mono);
      }
      .log {
        list-style: none;
        margin: 0;
        padding: var(--space-sm);
        max-height: 160px;
        overflow: auto;
        background: var(--color-surface-tint);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
      }
      .log li {
        display: flex;
        gap: var(--space-sm);
      }
      .ord {
        color: var(--color-on-surface-variant);
        min-width: 3ch;
      }
      .msg {
        color: var(--color-on-surface);
      }
      .muted {
        color: var(--color-on-surface-variant);
        font-style: italic;
      }
    `,
  ],
})
class EffectDemo {
  readonly count = signal(0);
  private readonly _entries = signal<readonly EffectLogEntry[]>([]);
  readonly entries = this._entries.asReadonly();
  private order = 0;

  constructor() {
    // effect — first run is scheduled at the end of change detection; then it
    // re-runs whenever a signal it reads changes. Reading count() tracks it.
    effect(() => {
      const c = this.count();
      this.push(`effect ran — count is ${c}`);
    });
  }

  bump(): void {
    this.count.update((c) => c + 1);
  }

  clearLog(): void {
    this._entries.set([]);
    this.order = 0;
  }

  private push(message: string): void {
    const order = ++this.order;
    this._entries.update((list) =>
      [{ order, message }, ...list].slice(0, 30),
    );
  }
}

/* -------------------------------------------------------------------------- */
/* 4. LinkedSignalDemo — a WRITABLE computed                                   */
/* -------------------------------------------------------------------------- */

/**
 * LinkedSignalDemo — `linkedSignal` is a computed you can `set`/`update`.
 *
 * A `computed` is read-only: it always reflects its sources. Sometimes you
 * want a value that is DERIVED from a source by default BUT can be overridden
 * by the user — a default selection that the user can change, a sort order
 * that resets when the data changes, a draft that the user can edit. That is
 * exactly `linkedSignal`: it recomputes from its `source` when the source
 * changes (like computed), AND it has `set`/`update` (like signal).
 *
 * Below: picking a user sets a "default note" via the computation; typing in
 * the note box overrides it (a manual `update`). Picking a DIFFERENT user
 * resets the note to that user's default — the source change wins.
 */
interface NoteUser {
  readonly id: string;
  readonly name: string;
  readonly defaultNote: string;
}

const NOTE_USERS: readonly NoteUser[] = [
  { id: 'ada', name: 'Ada', defaultNote: 'Analysing the engine.' },
  { id: 'alan', name: 'Alan', defaultNote: 'Running the test suite.' },
  { id: 'grace', name: 'Grace', defaultNote: 'Compiling the spec.' },
];

@Component({
  selector: 'app-signals-linked-signal-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <span class="lbl">user:</span>
        @for (u of users; track u.id) {
          <button
            type="button"
            class="chip"
            [class.active]="selectedId() === u.id"
            (click)="select(u.id)"
          >
            {{ u.name }}
          </button>
        }
      </div>
      <label class="field">
        <span class="lbl">note (editable):</span>
        <input
          class="text"
          #noteInput
          [value]="note()"
          (input)="onNote(noteInput.value)"
        />
      </label>
      <p class="hint">
        Picking a user resets the note to that user's default; typing overrides
        it until you pick again. That reset-on-source-change is what
        <code>linkedSignal</code> gives you over a plain <code>signal</code>.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        flex-wrap: wrap;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-xxs);
      }
      .lbl {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .chip {
        border: 1px solid var(--color-outline);
        background: transparent;
        color: var(--color-on-surface-variant);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-sm);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .chip.active {
        border-color: var(--color-primary);
        background: var(--color-surface);
        color: var(--color-primary);
      }
      .text {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body-sm);
        outline: none;
      }
      .text:focus {
        border-color: var(--color-primary);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .hint code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class LinkedSignalDemo {
  readonly users = NOTE_USERS;

  /** The "source" signal — which user is selected. */
  readonly selectedId = signal<NoteUser['id']>(NOTE_USERS[0]!.id);

  /**
   * linkedSignal — derives a default note from the selected user, but is
   * WRITABLE so the user can override it. When selectedId changes, the
   * computation re-runs and the override is discarded.
   */
  readonly note = linkedSignal<NoteUser['id'], string>({
    source: this.selectedId,
    computation: (id) =>
      NOTE_USERS.find((u) => u.id === id)?.defaultNote ?? '',
  });

  select(id: NoteUser['id']): void {
    this.selectedId.set(id);
  }

  onNote(value: string): void {
    // Manual override — survives until the source (selectedId) changes again.
    this.note.set(value);
  }
}

/* -------------------------------------------------------------------------- */
/* 5. ToSignalDemo — bridging RxJS Observables into signals                    */
/* -------------------------------------------------------------------------- */

/**
 * ToSignalDemo — `toSignal` converts an Observable into a signal; `toObservable`
 * does the reverse. The bridge is the seam between Angular's reactive
 * primitives and the RxJS ecosystem (HttpClient, the router, event streams).
 *
 * Below, a button increments a kick signal; `toObservable` turns it into a
 * stream; `switchMap` + `timer` maps each kick to a one-shot emission 800ms
 * later; `toSignal` folds the result back into a signal the template reads —
 * no manual subscribe, and OnPush updates automatically when it lands.
 */
@Component({
  selector: 'app-signals-to-signal-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button type="button" class="btn" (click)="emit()">
          emit in 800ms
        </button>
      </div>
      <p class="readout">
        <code>toSignal(obs)</code> value =
        <strong>{{ value() }}</strong>
      </p>
      <p class="hint">
        signal → <code>toObservable</code> → RxJS operators →
        <code>toSignal</code> → template. That round trip is how you apply
        <code>debounceTime</code> / <code>switchMap</code> to a signal before an
        API call, and how <code>HttpClient</code> results land in a signal.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        gap: var(--space-sm);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .btn.ghost {
        border-style: dashed;
      }
      .readout,
      .hint {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
      }
      .readout code,
      .hint code {
        font-family: var(--font-mono);
      }
    `,
  ],
})
class ToSignalDemo {
  /** Kick signal — each click increments it, restarting the 800ms timer. */
  private readonly _kick = signal(0);

  /**
   * signal → Observable → switchMap to a one-shot timer → back to a signal.
   * switchMap cancels the previous in-flight timer when a new kick arrives.
   * takeUntilDestroyed ties the subscription to this component's lifetime.
   */
  readonly value = toSignal(
    toObservable(this._kick).pipe(
      switchMap(() => timer(800)),
      map(() => `fired at ${new Date().toLocaleTimeString()}`),
      takeUntilDestroyed(),
    ),
    { initialValue: '(not yet)' },
  );

  emit(): void {
    this._kick.update((k) => k + 1);
  }
}

/* -------------------------------------------------------------------------- */
/* 6. SignalInputsDemo — input() / model() / viewChild / contentChild          */
/* -------------------------------------------------------------------------- */

/**
 * ChildModelDemo — declares a `model()` (a two-way signal input). The parent
 * binds `[(value)]`, so the parent's signal and the child's model stay in
 * sync: the child writes via `set`, the parent's binding updates, and a parent
 * `effect`/`computed` reading the signal reacts.
 *
 * A signal `input()` is the one-way equivalent — readable in the child as a
 * signal, reactive, and (unlike @Input()) it does NOT trigger ngOnChanges.
 */
@Component({
  selector: 'app-signals-child-model',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="child">
      <p class="line">
        child <code>input()</code> label = <strong>{{ label() }}</strong>
      </p>
      <div class="row">
        <button type="button" class="btn" (click)="dec()">−</button>
        <span class="num">{{ value() }}</span>
        <button type="button" class="btn" (click)="inc()">+</button>
      </div>
      <p class="hint">
        the child's <code>model()</code> writes flow up to the parent via
        <code>[(value)]</code>.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .child {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-tint);
      }
      .line {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .line code,
      .hint code {
        font-family: var(--font-mono);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        width: 32px;
        height: 32px;
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        cursor: pointer;
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .num {
        font-size: var(--text-title);
        font-weight: 600;
        min-width: 2ch;
        text-align: center;
        color: var(--color-on-surface);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class ChildModelDemo {
  /** One-way signal input — readable as a signal in templates/effects. */
  readonly label = input<string>('count');

  /** Two-way signal model — writable from inside, subscribable from outside. */
  readonly value = model<number>(0);

  inc(): void {
    this.value.update((v) => v + 1);
  }
  dec(): void {
    this.value.update((v) => v - 1);
  }
}

/**
 * SignalInputsDemo — a parent showing `input()` (one-way), `model()` (two-way,
 * via `[(value)]`), and a `viewChild` signal query.
 *
 * Signal queries (`viewChild` / `contentChild`, plus the plural `viewChildren`
 * / `contentChildren`) replace the old `@ViewChild` / `@ContentChild` string-
 * key decorators. They return a SIGNAL of the queried element/component, so
 * they compose with `computed`/`effect` and update if the queried node appears
 * or disappears (e.g. behind an `@if`).
 */
@Component({
  selector: 'app-signals-inputs-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChildModelDemo],
  template: `
    <div class="col">
      <div class="row">
        <span class="lbl">parent owns:</span>
        <button type="button" class="btn" (click)="reset()">reset to 0</button>
      </div>
      <p class="line">
        parent signal value = <strong>{{ shared() }}</strong> · doubled via
        <code>computed</code> = <strong>{{ doubled() }}</strong>
      </p>
      <app-signals-child-model
        label="count"
        [(value)]="shared"
      />
      <button type="button" class="btn ghost" (click)="toggleBox()">
        {{ boxVisible() ? 'hide' : 'show' }} the queried element
      </button>
      @if (boxVisible()) {
        <div #box class="query-box">I am the queried element.</div>
      }
      <p class="hint">
        <code>viewChild('box')</code> is <strong>{{ box()?.nativeElement ? 'set' : 'null' }}</strong>
        — re-run the effect log: a <code>viewChild</code> signal flips between
        the element and <code>undefined</code> as the <code>&#64;if</code> toggles.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .col {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
      }
      .lbl {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .btn.ghost {
        border-style: dashed;
      }
      .line {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .line code,
      .hint code {
        font-family: var(--font-mono);
      }
      .query-box {
        padding: var(--space-md);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
class SignalInputsDemo {
  /** Parent signal two-way-bound to the child's model() via [(value)]. */
  readonly shared = signal(5);
  readonly doubled = computed(() => this.shared() * 2);

  /** Toggle to demonstrate viewChild flipping between set and undefined. */
  readonly boxVisible = signal(true);

  /** Signal query — a SIGNAL of the queried element, updates with @if. */
  readonly box = viewChild<ElementRef<HTMLElement>>('box');

  constructor() {
    // An effect reading box() will re-run when the element appears/disappears.
    effect(() => {
      // Touch the query so the effect tracks it.
      this.box();
    });
  }

  reset(): void {
    this.shared.set(0);
  }
  toggleBox(): void {
    this.boxVisible.update((v) => !v);
  }
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-signals-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    TodoDemo,
    ComputedDemo,
    EffectDemo,
    LinkedSignalDemo,
    ToSignalDemo,
    SignalInputsDemo,
  ],
  templateUrl: './signals_view.html',
  styleUrl: './signals_view.scss',
})
export class SignalsView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  when: `// "Which state are you managing?" — pick the lightest tool that fits.
//
//   LOCAL / COMPONENT state (THIS screen)
//     → signals. The state of ONE component or a small subtree. ~90% of UI
//       state lives here. No library, no boilerplate, OnPush just works.
//   SHARED / GLOBAL state
//     → NgRx SignalStore (lightweight) or NgRx Store (full Redux). When two
//       distant components need the same state and prop-drilling hurts.
//   SERVER state
//     → HttpClient + RxJS (caching, retries, invalidation). Different shape
//       from UI state — it is a cache of something that lives on a server.
//
// Reach for a signal first. Only move up when a signal genuinely cannot hold
// the state (because it is shared too widely, or it is a server cache).`,
  signal: `import { signal, computed } from '@angular/core';

// signal(initial) — a reactive cell. Returns a WritableSignal<T>.
const todos = signal<Todo[]>(seed);

// READ — call the signal as a function (in templates and TS).
todos();                          // the current value

// WRITE — three methods on WritableSignal:
todos.set([]);                    // replace the whole value
todos.update(list => [...list, { id: 4, text: 'x', done: false }]); // derive next
const frozen = todos.asReadonly();// expose a read-only view (no .set/.update)

// Equality is === by default — produce a NEW array on each write (spread +
// map/filter), never mutate, or the change will not register.`,
  computed: `import { computed } from '@angular/core';

// computed — lazy, memoised, auto-tracking. Recomputes only when a signal it
// READS changes, and only if someone is reading it. STORE the minimum,
// DERIVE the rest — a computed value can never drift from its sources.
const remaining = computed(() => todos().filter(t => !t.done).length);

const visible = computed(() => {
  const f = filter();             // reading filter() tracks it
  const all = todos();            // reading todos() tracks it
  if (f === 'active') return all.filter(t => !t.done);
  if (f === 'done')   return all.filter(t => t.done);
  return all;
});`,
  effect: `import { effect } from '@angular/core';

// effect — a side-effect that re-runs when a signal it reads changes. Create
// it in the injection context (constructor, field initializer, or a function
// that runs there) so Angular owns its lifetime and tears it down with the
// component. The first run is scheduled at the end of change detection.
constructor() {
  effect(() => {
    const remaining = this.remaining();
    console.log('remaining:', remaining);   // logs on every change
    localStorage.setItem('remaining', String(remaining));
  });
}

// RULE: do NOT write to other signals inside an effect (it creates update
// cycles Angular refuses to schedule). Use computed / linkedSignal for that.
// Effects are for talking to the OUTSIDE world: logging, analytics,
// persistence, imperatively driving a non-signal API.`,
  linkedSignal: `import { linkedSignal } from '@angular/core';

// linkedSignal — a WRITABLE computed. It derives a default from a SOURCE
// signal, but you can set/update it to override. When the source changes,
// the computation re-runs and the override is discarded.
const selectedId = signal('ada');
const note = linkedSignal({
  source: selectedId,                                  // the trigger
  computation: id => users.find(u => u.id === id)!.defaultNote,
});

note.set('overridden by the user');   // manual override, survives until…
selectedId.set('grace');               // …the source changes, resetting it.`,
  bridge: `import { toSignal, toObservable } from '@angular/core/rxjs-interop';

// toSignal — Observable → signal. Bridges the RxJS world (HttpClient, the
// router, events) into signals so OnPush templates react with no manual
// subscribe. Requires an initial value (a signal always has a value).
const posts = toSignal(
  http.get<Post[]>('/api/posts'),
  { initialValue: [] as Post[] },
);

// toObservable — signal → Observable. Use it to apply RxJS operators
// (debounceTime, switchMap) to a signal before kicking off an API call.
const results$ = toObservable(query).pipe(
  debounceTime(250),
  switchMap(q => http.get<Result[]>('/api/search?q=' + q)),
);`,
  inputs: `import { input, model, output } from '@angular/core';

// input() — a one-way signal input. Read in the child as a signal; reactive;
// does NOT trigger ngOnChanges (read it via computed/effect instead).
@Component({ /* … */ })
class UserCard {
  readonly user = input.required<User>();        // must be bound
  readonly mode = input<'compact' | 'full'>('compact'); // with default
  // In the parent:  <app-user-card [user]="u" [mode]="'full'" />
}

// model() — a TWO-WAY signal input. Writable from inside the child; the
// parent binds [(value)] and its own signal stays in sync.
@Component({ /* … */ })
class Counter {
  readonly value = model<number>(0);
  inc() { this.value.update(v => v + 1); }
  // In the parent:  <app-counter [(value)]="count" />
}

// output() — the event counterpart (the right side of banana-in-a-box).
readonly saved = output<User>();
this.saved.emit(u);   // parent:  <app-user-card (saved)="onSave($event)" />`,
  queries: `import { viewChild, contentChild, viewChildren, contentChildren,
  ElementRef } from '@angular/core';

// Signal queries replace the old @ViewChild / @ContentChild decorators. They
// return a SIGNAL of the queried node, so they compose with computed/effect
// and update automatically if the node appears or disappears behind an @if.
@Component({ /* … */ template: '<input #box />' })
class SearchBox {
  readonly box = viewChild<ElementRef<HTMLInputElement>>('box');
  // box() is ElementRef | undefined — undefined until the view initialises,
  // and undefined again if the element leaves the DOM via @if.

  readonly modal = viewChild.required(DialogCmp); // throws if never present
  // contentChild — queries CONTENT projected into <ng-content> (vs the
  // component's own view). viewChildren / contentChildren return a signal of
  // a readonly array for multi-element queries.
}`,
  onpush: `// OnPush + signals is the modern local-state answer.
//
//   ChangeDetectionStrategy.OnPush tells Angular "only check me if my inputs
//   changed OR I asked to be checked." Pre-signals, "asked" meant
//   markForCheck / AsyncPipe / a manual nudge — easy to get wrong.
//
//   With signals, that contract is automatic: a signal WRITE schedules change
//   detection on exactly the components that READ it. No zone, no
//   markForCheck, no stale view. The todo demo on this screen is OnPush and
//   updates instantly on every toggle — that is the whole story.
//
//   Rule: make every component OnPush; hold its local state in signals; read
//   inputs as signal inputs (input()/model()). You rarely think about change
//   detection again.

@Component({
  selector: 'app-todo',
  changeDetection: ChangeDetectionStrategy.OnPush,   // ← the default move
  template: \`<!-- … -->\`,
})
class TodoComponent {
  private readonly _todos = signal<Todo[]>(seed);
  readonly remaining = computed(() => this._todos().filter(t => !t.done).length);
}`,
};

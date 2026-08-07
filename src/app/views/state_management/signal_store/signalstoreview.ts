import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';

import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

import {
  TODO_FILTERS,
  TODO_FILTER_LABELS,
  TodoFilter,
} from './todos-store/todo.model';
import { TodosStore } from './todos-store/todos.store';
import { ComponentStoreDemo } from './component-store-demo';

/**
 * SignalStoreView — LIGHTWEIGHT global / store state with NgRx SignalStore.
 *
 * This is the "which state are you managing?" hub's MIDDLE answer. The built-in
 * Signals screen holds ONE component's state; the full NgRx Store screen is a
 * Redux tree with actions, reducers, selectors, and effects. SignalStore sits
 * between them: a factory (`signalStore(...)`) that composes an injectable
 * store out of small `withX` features, holding plain signals you read with the
 * same `store.todos()` call as any local signal — so OnPush updates for free
 * with no `selectSignal` plumbing and no action/reducer ceremony. That is why
 * it is the sweet spot for most apps whose state needs to be shared beyond one
 * component but does not justify a full Redux pipeline.
 *
 * Coverage: `signalStore` + `signalStoreFeature`, the
 * `withState` / `withComputed` / `withMethods` / `withHooks` pattern, providing
 * a store (root singleton vs component-local via `providers: [Store]`), reading
 * signals from the store in templates, RxJS integration (`withHooks` +
 * `rxMethod` + `tap`), and the "when to use" framing against the siblings.
 *
 * The CENTERPIECE is a fully functional todo app powered by a ROOT-PROVIDED
 * SignalStore: add, toggle, filter all/active/done, clear done, derived counts
 * via `withComputed`. The COMPONENT-LOCAL demo below it provides a tiny store
 * on one component so you can see two independent instances — the contrast that
 * distinguishes "shared singleton" from "one per component".
 *
 * ARCHITECTURE NOTE — why the store lives under this view folder:
 * The `TodosStore` is wired at the root in app.config.ts (`providers: [TodosStore]`,
 * the v21 form of the older `provideState(TodosStore)` helper) so `inject(TodosStore)`
 * works anywhere, but the store + its model are a SELF-CONTAINED teaching demo
 * that belongs to this one screen and is consumed nowhere else (mirrors the
 * Signals + NgRx siblings, whose todo state also lives in their view folders).
 * The one concession is app.config.ts importing the store from a view folder —
 * pragmatic for a demo, would live in `src/app/state/` in a real multi-feature app.
 *
 * NOTE: the exported `SignalStoreView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper classes that are block-scoped class
 * declarations (TDZ), so the main component must come AFTER every helper it
 * names — otherwise the decorator would read an uninitialized binding at
 * module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* 1. SignalStoreTodoDemo — the centerpiece (root-provided store)              */
/* -------------------------------------------------------------------------- */

/**
 * SignalStoreTodoDemo — a complete, working todo app powered by the ROOT
 * SignalStore wired in app.config.ts. The component holds NO todo state itself:
 * it READS the store's signals and computed signals directly in the template,
 * and writes by calling the store's methods. Compare this to the NgRx sibling,
 * where the same demo reads via `store.selectSignal(...)` and writes via
 * `store.dispatch(...)` — here both reads and writes are plain method calls on
 * one injected object, with the same OnPush reactivity, because the store IS a
 * bag of signals.
 *
 * The store's `onInit` hook hydrates from localStorage (and persists after each
 * change), so the list survives a reload — same durability as the NgRx sibling,
 * without an Effects class.
 */
@Component({
  selector: 'app-signal-store-todo-demo',
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
          (click)="store.clearDone()"
          [disabled]="store.doneCount() === 0"
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
            [class.active]="store.filter() === opt"
            (click)="store.setFilter(opt)"
          >
            {{ labels[opt] }}
          </button>
        }
      </div>

      <!-- List -->
      @if (store.visible().length === 0) {
        <p class="empty">
          {{
            store.filter() === 'all'
              ? 'Nothing yet — add one above.'
              : 'Nothing in this filter.'
          }}
        </p>
      } @else {
        <ul class="list">
          @for (t of store.visible(); track t.id) {
            <li class="item" [class.done]="t.done">
              <label class="tick">
                <input
                  type="checkbox"
                  [checked]="t.done"
                  (change)="store.toggle(t.id)"
                />
                <span class="text">{{ t.text }}</span>
              </label>
              <button
                type="button"
                class="remove"
                [attr.aria-label]="'Remove ' + t.text"
                (click)="store.remove(t.id)"
              >
                ✕
              </button>
            </li>
          }
        </ul>
      }

      <!-- Counts — all withComputed signals -->
      <p class="counts">
        <strong>{{ store.remaining() }}</strong> remaining ·
        <strong>{{ store.totalCount() }}</strong> total ·
        <strong>{{ store.doneCount() }}</strong> done
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
class SignalStoreTodoDemo {
  /** The ROOT-provided store — one singleton shared across the app. */
  readonly store = inject(TodosStore);

  /** UI draft for the add box — the only component-local state. */
  readonly draft = signal('');

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
    this.store.add(text);
    this.draft.set('');
  }
}

/* -------------------------------------------------------------------------- */
/* 2. ComponentStoreDemo lives in its own file — see component-store-demo.ts.  */
/* A component that declares its own `providers: [CounterStore]` must be a     */
/* properly standalone, importable declaration, so it cannot be a non-exported */
/* helper inside this view file.                                               */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-signal-store-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    SignalStoreTodoDemo,
    ComponentStoreDemo,
  ],
  templateUrl: './signal_store_view.html',
  styleUrl: './signal_store_view.scss',
})
export class SignalStoreView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  when: `// "Which state are you managing?" — NgRx SignalStore is the MIDDLE option.
//
//   LOCAL / COMPONENT state     → signals (the Signals screen). ~90% of UI state.
//   LIGHTWEIGHT shared state     → THIS screen. signalStore(...) composes an
//                                  injectable store out of withState/withComputed/
//                                  withMethods/withHooks — signals all the way
//                                  down, no actions/reducers. The sweet spot.
//   SHARED / GLOBAL client state → NgRx Store (the previous screen). One immutable
//                                  tree, actions, reducers, selectors, effects.
//                                  Earn it at scale.
//   SERVER state                 → HttpClient + RxJS. A cache, not UI state.
//
// Reach for SignalStore when state must be shared beyond one component (or live
// longer than one) but a full Redux pipeline is overkill: a feature store, a
// session cart, a multi-step wizard held across routes, an editor buffer. If a
// single signal can hold it, keep it local; if many distant slices need strict
// serialised history, move up to the full store.`,
  factory: `import { signalStore, withState, withComputed, withMethods, withHooks, patchState }
  from '@ngrx/signals';
import { computed } from '@angular/core';

// signalStore(...features) returns an injectable class. Each feature adds one
// slice of capability; the file reads top-to-bottom as the whole state contract.
export const TodosStore = signalStore(
  // 1. STATE — reactive cells. withState turns each key into a signal.
  withState({ todos: TODO_SEED, filter: 'all' }),

  // 2. COMPUTED — derive, never duplicate. STORE the minimum, DERIVE the rest.
  withComputed(({ todos, filter }) => ({
    visible:   computed(() => filtered(todos(), filter())),
    remaining: computed(() => todos().filter(t => !t.done).length),
    doneCount: computed(() => todos().filter(t =>  t.done).length),
    totalCount:computed(() => todos().length),
  })),

  // 3. METHODS — the actions. patchState = immutable update (new ref each time).
  withMethods((store) => ({
    add(text: string) {
      patchState(store, s => ({
        todos: [...s.todos, { id: nextId(), text, done: false }],
      }));
    },
    toggle(id: number) {
      patchState(store, s => ({
        todos: s.todos.map(t => t.id === id ? { ...t, done: !t.done } : t),
      }));
    },
    setFilter(filter: TodoFilter) { patchState(store, { filter }); },
  })),
);`,
  feature: `// signalStoreFeature packages a REUSABLE slice of store — state + computed +
// methods you can mix into any store, like an entity cache, a loading flag, or
// a pagination block. Call it once, spread it into signalStore(...) everywhere.
export function withLoading() {
  return signalStoreFeature(
    withState({ loading: false, error: null as string | null }),
    withMethods((s) => ({
      start() { patchState(s, { loading: true,  error: null }); },
      ok()    { patchState(s, { loading: false, error: null }); },
      fail(e: string) { patchState(s, { loading: false, error: e }); },
    })),
  );
}

// then compose it:
export const PostsStore = signalStore(withLoading(), withState({ posts: [] }));`,
  provide: `// app.config.ts — provide the store as a ROOT SINGLETON.
//
// In @ngrx/signals 21 there is no separate provideState() helper: a signalStore
// class IS an @Injectable, so listing it in providers registers one instance at
// the root injector. (Earlier docs called this provideState(TodosStore).)
import { TodosStore } from './views/state_management/signal_store/todos-store/todos.store';

export const appConfig: ApplicationConfig = {
  providers: [
    // …router, httpClient, provideData…
    TodosStore,            // ← root singleton: inject(TodosStore) works anywhere
  ],
};

// COMPONENT-LOCAL instead? Provide it on the component, not the root:
@Component({
  providers: [CounterStore],   // ← a FRESH instance per element; dies with it
})
class CounterWidget {
  private readonly store = inject(CounterStore);   // one per component
}`,
  component: `import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { TodosStore } from './todos-store/todos.store';

@Component({
  selector: 'app-todo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,   // ← the default move
  template: \`<!-- … -->\`,
})
class TodoDemo {
  // inject the root singleton — same call as any signal-based service.
  readonly store = inject(TodosStore);

  // Reads are PLAIN SIGNAL CALLS. The template uses store.visible(),
  // store.remaining() — OnPush re-renders when those signals move, with no
  // selectSignal plumbing and no async pipe.
  //
  // Writes are PLAIN METHOD CALLS on the same object. No dispatch, no action.
  add(text: string) { this.store.add(text); }
}`,
  rxjs: `import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { toObservable } from '@angular/core/rxjs-interop';
import { pipe } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';

// inside withHooks({ onInit(store) { … } }) — runs in an injection context:

withHooks({
  onInit(store) {
    // 1. one-shot hydration (synchronous read before first paint)
    patchState(store, { todos: readStorage() });

    // 2. RxJS integration: rxMethod wraps a pipeline you can drive with a
    //    signal's observable. toObservable(store.todos) emits on every change;
    //    debounceTime + tap collapses rapid edits into one debounced write.
    const persist = rxMethod<readonly Todo[]>(
      pipe(debounceTime(150), tap(todos => writeStorage(todos))),
    );
    persist(toObservable(store.todos));   // subscription tied to the store
  },
}),

// rxMethod is the bridge in the other direction too: hand it a source$ of
// intents (a WebSocket, an input signal) and let the RxJS pipeline dispatch
// store methods downstream — side-effects at the edges, signals in the middle.`,
  onepager: `// The whole pattern, on one page:
//
//   signalStore(...)   a FACTORY that returns an injectable class — a bag of
//                      signals + methods + hooks. No reducer, no action creators.
//
//   withState          the reactive cells (each key becomes a signal).
//   withComputed       derived signals (memoised; STORE the min, DERIVE the rest).
//   withMethods        the actions — plain methods that call patchState.
//   withHooks          onInit / onDestroy lifecycle. Where RxJS + side-effects
//                      live (rxMethod) so the cells stay pure.
//   patchState         the immutable-update helper — new ref each time.
//
//   provide it:        ROOT — list the class in app.config providers (singleton).
//                      COMPONENT — list it in the component's providers (fresh
//                      per element, dies with it).
//
//   read it:           inject(Store), then call its signals/computed in template.
//                      OnPush re-renders automatically — it IS just signals.`,
};

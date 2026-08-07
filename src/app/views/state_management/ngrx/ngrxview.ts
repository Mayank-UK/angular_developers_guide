import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { Actions } from '@ngrx/effects';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, scan } from 'rxjs/operators';

import { SectionWrapper } from '../../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../../ui/components/code-block/code-block';
import { Example } from '../../../../ui/components/example/example';

import {
  TODO_FILTERS,
  TODO_FILTER_LABELS,
  TodoFilter,
} from './todos-feature/todo.model';
import { TodosActions } from './todos-feature/todos.actions';
import {
  AppState,
  selectVisibleTodos,
  selectRemainingCount,
  selectDoneCount,
  selectTotalCount,
  selectFilter,
} from './todos-feature/todos.selectors';

/**
 * NgrxView — GLOBAL CLIENT state with NgRx Store (Angular's Redux).
 *
 * This is the "which state are you managing?" hub's GLOBAL-state answer:
 * ONE immutable tree, ONE way to change it (dispatch an action that flows
 * through a pure reducer), read via memoised selectors. The price is ceremony
 * (actions / reducer / selectors / effects) — the payoff is predictability,
 * serialisable history (time-travel via the devtools), and a shape that scales
 * to large teams sharing state across distant components.
 *
 * Coverage: the unidirectional data flow mental model, `createActionGroup`
 * (typed action creators), `createReducer` + `on` (a pure reducer — never
 * mutate, never side-effect), `createSelector` (memoised selectors), selecting
 * state in components via `store.selectSignal(...)` and dispatching actions,
 * `createEffect` for side-effects (localStorage persistence), and the Redux
 * Devtools. The CENTERPIECE is a fully functional todo app reading from a REAL
 * app-wide NgRx store, with a live action log so you can see each intent flow
 * through the store.
 *
 * ARCHITECTURE NOTE — why the feature lives under this view folder:
 * NgRx Store is wired app-wide in app.config.ts (provideStore + provideEffects)
 * so `inject(Store)` works anywhere, but the todos feature (actions / reducer /
 * selectors / effects) is a SELF-CONTAINED teaching demo that belongs to this
 * one screen and is not consumed elsewhere. Keeping it under
 * `state_management/ngrx/todos-feature/` mirrors the Signals sibling (whose
 * todo state lives entirely in that view) and keeps the demo's moving parts in
 * one place. The one concession is app.config.ts importing the reducer from a
 * view folder — pragmatic for a demo, would live in `src/app/state/` in a real
 * app with many features.
 *
 * NOTE: the exported `NgrxView` is declared at the BOTTOM of this file. Its
 * `imports` reference local helper classes that are block-scoped class
 * declarations (TDZ), so the main component must come AFTER every helper it
 * names — otherwise the decorator would read an uninitialized binding at
 * module-evaluation time.
 */

/* -------------------------------------------------------------------------- */
/* 1. NgrxTodoDemo — the centerpiece (real app-wide store)                     */
/* -------------------------------------------------------------------------- */

/**
 * NgrxTodoDemo — a complete, working todo app powered by the REAL app-wide
 * NgRx store. The component holds NO todo state itself: it READS slices via
 * `store.selectSignal(...)` (signal-based, so OnPush updates automatically)
 * and writes by DISPATCHING actions. Compare this to the Signals sibling,
 * where the same demo holds the list in a component-local signal — the
 * mechanism here is heavier, but the state now lives outside any component and
 * any other component in the app could read the exact same list without a
 * single prop passed through.
 *
 * The constructor dispatches `loadTodos` to trigger the persistence effect's
 * hydration from localStorage (see todos.effects.ts).
 */
@Component({
  selector: 'app-ngrx-todo-demo',
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

      <!-- Counts — all memoised selectors -->
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
class NgrxTodoDemo {
  private readonly store = inject(Store<AppState>);

  /** UI draft for the add box — the only component-local state. */
  readonly draft = signal('');

  /**
   * Reads from the store via `selectSignal` — a SIGNAL of the selector's
   * memoised value, so OnPush updates automatically when the slice moves.
   * Notice the component holds NONE of this; every value is derived by a
   * selector from the single store.
   */
  readonly visible = this.store.selectSignal(selectVisibleTodos);
  readonly remaining = this.store.selectSignal(selectRemainingCount);
  readonly doneCount = this.store.selectSignal(selectDoneCount);
  readonly total = this.store.selectSignal(selectTotalCount);
  readonly filter = this.store.selectSignal(selectFilter);

  readonly filterOptions: readonly TodoFilter[] = [
    TODO_FILTERS.all,
    TODO_FILTERS.active,
    TODO_FILTERS.done,
  ];
  readonly labels = TODO_FILTER_LABELS;

  constructor() {
    // Kick off hydration — the loadTodos effect reads localStorage and
    // dispatches `todosLoaded`, which the reducer folds into state.
    this.store.dispatch(TodosActions.loadTodos());
  }

  onDraft(value: string): void {
    this.draft.set(value);
  }

  add(): void {
    const text = this.draft().trim();
    if (!text) return;
    // The ONLY way to change store state: dispatch an action.
    this.store.dispatch(TodosActions.addTodo({ text }));
    this.draft.set('');
  }

  toggle(id: number): void {
    this.store.dispatch(TodosActions.toggleTodo({ id }));
  }

  remove(id: number): void {
    this.store.dispatch(TodosActions.removeTodo({ id }));
  }

  clearDone(): void {
    this.store.dispatch(TodosActions.clearDone());
  }

  setFilter(filter: TodoFilter): void {
    this.store.dispatch(TodosActions.setFilter({ filter }));
  }
}

/* -------------------------------------------------------------------------- */
/* 2. ActionLogDemo — live stream of dispatched actions                         */
/* -------------------------------------------------------------------------- */

interface ActionLogEntry {
  readonly order: number;
  readonly type: string;
}

/**
 * ActionLogDemo — subscribes to the `Actions` stream and lists the most recent
 * dispatched actions. This is the teaching mirror for the unidirectional data
 * flow: every change you make in the todo demo above shows up here as an
 * action flowing through the store before the reducer produces the next state.
 *
 * `Actions` is the same stream effects listen to; here we fold it into a signal
 * with `toSignal` + `scan` so the list updates reactively under OnPush. The
 * order counter is monotonic per mounted instance.
 */
@Component({
  selector: 'app-ngrx-action-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="log-wrap">
      <p class="hint">
        every dispatch flows through here first — then the reducer, then the
        selectors, then the view. One direction only.
      </p>
      <ul class="log">
        @for (e of entries(); track e.order) {
          <li>
            <span class="ord">#{{ e.order }}</span>
            <code class="type">{{ e.type }}</code>
          </li>
        } @empty {
          <li class="muted">(no actions yet — interact with the todo above)</li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .log-wrap {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .log {
        list-style: none;
        margin: 0;
        padding: var(--space-sm);
        max-height: 180px;
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
        align-items: baseline;
      }
      .ord {
        color: var(--color-on-surface-variant);
        min-width: 3ch;
      }
      .type {
        color: var(--color-primary);
        font-family: var(--font-mono);
      }
      .muted {
        color: var(--color-on-surface-variant);
        font-style: italic;
      }
    `,
  ],
})
class ActionLogDemo {
  private readonly actions$ = inject(Actions);

  /** Each dispatched action → an entry; keep the 12 most recent, newest first. */
  readonly entries = toSignal(
    this.actions$.pipe(
      map((a) => a.type),
      scan<string, readonly ActionLogEntry[]>((acc, type) => {
        const order = acc.length === 0 ? 1 : acc[0]!.order + 1;
        return [{ order, type }, ...acc].slice(0, 12);
      }, []),
    ),
    { initialValue: [] as readonly ActionLogEntry[] },
  );
}

/* -------------------------------------------------------------------------- */
/* Main view — declared last (see the TDZ note at the top of the file).       */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-ngrx-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    NgrxTodoDemo,
    ActionLogDemo,
  ],
  templateUrl: './ngrx_view.html',
  styleUrl: './ngrx_view.scss',
})
export class NgrxView {
  /** Code listings rendered by the page's CodeBlocks. */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  when: `// "Which state are you managing?" — NgRx Store is the GLOBAL CLIENT option.
//
//   LOCAL / COMPONENT state     → signals (the Signals screen). ~90% of UI state.
//   SHARED / GLOBAL client state → THIS screen. One immutable tree, actions,
//                                  reducers, selectors. Ceremony for scale.
//   LIGHTWEIGHT shared state     → NgRx SignalStore (next screen). The sweet
//                                  spot for most apps that need shared state.
//   SERVER state                 → HttpClient + RxJS. A cache, not UI state.
//
// Reach for NgRx Store when the app is LARGE, many distant components share the
// same client state, you want middleware (effects for async) + the devtools'
// time-travel, and a team values a strict, auditable history of every change.
// For a handful of shared values, prefer SignalStore — same ideas, less code.`,
  flow: `// The unidirectional data flow — the whole point of the pattern.
//
//        view ──dispatch(action)──▶ reducer ──▶ new state ──▶ selectors ──▶ view
//          ▲                                                          │
//          └──────────────────────────────────────────────────────────┘
//
//  · state lives in ONE place (the store); components never keep a copy
//  · the ONLY way to change it is to dispatch a plain, serialisable action
//  · the reducer is a PURE function: (state, action) => next state
//  · selectors memoise the derivation; components read them via selectSignal
//  · side-effects (HTTP, localStorage) live in effects, NEVER in the reducer
//
//  Because every change is a serialisable action, the devtools can scrub back
//  through the whole history — that is "time-travel debugging".`,
  store: `// app.config.ts — wire the store app-wide. INERT until actions dispatch.
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { todosReducer } from './views/state_management/ngrx/todos-feature/todos.reducer';
import { TodosEffects } from './views/state_management/ngrx/todos-feature/todos.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    // …router, httpClient, provideData…
    provideStore({ todos: todosReducer }),     // register feature reducers
    provideEffects([TodosEffects]),            // register effect classes
    provideStoreDevtools({ maxAge: 25, logOnly: environment.production }),
  ],
};`,
  actions: `import { createActionGroup, props } from '@ngrx/store';
import { Todo, TodoFilter } from './todo.model';

// createActionGroup bundles a feature's action creators in one typed object.
// Each event becomes a creator whose 'type' is auto-namespaced '[Todos] …'.
export const TodosActions = createActionGroup({
  source: 'Todos',
  events: {
    'Add Todo':    props<{ text: string }>(),
    'Toggle Todo': props<{ id: number }>(),
    'Remove Todo': props<{ id: number }>(),
    'Clear Done':  props<Record<string, never>>(),
    'Set Filter':  props<{ filter: TodoFilter }>(),
    'Load Todos':  props<Record<string, never>>(),   // → effect hydrates
    'Todos Loaded': props<{ todos: readonly Todo[] }>(),  // effect → reducer
  },
});

// Usage:  store.dispatch(TodosActions.addTodo({ text: 'ship it' }))
// yields  { type: '[Todos] Add Todo', text: 'ship it' }`,
  reducer: `import { createReducer, on } from '@ngrx/store';
import { TodosActions } from './todos.actions';

export interface TodosState {
  readonly todos: readonly Todo[];
  readonly filter: TodoFilter;
}

export const initialTodosState: TodosState = {
  todos: TODO_SEED,
  filter: TODO_FILTERS.all,
};

// createReducer(initialState, on(action, handler)…) → a reducer function.
// Each handler MUST be PURE: no side-effects, no Date.now() — and it returns a
// NEW state object (spread/map/filter). Never mutate; the store needs a new
// reference to know anything changed.
export const todosReducer = createReducer<TodosState>(
  initialTodosState,

  on(TodosActions.addTodo, (state, { text }) => ({
    ...state,
    todos: [...state.todos, { id: nextTodoId(), text, done: false }],
  })),

  on(TodosActions.toggleTodo, (state, { id }) => ({
    ...state,
    todos: state.todos.map(t => (t.id === id ? { ...t, done: !t.done } : t)),
  })),

  on(TodosActions.clearDone, state => ({
    ...state,
    todos: state.todos.filter(t => !t.done),
  })),

  on(TodosActions.setFilter, (state, { filter }) => ({ ...state, filter })),
);`,
  selectors: `import { createSelector } from '@ngrx/store';

export interface AppState { todos: TodosState; }

// A leaf selector — a plain function of the root state.
export const selectTodosState = (state: AppState) => state.todos;

// createSelector(...inputs, projector) memoises: recompute only when an INPUT
// changes, and only if someone is reading it. STORE the minimum, DERIVE the rest.
export const selectTodos = createSelector(selectTodosState, s => s.todos);
export const selectFilter = createSelector(selectTodosState, s => s.filter);

// A projector that depends on TWO selectors — memoised on the pair.
export const selectVisibleTodos = createSelector(
  selectTodos,
  selectFilter,
  (todos, filter) => {
    if (filter === 'active') return todos.filter(t => !t.done);
    if (filter === 'done')   return todos.filter(t => t.done);
    return todos;
  },
);

export const selectRemainingCount = createSelector(
  selectTodos,
  todos => todos.filter(t => !t.done).length,
);`,
  component: `import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { Store } from '@ngrx/store';

@Component({
  selector: 'app-ngrx-todo-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,   // ← the default move
  template: \`<!-- … -->\`,
})
class NgrxTodoDemo {
  private readonly store = inject(Store<AppState>);

  // selectSignal → a SIGNAL of the selector's memoised value. OnPush updates
  // automatically when the slice moves; no async pipe, no manual subscribe.
  readonly visible   = this.store.selectSignal(selectVisibleTodos);
  readonly remaining = this.store.selectSignal(selectRemainingCount);
  readonly filter    = this.store.selectSignal(selectFilter);

  // The ONLY way to change store state: dispatch an action.
  add(text: string) {
    this.store.dispatch(TodosActions.addTodo({ text }));
  }
  setFilter(filter: TodoFilter) {
    this.store.dispatch(TodosActions.setFilter({ filter }));
  }
}`,
  effects: `import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, tap, withLatestFrom } from 'rxjs/operators';

@Injectable()
export class TodosEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store<AppState>);

  // An effect that DISPATCHES: hydrate on init → emit todosLoaded back.
  readonly loadTodos$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TodosActions.loadTodos),
      map(() => TodosActions.todosLoaded({ todos: readStorage() })),
    ),
  );

  // An effect that does NOT dispatch ({ dispatch: false }): persist after each
  // mutation. withLatestFrom pairs the action with the current store value (the
  // reducer has already run by the time an effect fires).
  readonly persistTodos$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          TodosActions.addTodo,
          TodosActions.toggleTodo,
          TodosActions.removeTodo,
          TodosActions.clearDone,
          TodosActions.todosLoaded,
        ),
        withLatestFrom(this.store.select(selectTodos)),
        tap(([, todos]) => writeStorage(todos)),
      ),
    { dispatch: false },   // ← fire-and-forget; never feed a loop back in
  );
}`,
  devtools: `// provideStoreDevtools instruments the store so the Redux Devtools extension
// can inspect every dispatched action, scrub through state snapshots, and
// "time-travel" — the killer feature of the pattern. Keep it dev-only in prod.
provideStoreDevtools({
  maxAge: 25,                         // retain the last 25 actions
  logOnly: environment.production,    // lock to inspect-only in prod builds
});

// Install the browser extension (Chrome/Firefox "Redux DevTools"), open it on
// this page, and dispatch a few todos — you will see each '[Todos] …' action,
// the diff it produced, and a slider to replay state backwards and forwards.`,
  onepager: `// The four pieces, on one page:
//
//   ACTIONS     plain serialisable objects describing WHAT happened.
//               Built with createActionGroup. The ONLY input to the store.
//
//   REDUCER     a PURE (state, action) => state function. Built with
//               createReducer + on. The ONLY place state is computed.
//               Never side-effect, never mutate — return a new object.
//
//   SELECTORS   memoised read functions. Built with createSelector.
//               Components read them via store.selectSignal(selector) —
//               a signal that updates under OnPush with zero plumbing.
//
//   EFFECTS     RxJS pipelines over the Actions stream. Built with
//               createEffect + ofType. Where side-effects live (HTTP,
//               localStorage, logging) so the reducer can stay pure.`,
};

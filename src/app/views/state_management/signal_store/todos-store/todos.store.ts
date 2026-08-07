/**
 * todos.store.ts — the SignalStore that powers the screen's todo demo.
 *
 * NgRx SignalStore is a factory (`signalStore(...)`) that composes a store
 * class out of FEATURES — small `withX` functions each adding a slice of
 * capability: `withState` (reactive cells), `withComputed` (derived signals),
 * `withMethods` (actions), `withHooks` (onInit/onDestroy). The result is an
 * injectable class holding plain SIGNALS — so components read it with the same
 * `store.todos()` call as any signal and OnPush updates for free. There is no
 * reducer, no action creator, no provider ceremony beyond listing the class in
 * `providers`: it is the SignalStore-as-the-middle-ground the screen teaches.
 *
 * Root-provided: app.config.ts lists `TodosStore` in its `providers` (the v21
 * equivalent of the older `provideState(TodosStore)` helper), making one
 * singleton available app-wide via `inject(TodosStore)`. The todo demo on this
 * screen reads from THAT singleton — any other component in the app could do
 * the same without a prop or a service passed through.
 */
import { computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { pipe } from 'rxjs';
import { debounceTime, tap } from 'rxjs/operators';

import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';

import {
  TODO_FILTERS,
  TODO_SEED,
  TODOS_STORAGE_KEY,
  Todo,
  TodoFilter,
  TodosState,
  nextTodoId,
} from './todo.model';

/**
 * TodosStore — the root-provided SignalStore for the todo feature.
 *
 * `signalStore(...features)` returns an injectable class. Each feature below is
 * one slice of capability; together they read top-to-bottom as the whole state
 * contract: STATE → DERIVED → ACTIONS → LIFECYCLE.
 */
export const TodosStore = signalStore(
  /* 1. STATE — the reactive cells. withState turns each key into a signal. */
  withState<TodosState>({
    todos: TODO_SEED,
    filter: TODO_FILTERS.all,
  }),

  /* 2. COMPUTED — derive, never duplicate. STORE the minimum (todos + filter),
     DERIVE the rest. Every value below recomputes only when its inputs move. */
  withComputed(({ todos, filter }) => {
    const visible = computed(() => {
      const f = filter();
      if (f === TODO_FILTERS.active) return todos().filter((t) => !t.done);
      if (f === TODO_FILTERS.done) return todos().filter((t) => t.done);
      return todos();
    });
    const remaining = computed(() => todos().filter((t) => !t.done).length);
    const doneCount = computed(() => todos().filter((t) => t.done).length);
    const totalCount = computed(() => todos().length);
    return { visible, remaining, doneCount, totalCount };
  }),

  /* 3. METHODS — the actions. `patchState` is the immutable-update helper: it
     takes a partial object OR a `(state) => Partial<State>` updater and always
     produces a new reference (signal equality is ===, so never mutate). */
  withMethods((store) => ({
    add(text: string) {
      const trimmed = text.trim();
      if (!trimmed) return;
      patchState(store, (s) => ({
        todos: [...s.todos, { id: nextTodoId(), text: trimmed, done: false }],
      }));
    },
    toggle(id: number) {
      patchState(store, (s) => ({
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      }));
    },
    remove(id: number) {
      patchState(store, (s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
    },
    clearDone() {
      patchState(store, (s) => ({ todos: s.todos.filter((t) => !t.done) }));
    },
    setFilter(filter: TodoFilter) {
      patchState(store, { filter });
    },
  })),

  /* 4. HOOKS — onInit / onDestroy lifecycle. onInit is where SignalStore meets
     RxJS: `rxMethod` wraps an RxJS pipeline into something you can drive with a
     signal's observable. Here we hydrate once from localStorage, then pipe the
     `todos` signal (via toObservable) through a debounced persistence effect. */
  withHooks({
    onInit(store) {
      // One-shot hydration: if a list is persisted, restore it before first paint.
      const stored = readStorage();
      if (stored.length > 0) {
        patchState(store, { todos: stored });
      }

      // RxJS integration: rxMethod + tap. Debounce writes so rapid edits (add,
      // toggle, filter) collapse into one localStorage write 150ms after the
      // last change. The subscription is tied to the store's lifetime.
      const persist = rxMethod<readonly Todo[]>(
        pipe(debounceTime(150), tap((todos) => writeStorage(todos))),
      );
      persist(toObservable(store.todos));
    },
  }),
);

/* -------------------------------------------------------------------------- */
/* localStorage bridge — guarded for SSR / disabled storage.                    */
/* -------------------------------------------------------------------------- */

function readStorage(): readonly Todo[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TODOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Todo[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(todos: readonly Todo[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
  } catch {
    /* quota / disabled storage — ignore; the store still works in-memory. */
  }
}

/**
 * CounterStore — a COMPONENT-LOCAL SignalStore, defined here so the screen can
 * show the root-vs-component contrast side by side. It is intentionally tiny:
 * a count cell + an `inc` method. The view provides it on a single component
 * via `providers: [CounterStore]` (the component-scoped equivalent of listing a
 * store in app.config providers), so two instances of that component get TWO
 * independent stores — unlike the root `TodosStore`, which is one singleton.
 */
export const CounterStore = signalStore(
  withState({ count: 0 }),
  withMethods((store) => ({
    inc() {
      patchState(store, (s) => ({ count: s.count + 1 }));
    },
    reset() {
      patchState(store, { count: 0 });
    },
  })),
);


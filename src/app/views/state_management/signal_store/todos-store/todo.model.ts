/**
 * todo.model.ts — the plain domain types for the SignalStore todos feature.
 *
 * Pure, framework-free value types — exactly what the store's `withState`,
 * `withComputed`, and `withMethods` operate on. Kept separate from the store
 * definition so the shape of a todo is in one place and can be read without
 * pulling in NgRx.
 *
 * Convention (this whole project): const-object + literal union, NEVER an enum.
 * This project targets erasable-only TypeScript; enums are not erasable, the
 * const-object below gives runtime values AND a literal union from one decl.
 *
 * Mirrors the Signals + NgRx siblings' model so the three todo demos are
 * directly comparable: same model, different mechanism holding the state
 * (signals / a Redux store / a SignalStore).
 */

/** A single todo item. An interface (not a type) — extendable, declarable. */
export interface Todo {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

/**
 * TODO_FILTERS — the three list filters. const-object + literal union.
 */
export const TODO_FILTERS = {
  all: 'all',
  active: 'active',
  done: 'done',
} as const;
export type TodoFilter = (typeof TODO_FILTERS)[keyof typeof TODO_FILTERS];

export const TODO_FILTER_LABELS: Record<TodoFilter, string> = {
  all: 'All',
  active: 'Active',
  done: 'Done',
};

/** Initial seed — visible state on first load of the screen. */
export const TODO_SEED: readonly Todo[] = [
  { id: 1, text: 'Build the store', done: true },
  { id: 2, text: 'Provide it at the root', done: false },
  { id: 3, text: 'Read signals in the template', done: false },
];

/**
 * State shape held by the store. The list plus the active filter — everything
 * else (visible list, counts) is DERIVED in `withComputed`, never stored.
 */
export interface TodosState {
  readonly todos: readonly Todo[];
  readonly filter: TodoFilter;
}

/** localStorage key used by the persistence hook. */
export const TODOS_STORAGE_KEY = 'adg-signalstore-todos';

/** Monotonic id source (Date.now() would collide on rapid adds in tests). */
let todoIdSeq = 1000;
export function nextTodoId(): number {
  return ++todoIdSeq;
}

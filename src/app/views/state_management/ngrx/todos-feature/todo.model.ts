/**
 * todo.model.ts — the plain domain types for the NgRx todos feature.
 *
 * Pure, framework-free value types — exactly what the reducer and selectors
 * operate on. Kept separate from the actions/reducer/selectors so the shape of
 * a todo is in one place and can be read without pulling in NgRx.
 *
 * Convention (this whole project): const-object + literal union, NEVER an enum.
 * This project targets erasable-only TypeScript; enums are not erasable, the
 * const-object below gives runtime values AND a literal union from one decl.
 */

/** A single todo item. An interface (not a type) — extendable, declarable. */
export interface Todo {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

/**
 * TODO_FILTERS — the three list filters. const-object + literal union.
 * Mirrors the Signals sibling's filter so the two demos are directly
 * comparable: same model, different mechanism holding the state.
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
  { id: 1, text: 'Wire up the store', done: true },
  { id: 2, text: 'Dispatch an action', done: false },
  { id: 3, text: 'Read it with selectSignal', done: false },
];

/** State shape held under the `todos` key of the global store. */
export interface TodosState {
  readonly todos: readonly Todo[];
  readonly filter: TodoFilter;
}

/** localStorage key used by the persistence effect. */
export const TODOS_STORAGE_KEY = 'adg-ngrx-todos';

/** Monotonic id source (Date.now() would collide on rapid adds in tests). */
let todoIdSeq = 1000;
export function nextTodoId(): number {
  return ++todoIdSeq;
}

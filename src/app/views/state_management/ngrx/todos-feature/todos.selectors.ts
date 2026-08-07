/**
 * todos.selectors.ts — memoised read functions over the store.
 *
 * Components never reach into raw state by hand. They call a selector, which
 * is a memoised pure function of the store: it caches its last result and only
 * recomputes when the slice it depends on actually changes. That memoisation
 * is what keeps OnPush components cheap — `selectSignal` reads a selector's
 * cached value and only schedules change detection when that cached value
 * moves.
 *
 * `createSelector(...inputs, projector)` builds a memoised selector. Inputs
 * are other selectors; the projector receives each input's latest value and
 * returns the derived one. Selectors compose — the visible list + every count
 * below is built from `selectTodos` and `selectFilter`, never duplicated.
 */
import { createSelector } from '@ngrx/store';

import { Todo, TODO_FILTERS, TodoFilter, TodosState } from './todo.model';

/** The root state shape. One feature today (`todos`); add more as the app grows. */
export interface AppState {
  todos: TodosState;
}

/** Select the whole slice — the input every other selector in this file reads. */
export const selectTodosState = (state: AppState): TodosState => state.todos;

/** The raw list, memoised. */
export const selectTodos = createSelector(
  selectTodosState,
  (s: TodosState): readonly Todo[] => s.todos,
);

/** The active filter. */
export const selectFilter = createSelector(
  selectTodosState,
  (s: TodosState): TodoFilter => s.filter,
);

/**
 * The visible list — a projector that depends on BOTH the list and the filter.
 * createSelector memoises on the pair: recompute only when either input changes.
 */
export const selectVisibleTodos = createSelector(
  selectTodos,
  selectFilter,
  (todos: readonly Todo[], filter: TodoFilter): readonly Todo[] => {
    if (filter === TODO_FILTERS.active) return todos.filter((t) => !t.done);
    if (filter === TODO_FILTERS.done) return todos.filter((t) => t.done);
    return todos;
  },
);

/** Counts — all derived from selectTodos, all memoised. */
export const selectRemainingCount = createSelector(
  selectTodos,
  (todos: readonly Todo[]): number => todos.filter((t) => !t.done).length,
);

export const selectDoneCount = createSelector(
  selectTodos,
  (todos: readonly Todo[]): number => todos.filter((t) => t.done).length,
);

export const selectTotalCount = createSelector(
  selectTodos,
  (todos: readonly Todo[]): number => todos.length,
);

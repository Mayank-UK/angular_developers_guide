/**
 * todos.reducer.ts — a PURE function: (state, action) => next state.
 *
 * The reducer is the single place store state is computed. It must be pure —
 * no side effects, no Date.now(), no Math.random(), no HTTP — given the same
 * inputs it always returns the same output, which is what makes the store
 * replayable (devtools time-travel) and testable (assert against pure inputs).
 *
 * NgRx reducers never mutate: each `on` handler returns a NEW state object,
 * producing new arrays via spread/map/filter. (NgRx offers `ngrx-immer` for
 * "mutate" syntax, but the immutable form below is the dependency-free
 * baseline and what we teach here.)
 *
 * `createReducer(initialState, on(action, handler)...)` returns a reducer
 * function ready to register under a feature key in `provideStore`.
 */
import { createReducer, on } from '@ngrx/store';

import { TodosActions } from './todos.actions';
import { TODO_FILTERS, TODO_SEED, Todo, TodosState } from './todo.model';

/** The slice's initial state. */
export const initialTodosState: TodosState = {
  todos: TODO_SEED,
  filter: TODO_FILTERS.all,
};

export const todosReducer = createReducer<TodosState>(
  initialTodosState,

  on(TodosActions.addTodo, (state, { text }): TodosState => ({
    ...state,
    todos: [
      ...state.todos,
      {
        // Id assignment is the one "impurity" reducers are normally told to
        // avoid. For this self-contained teaching demo a module-level counter
        // (nextTodoId) keeps ids stable + monotonic without leaking a service
        // into the reducer. In a larger app, generate the id in the component
        // or an effect and pass it in the action payload.
        id: nextFreshId(),
        text,
        done: false,
      },
    ],
  })),

  on(TodosActions.toggleTodo, (state, { id }): TodosState => ({
    ...state,
    todos: state.todos.map((t) =>
      t.id === id ? { ...t, done: !t.done } : t,
    ),
  })),

  on(TodosActions.removeTodo, (state, { id }): TodosState => ({
    ...state,
    todos: state.todos.filter((t) => t.id !== id),
  })),

  on(TodosActions.clearDone, (state): TodosState => ({
    ...state,
    todos: state.todos.filter((t) => !t.done),
  })),

  on(TodosActions.setFilter, (state, { filter }): TodosState => ({
    ...state,
    filter,
  })),

  on(
    TodosActions.todosLoaded,
    (state: TodosState, { todos }: { todos: readonly Todo[] }): TodosState => ({
      ...state,
      todos,
    }),
  ),
);

// Id generator kept in this file so the reducer's one pragmatic impurity is
// visible next to the handler that uses it (see note above).
let idSeq = 1000;
function nextFreshId(): number {
  return ++idSeq;
}

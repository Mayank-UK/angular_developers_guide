/**
 * todos.effects.ts — side-effects that live at the edges of the store.
 *
 * Reducers must be pure. Anything that touches the outside world — HTTP,
 * localStorage, logging, debouncing — belongs in an Effect. An effect is a
 * class field: an RxJS pipeline created with `createEffect` that listens to the
 * `Actions` stream (filtered with `ofType`) and either dispatches a follow-up
 * action or, with `{ dispatch: false }`, performs a fire-and-forget side effect.
 *
 * The two effects below form the canonical persistence pair:
 *   - loadTodos$:   on init, hydrate from localStorage → dispatch todosLoaded.
 *   - persistTodos$: whenever a mutation lands, write the new list back out.
 *
 * This keeps the reducer pure (no localStorage inside it) while still giving
 * the feature durable state across reloads.
 */
import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { map, tap, withLatestFrom } from 'rxjs/operators';

import { TodosActions } from './todos.actions';
import { TODOS_STORAGE_KEY, Todo } from './todo.model';
import { AppState, selectTodos } from './todos.selectors';

@Injectable()
export class TodosEffects {
  private readonly actions$ = inject(Actions);
  private readonly store = inject(Store<AppState>);

  /**
   * Hydrate on init. The component dispatches `loadTodos` in its constructor;
   * this effect reads localStorage and emits `todosLoaded` back to the reducer.
   * If nothing is stored we emit the seed (the reducer replaces state either
   * way), keeping the UI consistent across reloads.
   */
  readonly loadTodos$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TodosActions.loadTodos),
      map(() => {
        const stored = readStorage();
        return TodosActions.todosLoaded({ todos: stored });
      }),
    ),
  );

  /**
   * Persist after each mutation. `withLatestFrom(this.store.select(selectTodos))`
   * pairs the action with the CURRENT store value (the reducer has already run
   * by the time the effect fires), and `tap` writes it to localStorage.
   * `{ dispatch: false }` — this effect talks to the outside world and does NOT
   * feed a new action back into the store (that would be a loop).
   */
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
    { dispatch: false },
  );
}

/**
 * Minimal localStorage bridge, guarded for SSR / disabled storage so the
 * effects never throw in non-browser environments.
 */
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
    /* quota / disabled storage — ignore, the store still works in-memory. */
  }
}

/**
 * todos.actions.ts — the EVENTS the todos feature reacts to.
 *
 * Actions are the ONLY way to change store state. They are plain objects of
 * the shape `{ type: string, payload?: ... }` that DESCRIBE something that
 * happened ("todo #4 was toggled"), never HOW to handle it — that is the
 * reducer's job. Because they are serialisable, they are what the Redux
 * Devtools scrub through, what a test replays, and what an effect listens to.
 *
 * Modern NgRx uses `createActionGroup`, which bundles a feature's action
 * creators in one typed object. Each creator is a function that returns a
 * typed action object; payloads are described by a props() bag. The generated
 * `type` strings are namespaced: `[Todos] Add Todo`, `[Todos] Toggle Todo`.
 */
import { createActionGroup, emptyProps, props } from '@ngrx/store';

import { Todo, TodoFilter } from './todo.model';

export const TodosActions = createActionGroup({
  source: 'Todos',
  events: {
    // Mutations of the list.
    'Add Todo': props<{ text: string }>(),
    'Toggle Todo': props<{ id: number }>(),
    'Remove Todo': props<{ id: number }>(),
    // emptyProps() — an action that carries no payload. (props<Record<...>>()
    // would WRONGLY make the creator expect an argument; emptyProps is the
    // correct call for event-less actions.)
    'Clear Done': emptyProps(),

    // The filter is separate state — its own action.
    'Set Filter': props<{ filter: TodoFilter }>(),

    // Lifecycle actions consumed by the persistence effect (see todos.effects.ts).
    'Load Todos': emptyProps(), // dispatched on init
    'Todos Loaded': props<{ todos: readonly Todo[] }>(), // effect → reducer
  },
});

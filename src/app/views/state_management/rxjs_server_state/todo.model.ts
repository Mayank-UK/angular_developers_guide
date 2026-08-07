/**
 * Todo model + the filter vocabulary for the RxJS / server-state screen's todo
 * demo. Mirrors the shape used by the Signals / NgRx / SignalStore siblings so
 * the same todo app reads the same way across every screen in the section —
 * only the SOURCE of truth changes (here: a simulated server, reached via
 * HttpClient).
 */

/** A single todo item. An interface (not a type) — extendable, declarable. */
export interface Todo {
  readonly id: number;
  readonly text: string;
  readonly done: boolean;
}

/**
 * TODO_FILTERS — a const-object + literal union, NEVER an enum. This project
 * targets erasable-only TypeScript, and enums are not erasable; the const-
 * object gives runtime values AND a literal union from one declaration.
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

/** Payload for POST /api/todos. */
export interface CreateTodoPayload {
  readonly text: string;
}

/** Payload for PUT /api/todos/:id. */
export interface UpdateTodoPayload {
  readonly done: boolean;
}

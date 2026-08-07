import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type {
  CreateTodoPayload,
  Todo,
  UpdateTodoPayload,
} from './todo.model';

/**
 * TodosApiService — the transport layer for the todo demo.
 *
 * This is the teaching view about HttpClient, so importing HttpClient here is
 * the point. It wraps the four CRUD verbs against the simulated `/api/todos`
 * endpoint and returns Observables (the demo component bridges them to signals
 * via `toSignal`).
 *
 * ARCHITECTURE NOTE — in the real app, a view NEVER imports HttpClient. Views
 * resolve data through the DI seam (`POST_REPOSITORY` / `GET_POSTS_USE_CASE` in
 * `core/di/tokens.ts`), and only the DATA layer (`data/remote/PostApiService`)
 * touches HttpClient. This demo bypasses that seam ON PURPOSE because the
 * screen IS teaching HttpClient; the prose on the page calls that out and links
 * the canonical pattern (PostApiService + retryInterceptor + the AppException →
 * Failure → Result pipeline) so the contrast is explicit.
 *
 * Method → REST verb mapping:
 *   list()    GET    /api/todos            → readonly Todo[]
 *   create()  POST   /api/todos            → Todo           (201 semantics)
 *   update()  PUT    /api/todos/:id        → Todo
 *   remove()  DELETE /api/todos/:id        → void           (204)
 */
@Injectable()
export class TodosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/todos';

  list(): Observable<readonly Todo[]> {
    return this.http.get<readonly Todo[]>(this.base);
  }

  create(payload: CreateTodoPayload): Observable<Todo> {
    return this.http.post<Todo>(this.base, payload);
  }

  update(id: number, payload: UpdateTodoPayload): Observable<Todo> {
    return this.http.put<Todo>(`${this.base}/${id}`, payload);
  }

  remove(id: number): Observable<void> {
    return this.http
      .delete<unknown>(`${this.base}/${id}`)
      .pipe(map(() => undefined));
  }
}

/**
 * The discriminated query-state the todo demo renders. Modeled as a const-
 * object + literal union (NEVER an enum). Loading is the initial value; the
 * `switchMap` pipeline emits `loading` on each refresh, then either `error` or
 * `success`. This is the RxJS equivalent of TanStack Query's
 * { isLoading, isError, data }.
 */
export const QUERY_STATUS = {
  loading: 'loading',
  success: 'success',
  error: 'error',
} as const;
export type QueryStatus = (typeof QUERY_STATUS)[keyof typeof QUERY_STATUS];

export interface QueryLoading {
  readonly status: typeof QUERY_STATUS.loading;
}
export interface QuerySuccess {
  readonly status: typeof QUERY_STATUS.success;
  readonly data: readonly Todo[];
}
export interface QueryError {
  readonly status: typeof QUERY_STATUS.error;
  readonly message: string;
  readonly statusText: string;
}
export type QueryState = QueryLoading | QuerySuccess | QueryError;

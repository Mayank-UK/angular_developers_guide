import {
  HttpClient,
  HttpInterceptorFn,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  type Provider,
  EnvironmentInjector,
  createEnvironmentInjector,
  inject,
  DestroyRef,
} from '@angular/core';

/**
 * Builds a component-scoped `HttpClient` wired to the given functional
 * interceptors, WITHOUT leaving the type system.
 *
 * `provideHttpClient(...)` returns `EnvironmentProviders` — a branded type
 * meant for the root (or a route) injector. The brand exists precisely to
 * discourage component-scope use, so coercing it with `as unknown as Provider`
 * (the pattern this replaces) is a type-system escape hatch.
 *
 * The type-safe, Angular-blessed way to honour the brand is to construct a
 * child {@link EnvironmentInjector} from those providers and expose its
 * `HttpClient` as a plain {@link Provider} on the component's own injector.
 * Angular resolves every HttpClient provider (backend, interceptor chain,
 * XSRF tokens, …) INSIDE the child injector, so:
 *   - the parent application's `HttpClient` (and its global interceptors, e.g.
 *     this app's retryInterceptor) are NOT in the chain — the subtree owns a
 *     fully independent HttpClient; and
 *   - the interceptors passed here are the ONLY ones that run for this
 * subtree's requests.
 *
 * The child injector is destroyed with the host component (via DestroyRef) so
 * any state the interceptors hold (a request log, an in-memory store, …) is
 * cleaned up alongside it.
 *
 * Used by the RxJS / server-state screen to layer a self-contained demo
 * HttpClient over a simulated `/api/todos` backend without touching the rest
 * of the app.
 */
export function provideScopedHttpClient(
  interceptors: ReadonlyArray<HttpInterceptorFn>,
  debugName = 'ScopedHttpClient',
): Provider {
  return {
    provide: HttpClient,
    useFactory: (parent: EnvironmentInjector): HttpClient => {
      const child = createEnvironmentInjector(
        [provideHttpClient(withInterceptors([...interceptors]))],
        parent,
        debugName,
      );
      // Tie the child injector's lifetime to the component that resolved this
      // provider — otherwise the interceptor state would outlive the demo.
      inject(DestroyRef).onDestroy(() => child.destroy());
      return child.get(HttpClient);
    },
    deps: [EnvironmentInjector],
  };
}

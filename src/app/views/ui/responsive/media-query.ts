import { DestroyRef, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { Signal } from '@angular/core';

/**
 * createMediaQuerySignal — a dependency-free bridge between a CSS media query
 * and Angular signals. Returns a read-only `Signal<boolean>` that is `true`
 * while the query currently matches the viewport and updates automatically
 * whenever it crosses the threshold.
 *
 * This is the standard way to react to viewport changes in TypeScript when CSS
 * alone cannot express the branch (choosing how much data to fetch, swapping a
 * data source, mounting a heavy component only on large screens, etc.). The
 * template can then read the signal directly inside `@if` / `@switch`.
 *
 * Why not `@angular/cdk/layout` `BreakpointObserver`? It is the canonical
 * option and perfectly fine to reach for — but it pulls `@angular/cdk` into
 * your dependency graph for something the platform already provides via
 * `window.matchMedia`. This helper is the entire surface area you actually
 * need: a signal plus a listener that is cleaned up in `DestroyRef.onDestroy`.
 *
 * Cleanup matters: a `matchMedia` listener survives the component, so always
 * detach it (here, via `DestroyRef`) — otherwise the handler leaks and keeps
 * the component's closure alive across navigations.
 *
 * Usage:
 *   readonly isMobile = createMediaQuerySignal('(max-width: 767px)');
 *   // then in template: @if (isMobile()) { <mobile-nav/> }
 */
export function createMediaQuerySignal(query: string): Signal<boolean> {
  // `DOCUMENT` is the SSR-safe way to reach `window`; under SSR there is no
  // viewport to query, so report non-matching and never subscribe.
  const window = inject(DOCUMENT).defaultView;
  if (!window) {
    return signal(false).asReadonly();
  }

  const mql = window.matchMedia(query);
  const matches = signal(mql.matches);

  const handler = (event: MediaQueryListEvent): void => {
    matches.set(event.matches);
  };
  mql.addEventListener('change', handler);
  inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', handler));

  return matches.asReadonly();
}

import {
  HttpEvent,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Observable, shareReplay, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * cachingInterceptor — a FUNCTIONAL HttpInterceptorFn that caches GET responses
 * in memory with a time-to-live. Demonstrates TWO of the most common RxJS
 * caching ideas:
 *
 *  1. shareReplay — "replay the last emission to new subscribers". A cold
 *     Observable (like an HttpClient call) re-runs its producer for EACH
 *     subscriber; `shareReplay({ bufferSize: 1, refCount: true })` turns it
 *     into a hot, replaying stream so concurrent + immediately-following
 *     subscribers share ONE network request and all get the same response.
 *  2. time-based invalidation — entries older than the TTL are refetched on the
 *     next read, modeling "stale-while-revalidate" without a cache library.
 *
 * This interceptor is a TEACHING ARTIFACT (its source is rendered in a
 * CodeBlock). It is NOT wired into the live demo — the todo demo deliberately
 * re-fetches on demand so the request log shows every call. The service-level
 * `shareReplay` snippet on the page shows the same idea applied to a single
 * endpoint, which is the more common placement (cache per-query, not globally).
 *
 * Cache key = method + url. Only GET is cached (writes must always hit the
 * server). The cache is a plain module-level Map — a real app would scope it
 * per feature or move it behind the repository seam.
 */
interface CacheEntry {
  readonly expiry: number;
  readonly stream: Observable<HttpEvent<unknown>>;
}

const DEFAULT_TTL_MS = 5_000;
const cache = new Map<string, CacheEntry>();

function keyFor(req: HttpRequest<unknown>): string {
  return `${req.method} ${req.urlWithParams}`;
}

function isFresh(entry: CacheEntry, now: number): boolean {
  return entry.expiry > now;
}

/**
 * A small wrapper that records the body's size on the cached response so the
 * screen can render "cached: N items" — purely cosmetic; remove the `tap` and
 * this collapses to a plain pass-through.
 */
export const cachingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method.toUpperCase() !== 'GET') {
    return next(req); // never cache writes
  }

  const key = keyFor(req);
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && isFresh(hit, now)) {
    return hit.stream; // serve from cache — no network
  }

  const stream = next(req).pipe(
    tap((ev) => {
      if (ev instanceof HttpResponse) {
        // eslint-disable-next-line no-console
        console.log(`[cache] miss → fetched ${key}`);
      }
    }),
    // shareReplay: ONE request is shared across concurrent subscribers AND the
    // last response is replayed to any subscriber that arrives within the TTL
    // window (bufferSize: 1, refCount: true → unsubscribes when idle).
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  cache.set(key, { expiry: now + DEFAULT_TTL_MS, stream });
  // Proactive eviction: clear the entry when its TTL elapses.
  timer(DEFAULT_TTL_MS).subscribe(() => {
    const current = cache.get(key);
    if (current && !isFresh(current, Date.now())) cache.delete(key);
  });

  return stream;
};

/** Test helper + the screen's "invalidate" button. */
export function clearCache(): void {
  cache.clear();
}

import { UMAMI_ID, UMAMI_SRC } from '../../environments/analytics';

/**
 * Self-hosted Umami analytics — a runtime beacon loader + a typed event
 * wrapper. NO npm dependency: the beacon is a plain `<script defer>` tag
 * injected into <head> once per document, and events call the global
 * `window.umami.track(name, data)` that the beacon installs.
 *
 * CONFIGURATION (build-time — Angular reads no env vars, so the values are
 * constants in `src/environments/analytics.ts`, placeholder tokens that the
 * production Dockerfile swaps with sed before `ng build`):
 * - `UMAMI_SRC` — the beacon script URL (e.g. https://umami…/script.js)
 * - `UMAMI_ID`  — the Umami website id (rendered as data-website-id)
 *
 * BOTH must be valid for analytics to exist at all. A value is UNSET when it
 * is empty or still an unreplaced placeholder token (any `__`-prefix) — the
 * dev/test default is therefore a COMPLETE no-op: no script tag is injected
 * and `trackEvent` sends nothing, without a single conditional at the call
 * sites. Both values are PUBLIC (visible in the served page source anyway),
 * so they ride repository variables, never secrets.
 *
 * The beacon script is async (defer + runtime-inserted): events emitted in
 * the window between injection and evaluation — exactly a cold deep link's
 * init-time `topic-open` — find `window.umami` still undefined. Those
 * events are QUEUED in order and flushed by the script's load event (or by
 * the next trackEvent once the global exists); a failed/blocked load drops
 * the queue so nothing leaks or replays stale.
 */

/** Marks the injected beacon so initAnalytics stays idempotent per
 * document (dev double-init, rerenders). */
const UMAMI_SCRIPT_ID = 'umami-analytics';

/** The Umami beacon's global handle — absent until the script loads (and
 * forever, when analytics is unconfigured). Narrowed to the one method we
 * call; the real object carries more, never less. */
declare global {
  interface Window {
    umami?: {
      track: (name: string, data?: Record<string, unknown>) => void;
    };
  }
}

/**
 * The guide's analytics vocabulary — a CLOSED discriminated union: every
 * trackable interaction is exactly one of these two, with its typed
 * payload. No dynamic strings ever reach the beacon. Both events carry the
 * route path of the page they happened on (e.g. '/state-management/ngrx'),
 * so they join cleanly in the dashboard.
 */
export type AnalyticsEvent =
  | { readonly name: 'topic-open'; readonly topic: string }
  | { readonly name: 'copy-code'; readonly topic: string };

/** Payload type per event name, derived from the union above (single
 * source of truth for the trackEvent overloads). */
type EventData<N extends AnalyticsEvent['name']> = Omit<
  Extract<AnalyticsEvent, { name: N }>,
  'name'
>;

/**
 * Events captured before the beacon finished evaluating, in emission
 * order. Drained by the script's load event or by the first trackEvent
 * that sees the global — without this, init-time events on cold deep
 * links would race the async script and silently drop.
 */
const pendingEvents: Array<
  [AnalyticsEvent['name'], Record<string, unknown>]
> = [];

/**
 * Drain the queue in order through the beacon. The queue is cleared
 * BEFORE sending so a re-entrant flush (a track call that itself fires
 * trackEvent) can never double-send an entry.
 */
function flushPendingEvents(): void {
  if (pendingEvents.length === 0) {
    return;
  }
  const queued = pendingEvents.splice(0, pendingEvents.length);
  for (const [name, data] of queued) {
    window.umami?.track(name, data);
  }
}

/**
 * The build-time constants, read at CALL time through this swappable reader
 * (a stale answer is never cached) — the test seam. The Angular unit-test
 * runner rejects vi.mock for relative imports and TestBed DI cannot reach a
 * framework-free module, so the spec drives the configured/unconfigured
 * matrix by replacing `read`; production code never does.
 */
export const analyticsEnv: {
  read: () => { readonly src: string; readonly id: string };
} = {
  read: () => ({ src: UMAMI_SRC, id: UMAMI_ID }),
};

/**
 * BOTH values valid, or null. An empty string or an unreplaced placeholder
 * token (any `__` prefix — what an empty Docker ARG produces) counts as
 * unset: the Dockerfile's empty ARG defaults must disable analytics
 * exactly like an absent variable.
 */
function analyticsConfig(): { readonly src: string; readonly id: string } | null {
  const { src, id } = analyticsEnv.read();
  if (typeof src !== 'string' || src === '' || src.startsWith('__')) {
    return null;
  }
  if (typeof id !== 'string' || id === '' || id.startsWith('__')) {
    return null;
  }
  return { src, id };
}

/**
 * Inject the Umami beacon into <head> — once per document, only when BOTH
 * config values are valid. Called from the root component's init (the app
 * shell constructs once per bootstrap); unconfigured environments (dev,
 * test, CI without the build args) never see a script tag.
 */
export function initAnalytics(): void {
  const config = analyticsConfig();
  if (config === null) {
    return;
  }
  if (document.getElementById(UMAMI_SCRIPT_ID) !== null) {
    return;
  }
  const script = document.createElement('script');
  script.id = UMAMI_SCRIPT_ID;
  script.defer = true;
  script.src = config.src;
  script.setAttribute('data-website-id', config.id);
  document.head.appendChild(script);
  // Async beacon: load → flush what queued during the cold-start window;
  // error (blocked/failed request) → drop the queue, never replay it.
  script.addEventListener('load', flushPendingEvents);
  script.addEventListener('error', () => {
    pendingEvents.length = 0;
  });
}

export function trackEvent(
  name: 'topic-open',
  data: EventData<'topic-open'>,
): void;
export function trackEvent(name: 'copy-code', data: EventData<'copy-code'>): void;
/**
 * Typed wrapper over `window.umami.track(name, data)` — a no-op when
 * analytics is unconfigured (dev/test default). When the beacon has not
 * evaluated yet (`window.umami` undefined: jsdom, the cold-start frames
 * after injection, blocked requests) the event is QUEUED and flushed in
 * order once the script loads — a failed script drops the queue. Never
 * throws.
 */
export function trackEvent(
  name: AnalyticsEvent['name'],
  data: Record<string, unknown>,
): void {
  if (analyticsConfig() === null) {
    return;
  }
  if (typeof window.umami?.track !== 'function') {
    pendingEvents.push([name, data]);
    return;
  }
  // Flush-first so earlier queued events keep their chronological place
  // ahead of this one.
  flushPendingEvents();
  window.umami.track(name, data);
}

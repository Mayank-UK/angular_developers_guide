import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsEnv, initAnalytics, trackEvent } from './analytics';

/* The config source is read at CALL time through the exported analyticsEnv
 * seam — the Angular unit-test runner disables vi.mock for relative
 * imports, so the spec swaps `read` instead (restored in afterEach). Both
 * values valid = configured; every other combination (empty string,
 * unreplaced placeholder token, only one set) must disable analytics
 * entirely. */
const PLACEHOLDER_SRC = '__UMAMI_SRC__';
const PLACEHOLDER_ID = '__UMAMI_ID__';
const SRC = 'https://umami.mayankcodeworks.com/script.js';
const ID = 'e6c1f2a3-8b4d-4c9e-9f0a-1b2c3d4e5f67';

let stubSrc = PLACEHOLDER_SRC;
let stubId = PLACEHOLDER_ID;
analyticsEnv.read = () => ({ src: stubSrc, id: stubId });

/** Installs a capturing stand-in for the beacon's global and returns the
 * track spy — the loader never runs in jsdom, so the global is whatever a
 * test puts there. */
function installUmami(): ReturnType<typeof vi.fn> {
  const track = vi.fn();
  window.umami = { track };
  return track;
}

/** The injected beacon element (call only after initAnalytics in a
 * configured build — asserts it exists so the cast below is honest). */
function injectedScript(): HTMLScriptElement {
  const scripts = document.querySelectorAll('head script#umami-analytics');
  expect(scripts).toHaveLength(1);
  return scripts[0] as HTMLScriptElement;
}

describe('analytics', () => {
  afterEach(() => {
    // Back to the committed defaults (unreplaced placeholders = disabled).
    stubSrc = PLACEHOLDER_SRC;
    stubId = PLACEHOLDER_ID;
    vi.restoreAllMocks();
    delete window.umami;
    // Drop anything a test queued while the beacon was absent — the
    // queue is module-level and would otherwise leak into the next
    // test. A detached script's listeners still fire, so the error
    // handler clears it before the element goes away.
    document.getElementById('umami-analytics')?.dispatchEvent(new Event('error'));
    document.getElementById('umami-analytics')?.remove();
  });

  describe('unconfigured = complete no-op', () => {
    it('injects no script tag and trackEvent does not crash or send (unreplaced placeholders)', () => {
      const track = installUmami();

      initAnalytics();
      expect(document.querySelectorAll('head script')).toHaveLength(0);

      // No crash without a global, and — stronger — nothing is sent
      // or queued even if some other script happened to install a
      // track global: an unconfigured build never reports.
      trackEvent('topic-open', { topic: '/ngrx' });
      expect(track).not.toHaveBeenCalled();
    });

    it('stays a no-op for empty values (the Docker empty-arg path)', () => {
      stubSrc = '';
      stubId = '';
      initAnalytics();
      expect(document.querySelectorAll('head script')).toHaveLength(0);
    });

    it('stays a no-op when only ONE of the two values is valid', () => {
      stubSrc = SRC;
      initAnalytics();
      expect(document.querySelectorAll('head script')).toHaveLength(0);

      stubId = ID;
      stubSrc = '';
      initAnalytics();
      expect(document.querySelectorAll('head script')).toHaveLength(0);
    });
  });

  describe('pre-load event queue (cold deep-link window)', () => {
    it('queues events instead of sending or throwing while the global is absent', () => {
      stubSrc = SRC;
      stubId = ID;
      // Script injected, but jsdom never evaluates it — exactly the
      // cold deep-link race: window.umami still undefined.
      initAnalytics();

      expect(() =>
        trackEvent('topic-open', { topic: '/state-management' }),
      ).not.toThrow();

      // The queued event is NOT eagerly flushed by the global merely
      // appearing — only the load event (or a later trackEvent) does.
      const track = installUmami();
      expect(track).not.toHaveBeenCalled();
    });

    it("flushes queued events in order on the script's load event", () => {
      stubSrc = SRC;
      stubId = ID;
      initAnalytics();

      // Two events queue during the cold window…
      trackEvent('topic-open', { topic: '/state-management' });
      trackEvent('copy-code', { topic: '/state-management' });

      // …then the beacon evaluates (jsdom never runs it, so simulate
      // its load event) and its global exists.
      const track = installUmami();
      injectedScript().dispatchEvent(new Event('load'));

      expect(track).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenNthCalledWith(1, 'topic-open', {
        topic: '/state-management',
      });
      expect(track).toHaveBeenNthCalledWith(2, 'copy-code', {
        topic: '/state-management',
      });
    });

    it('drops the queue when the script fails to load (no stale replay)', () => {
      stubSrc = SRC;
      stubId = ID;
      initAnalytics();
      trackEvent('topic-open', { topic: '/debugging' });
      trackEvent('copy-code', { topic: '/debugging' });

      // Blocked beacon: the queue is discarded…
      injectedScript().dispatchEvent(new Event('error'));

      // …so when a global appears anyway (or a later event fires),
      // only the NEW event is sent — nothing replays.
      const track = installUmami();
      trackEvent('copy-code', { topic: '/testing' });
      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenNthCalledWith(1, 'copy-code', {
        topic: '/testing',
      });
    });
  });

  describe('configured beacon', () => {
    it('injects exactly one deferred script tag with both attributes', () => {
      stubSrc = SRC;
      stubId = ID;

      initAnalytics();
      // Repeated calls never stack a second beacon.
      initAnalytics();
      initAnalytics();

      const scripts = document.querySelectorAll('head script#umami-analytics');
      expect(scripts).toHaveLength(1);
      const script = scripts[0] as HTMLScriptElement;
      expect(script.getAttribute('src')).toBe(SRC);
      expect(script.getAttribute('data-website-id')).toBe(ID);
      expect(script.defer).toBe(true);
    });

    it('trackEvent passes name + data straight through to the beacon', () => {
      stubSrc = SRC;
      stubId = ID;
      const track = installUmami();

      // One call per union member — also proves each payload shape
      // compiles against its overload (no dynamic strings).
      trackEvent('topic-open', { topic: '/state-management/ngrx' });
      trackEvent('copy-code', { topic: '/state-management/ngrx' });

      expect(track).toHaveBeenCalledTimes(2);
      expect(track).toHaveBeenNthCalledWith(1, 'topic-open', {
        topic: '/state-management/ngrx',
      });
      expect(track).toHaveBeenNthCalledWith(2, 'copy-code', {
        topic: '/state-management/ngrx',
      });
    });
  });
});

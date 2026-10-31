import { afterEach, describe, expect, it, vi } from 'vitest';
import { crashTelemetryEnv, initCrashTelemetry } from './crash-telemetry';

/* The config source is read at CALL time through the exported
 * crashTelemetryEnv seam — the Angular unit-test runner disables vi.mock for
 * relative imports, so the spec swaps `read` instead (restored in afterEach),
 * mirroring analytics.spec.ts. Both values valid = configured; every other
 * combination (empty string, unreplaced placeholder token, only one set)
 * must disable telemetry entirely. */
const PLACEHOLDER_URL = '__FARO_URL__';
const PLACEHOLDER_APP = '__FARO_APP__';
const URL = 'https://faro.mayankcodeworks.com/collect';
const APP = 'angulardevelopersguide';

const SDK_SRC =
  'https://cdn.jsdelivr.net/npm/@grafana/faro-web-sdk@1/dist/bundle/faro-web-sdk.iife.js';

let stubUrl = PLACEHOLDER_URL;
let stubApp = PLACEHOLDER_APP;
crashTelemetryEnv.read = () => ({ url: stubUrl, app: stubApp });

/** Installs a capturing stand-in for the SDK's global and returns the
 * initializeFaro spy — the CDN bundle never runs in jsdom, so the global is
 * whatever a test puts there. */
function installFaro(): ReturnType<typeof vi.fn> {
  const initializeFaro = vi.fn();
  window.GrafanaFaroWebSdk = { initializeFaro };
  return initializeFaro;
}

/** The injected beacon element (call only after initCrashTelemetry in a
 * configured build — asserts it exists so the cast below is honest). */
function injectedScript(): HTMLScriptElement {
  const scripts = document.querySelectorAll('head script#faro-crash-telemetry');
  expect(scripts).toHaveLength(1);
  return scripts[0] as HTMLScriptElement;
}

describe('crash telemetry', () => {
  afterEach(() => {
    // Back to the committed defaults (unreplaced placeholders = disabled).
    stubUrl = PLACEHOLDER_URL;
    stubApp = PLACEHOLDER_APP;
    vi.restoreAllMocks();
    delete window.GrafanaFaroWebSdk;
    document.getElementById('faro-crash-telemetry')?.remove();
  });

  describe('unconfigured = complete no-op', () => {
    it('injects no script tag (unreplaced placeholders)', () => {
      initCrashTelemetry();
      expect(document.querySelectorAll('head script')).toHaveLength(0);
    });

    it('stays a no-op for empty values (the Docker empty-arg path)', () => {
      stubUrl = '';
      stubApp = '';
      initCrashTelemetry();
      expect(document.querySelectorAll('head script')).toHaveLength(0);
    });

    it('stays a no-op when only ONE of the two values is valid', () => {
      stubUrl = URL;
      initCrashTelemetry();
      expect(document.querySelectorAll('head script')).toHaveLength(0);

      stubApp = APP;
      stubUrl = '';
      initCrashTelemetry();
      expect(document.querySelectorAll('head script')).toHaveLength(0);
    });
  });

  describe('configured beacon', () => {
    it('injects exactly one deferred script tag with the pinned CDN src', () => {
      stubUrl = URL;
      stubApp = APP;

      initCrashTelemetry();
      // Repeated calls never stack a second beacon.
      initCrashTelemetry();
      initCrashTelemetry();

      const scripts = document.querySelectorAll('head script#faro-crash-telemetry');
      expect(scripts).toHaveLength(1);
      const script = scripts[0] as HTMLScriptElement;
      expect(script.getAttribute('src')).toBe(SDK_SRC);
      expect(script.defer).toBe(true);
    });

    it('initializes with url + app and environment production on the load event', () => {
      stubUrl = URL;
      stubApp = APP;
      initCrashTelemetry();

      const initializeFaro = installFaro();
      // Not eagerly initialized — only the bundle's load event does.
      expect(initializeFaro).not.toHaveBeenCalled();

      injectedScript().dispatchEvent(new Event('load'));
      expect(initializeFaro).toHaveBeenCalledTimes(1);
      expect(initializeFaro).toHaveBeenCalledWith({
        url: URL,
        app: { name: APP, environment: 'production' },
      });
    });

    it('never initializes when the script fails to load, even if a global appears', () => {
      stubUrl = URL;
      stubApp = APP;
      initCrashTelemetry();

      injectedScript().dispatchEvent(new Event('error'));
      const initializeFaro = installFaro();
      expect(initializeFaro).not.toHaveBeenCalled();
    });
  });
});

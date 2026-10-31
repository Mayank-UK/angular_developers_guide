import { FARO_APP, FARO_URL } from '../../environments/analytics';

/**
 * Grafana Faro browser-crash telemetry — a runtime beacon loader, ported from
 * the react guide's crash-telemetry.ts onto THIS repo's analytics carrier (the
 * Umami pattern: Angular reads no env vars at build time, so the values are
 * placeholder-token constants in `src/environments/analytics.ts` that the
 * production Dockerfile swaps with sed before `ng build`). NO npm dependency:
 * the SDK is the official CDN IIFE bundle (jsdelivr, pinned to major @1),
 * injected into <head> as a plain `<script defer>` once per document and
 * initialized with the MINIMAL config once it evaluates.
 *
 * CONFIGURATION:
 * - `FARO_URL` — the collector endpoint (e.g. https://faro…/collect)
 * - `FARO_APP` — the app name registered with the collector
 *
 * BOTH must be valid for telemetry to exist at all. A value is UNSET when it
 * is empty or still an unreplaced placeholder token (any `__`-prefix) — the
 * dev/test default is therefore a COMPLETE no-op: no script tag is injected
 * and nothing initializes, without a single conditional at the call sites.
 * Both values are PUBLIC (the browser ships them to the collector anyway), so
 * they ride repository variables, never secrets.
 *
 * The CDN bundle installs `window.GrafanaFaroWebSdk` — NOT `window.Faro`
 * (that shape is Grafana's outdated docs; verified against the shipped @1
 * bundle). `initializeFaro`'s DEFAULTS already capture uncaught errors, so we
 * pass only url + app — no transports, no tracing, no extra instrumentations.
 */

/** The pinned-major CDN bundle. Unlike the Umami src (deployment-specific),
 * the SDK URL is a constant — only the collector endpoint and app name vary
 * per deployment, so they are the sed-swapped tokens. */
const FARO_SDK_SRC =
  'https://cdn.jsdelivr.net/npm/@grafana/faro-web-sdk@1/dist/bundle/faro-web-sdk.iife.js';

/** Marks the injected beacon so initCrashTelemetry stays idempotent per
 * document (dev double-init, rerenders). */
const FARO_SCRIPT_ID = 'faro-crash-telemetry';

/** The SDK's global handle — absent until the bundle evaluates (and forever,
 * when telemetry is unconfigured). Narrowed to the one method we call; the
 * real object carries more, never less. */
declare global {
  interface Window {
    GrafanaFaroWebSdk?: {
      initializeFaro: (config: {
        url: string;
        app: { name: string; environment: string };
      }) => void;
    };
  }
}

/**
 * The build-time constants, read at CALL time through this swappable reader
 * (a stale answer is never cached) — the same test seam analytics.ts uses:
 * the Angular unit-test runner rejects vi.mock for relative imports, so the
 * spec drives the configured/unconfigured matrix by replacing `read`;
 * production code never does.
 */
export const crashTelemetryEnv: {
  read: () => { readonly url: string; readonly app: string };
} = {
  read: () => ({ url: FARO_URL, app: FARO_APP }),
};

/**
 * BOTH values valid, or null. An empty string or an unreplaced placeholder
 * token (any `__` prefix — what an empty Docker ARG produces) counts as
 * unset: the Dockerfile's empty ARG defaults must disable telemetry exactly
 * like an absent variable.
 */
function crashTelemetryConfig(): { readonly url: string; readonly app: string } | null {
  const { url, app } = crashTelemetryEnv.read();
  if (typeof url !== 'string' || url === '' || url.startsWith('__')) {
    return null;
  }
  if (typeof app !== 'string' || app === '' || app.startsWith('__')) {
    return null;
  }
  return { url, app };
}

/**
 * Inject the Faro beacon into <head> — once per document, only when BOTH
 * config values are valid. Called from the root component's init (the app
 * shell constructs exactly once per bootstrap); unconfigured environments
 * (dev, test, CI without the build args) never see a script tag.
 */
export function initCrashTelemetry(): void {
  const config = crashTelemetryConfig();
  if (config === null) {
    return;
  }
  if (document.getElementById(FARO_SCRIPT_ID) !== null) {
    return;
  }
  const script = document.createElement('script');
  script.id = FARO_SCRIPT_ID;
  script.defer = true;
  script.src = FARO_SDK_SRC;
  document.head.appendChild(script);
  // Bundle evaluated → global appeared → initialize once with the minimal
  // payload. A failed/blocked load simply never initializes ({ once: true }
  // also makes a stray duplicate load event inert).
  script.addEventListener(
    'load',
    () => {
      window.GrafanaFaroWebSdk?.initializeFaro({
        url: config.url,
        app: { name: config.app, environment: 'production' },
      });
    },
    { once: true },
  );
}

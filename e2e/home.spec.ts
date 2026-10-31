import { expect, test, type ConsoleMessage } from '@playwright/test';

/** The 15 section cards the home hub links out to — the guide's index. */
const EXPECTED_SECTION_COUNT = 15;

/**
 * Home is the guide's navigation hub: the shared shell's header carries the
 * site h1 on every page, and the hub view inside <main> adds its own h1 +
 * a grid of cards linking to every section. These specs pin the deployment
 * wiring, not the design: that the server returns the right document, that
 * Angular actually booted and rendered the full index, and that the page
 * loads without a single console error — the fastest signals that the
 * nginx image serves the RIGHT build (hashed chunk paths resolve, the SPA
 * fallback works, nothing 404s).
 */
test('the document served is the guide home page', async ({ page }) => {
    const response = await page.goto('/');

    // SPA fallback: / hits index.html directly.
    expect(response?.status()).toBe(200);
    // Route title via the router's TitleStrategy (index.html's placeholder
    // is replaced at bootstrap).
    await expect(page).toHaveTitle("Angular developer's guide");
});

test('the home hub renders the full guide index', async ({ page }) => {
    await page.goto('/');

    // Angular booted: the hub view's h1 (inside <main>, distinct from the
    // shell header's site-wide h1) carries the home route title.
    await expect(
        page
            .locator('main')
            .getByRole('heading', { level: 1, name: "Angular developer's guide" }),
    ).toBeVisible();

    // The index is a grid of link cards — every section present, none
    // dropped or doubled. The count pins the nav map's completeness.
    const cards = page.locator('main section.grid').getByRole('link');
    await expect(cards).toHaveCount(EXPECTED_SECTION_COUNT);

    // Spot checks across the whole guide: the first and last topics plus
    // the hub links. A broken asset load (missing lazy chunk) leaves the
    // grid empty, so any visible card here means the build is wired.
    await expect(cards.filter({ hasText: 'Angular fundamentals' })).toBeVisible();
    await expect(cards.filter({ hasText: 'State management' })).toBeVisible();
    await expect(cards.filter({ hasText: 'Best practices' })).toBeVisible();
});

/**
 * The Grafana Faro crash beacon (src/ui/analytics/crash-telemetry.ts) ships
 * in the CI image, and its SDK logs an error-level console message whenever
 * the collector endpoint is unreachable from the test browser — the e2e run
 * must not depend on the collector's health. The SDK emits that noise
 * itself (umami's beacon fails silently via sendBeacon, which is why it
 * never needed this), so the gate allowlists ONLY messages that originate
 * from the faro SDK — identified by its `@grafana/faro-web-sdk` prefix or
 * the pinned CDN bundle in the stack trace. Everything else, including a
 * genuine app error, still fails the test.
 */
function isFaroBeaconNoise(text: string): boolean {
    return (
        text.includes('@grafana/faro-web-sdk') ||
        text.includes('faro-web-sdk.iife.js')
    );
}

/**
 * The SDK's failed collector POST also surfaces as a BARE resource error
 * ("Failed to load resource: net::ERR_NAME_NOT_RESOLVED") whose URL lives
 * in message.location(), not the text — so attribute it by origin: a failed
 * load of an OFF-origin resource (the faro collector, the CDN bundle) is
 * beacon noise; anything on the served origin is the app's own wiring and
 * must keep failing the test.
 */
const SERVED_ORIGIN = new URL(
    process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8080',
).origin;

function isOffOriginResourceError(message: ConsoleMessage): boolean {
    const url = message.location()?.url ?? '';
    return (
        message.text().startsWith('Failed to load resource') &&
        url !== '' &&
        !url.startsWith(SERVED_ORIGIN)
    );
}

/**
 * With the REAL collector reachable, the browser instead logs a CORS error:
 * the beacon's POST to https://faro…/collect sends a preflight, and the
 * collector's allowed-origins cover the production hostname — NOT the CI/CI-
 * dry-run loopback origin this suite browses from. The message names both
 * ("Access to fetch at '<collector>' from origin '<SERVED_ORIGIN>' …"), so
 * match on that exact shape; a CORS failure on an app-owned resource would
 * have to be same-origin to matter, and same-origin requests don't CORS.
 */
function isOffOriginCorsError(message: ConsoleMessage): boolean {
    return (
        message.text().includes('blocked by CORS policy') &&
        message.text().includes(`from origin '${SERVED_ORIGIN}'`)
    );
}

test('the page boots with zero console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() !== 'error') {
            return;
        }
        if (
            !isFaroBeaconNoise(message.text()) &&
            !isOffOriginResourceError(message) &&
            !isOffOriginCorsError(message)
        ) {
            problems.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        if (!isFaroBeaconNoise(String(error))) {
            problems.push(String(error));
        }
    });

    await page.goto('/');
    // Give the lazy home chunk a beat to finish loading before judging the
    // console.
    await expect(
        page
            .locator('main')
            .getByRole('heading', { level: 1, name: "Angular developer's guide" }),
    ).toBeVisible();
    await page.waitForTimeout(1_000);

    expect(problems).toEqual([]);
});

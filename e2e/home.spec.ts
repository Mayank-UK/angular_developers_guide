import { expect, test } from '@playwright/test';

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

test('the page boots with zero console errors', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            problems.push(message.text());
        }
    });
    page.on('pageerror', (error) => {
        problems.push(String(error));
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

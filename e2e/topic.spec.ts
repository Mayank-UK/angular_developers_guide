import { expect, test } from '@playwright/test';

/**
 * One guide topic, rendered end-to-end: the lazy-loaded view chunk resolves,
 * the view's sections render from the real bundle, and the CodeBlock
 * component still behaves (collapsed by default, expands to the real
 * shipped source). A wrong or broken build — missing chunk, stale asset
 * hash, SPA fallback returning the wrong document — fails at the first
 * assertion.
 */
test('a guide topic renders its sections', async ({ page }) => {
    // Walk in the way a reader does: home index card → topic page (index →
    // content wiring, not just a deep URL that happens to answer).
    await page.goto('/');
    await page.getByRole('link', { name: /Angular fundamentals/ }).click();
    await expect(page).toHaveURL(/\/angular-fundamentals$/);

    // The shell header's site h1 is present on every page.
    await expect(
        page
            .locator('header')
            .getByRole('heading', { level: 1, name: "Angular developer's guide" }),
    ).toBeVisible();

    // Sections render from the lazy view chunk — spot checks across the
    // whole (long) page: the first, a mid, and the last section.
    await expect(
        page.getByRole('heading', { level: 2, name: 'What is Angular?' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { level: 2, name: 'Signals', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { level: 2, name: 'Where these fundamentals go next' }),
    ).toBeVisible();
});

test('code blocks start collapsed and expand to the real source', async ({
    page,
}) => {
    await page.goto('/angular-fundamentals');

    await expect(
        page.getByRole('heading', { level: 2, name: 'Components & templates' }),
    ).toBeVisible();

    // Collapsed by default: every language toggle is aria-expanded=false
    // and NO source <pre> is in the DOM yet (open blocks render the pre,
    // collapsed ones render nothing — @if around the source node).
    const firstTsToggle = page.getByRole('button', { name: /ts/ }).first();
    await expect(firstTsToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('pre')).toHaveCount(0);

    // Expanding reveals the real shipped code.
    await firstTsToggle.click();
    await expect(firstTsToggle).toHaveAttribute('aria-expanded', 'true');
    const firstTsSource = page.locator('pre').first();
    await expect(firstTsSource).toBeVisible();
    await expect(firstTsSource).toContainText('@Component');
    await expect(firstTsSource).toContainText('Hello, {{ name() }}!');
});

/**
 * Global test setup — runs before any spec, after Angular TestBed is
 * initialized (per the `@angular/build:unit-test` `setupFiles` contract).
 *
 * jsdom does not implement `window.matchMedia`, which the ThemeService touches
 * during initial-mode resolution. Polyfill it with a static, non-matching
 * MediaQueryList so component construction does not throw under test.
 * (Mirrors the react guide's `src/test/setup.ts` matchMedia polyfill.)
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string): MediaQueryList =>
        ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList;
}

export {};

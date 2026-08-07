/**
 * Development environment (`ng serve` / `ng build --configuration development`).
 * Replaces environment.ts via fileReplacements.
 */
export const environment = {
    production: false,
    name: 'dev' as const,
    /** Dev defaults to fakes so the app runs with no backend / no browser DB. */
    wiring: {
        remote: 'fake' as 'fake' | 'live',
        db: 'fake' as 'fake' | 'live',
    },
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
    scenario: {
        injectNetworkFailure: false,
        injectTimeout: false,
        injectServerFailure: false,
        injectDbFailure: false,
    },
} as const;

/**
 * Staging environment (`ng build --configuration staging`).
 * Replaces environment.ts via fileReplacements. Staging hits the live backend
 * but can still inject failures for QA.
 */
export const environment = {
    production: false,
    name: 'staging' as const,
    wiring: {
        remote: 'live' as 'fake' | 'live',
        db: 'live' as 'fake' | 'live',
    },
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
    scenario: {
        injectNetworkFailure: false,
        injectTimeout: false,
        injectServerFailure: false,
        injectDbFailure: false,
    },
} as const;

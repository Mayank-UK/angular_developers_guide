/**
 * Production environment (default).
 *
 * Angular's build replaces this file wholesale via `fileReplacements` in
 * angular.json when a non-production configuration is used. So this file is
 * the production shape; `environment.development.ts` / `environment.staging.ts`
 * swap in for `ng serve` and `ng build --configuration staging` respectively.
 *
 * `core/config` turns this raw record into a typed `AppConfig`.
 */
export const environment = {
    production: true,
    name: 'prod' as const,
    /** Swap to 'live' to hit a real backend; 'fake' uses in-memory fakes. */
    wiring: {
        remote: 'fake' as 'fake' | 'live',
        db: 'fake' as 'fake' | 'live',
    },
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
    /** Inject failures into the data path — dev/staging only, ignored in prod. */
    scenario: {
        injectNetworkFailure: false,
        injectTimeout: false,
        injectServerFailure: false,
        injectDbFailure: false,
    },
} as const;

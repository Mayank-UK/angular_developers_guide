/**
 * Umami analytics configuration — build-time values, placeholder by default.
 *
 * Angular does NOT read environment variables at build time, so the family's
 * env-var pattern is adapted: the bundle ships these placeholder tokens and
 * the production Docker image swaps them with `sed` BEFORE `ng build`
 * (`.docker/Dockerfile.prod`). An UNREPLACED token (any `__`-prefixed value)
 * or an empty string counts as unset — local dev, tests, and CI builds
 * without the build args run with analytics completely disabled. See
 * `src/ui/analytics/analytics.ts`.
 *
 * Both values are PUBLIC by design (visible in the served page source
 * anyway): they ride the GitHub repository Variables `UMAMI_SRC` /
 * `UMAMI_ID`, never secrets.
 */
export const UMAMI_SRC: string = '__UMAMI_SRC__';
export const UMAMI_ID: string = '__UMAMI_ID__';

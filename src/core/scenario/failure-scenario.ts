/**
 * FailureScenario — the named failure-injection knobs used by the dev-only
 * FakeApiService / FakeAppDatabase (and the Exception-handling screen).
 * Mirrors the React guide's `ApiScenario` + `DbScenario`, collapsed into a
 * single vocabulary since the Angular environment exposes four independent
 * boolean toggles rather than two single-choice scenarios.
 *
 * Const object + literal union (not an `enum`) for erasable-only TypeScript.
 */
export const FailureScenario = {
  None: 'none',
  NetworkFailure: 'networkFailure',
  Timeout: 'timeout',
  ServerFailure: 'serverFailure',
  DbFailure: 'dbFailure',
} as const;

export type FailureScenario =
  (typeof FailureScenario)[keyof typeof FailureScenario];

export const FAILURE_SCENARIOS: readonly FailureScenario[] =
  Object.values(FailureScenario);

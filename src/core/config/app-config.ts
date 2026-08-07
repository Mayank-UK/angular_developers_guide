/**
 * Application configuration — mirrors the React/Flutter guide's `AppConfig`,
 * adapted to Angular's environment file conventions.
 *
 * Angular's build selects `environment.ts` / `environment.development.ts` /
 * `environment.staging.ts` via `fileReplacements` in angular.json.
 * `createAppConfig(environment)` (see `index.ts`) turns the raw environment
 * record into a typed `AppConfig`.
 *
 * `EnvironmentName` and `FailureScenario` are const objects + literal unions
 * (not `enum`) to stay compatible with erasable-only TypeScript (Angular's
 * default). Pure TS — no Angular import.
 */
export const EnvironmentName = {
  Dev: 'dev',
  Staging: 'staging',
  Prod: 'prod',
} as const;

export type EnvironmentName =
  (typeof EnvironmentName)[keyof typeof EnvironmentName];

export interface ScenarioConfig {
  injectNetworkFailure: boolean;
  injectTimeout: boolean;
  injectServerFailure: boolean;
  injectDbFailure: boolean;
}

export interface WiringConfig {
  remote: 'fake' | 'live';
  db: 'fake' | 'live';
}

export interface AppConfig {
  production: boolean;
  name: EnvironmentName;
  wiring: WiringConfig;
  apiBaseUrl: string;
  scenario: ScenarioConfig;
}

/**
 * Structural shape consumed by `createAppConfig`. Matches the objects exported
 * from `src/environments/environment*.ts`. Declared locally so `core/config`
 * does not depend on the environments folder (which is replaced at build time).
 */
export interface Environment {
  production: boolean;
  name: EnvironmentName;
  wiring: WiringConfig;
  apiBaseUrl: string;
  scenario: ScenarioConfig;
}

export const isDev = (c: AppConfig): boolean => c.name === EnvironmentName.Dev;
export const isStaging = (c: AppConfig): boolean =>
  c.name === EnvironmentName.Staging;
export const isProd = (c: AppConfig): boolean =>
  c.name === EnvironmentName.Prod;

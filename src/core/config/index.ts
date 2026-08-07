import { type AppConfig, type Environment } from './app-config';

/**
 * Build a typed `AppConfig` from an Angular environment record.
 *
 * Angular's build replaces `environment.ts` wholesale via `fileReplacements` in
 * angular.json when a non-production configuration is used (`development`,
 * `staging`). Each environment record already carries the typed shape, so this
 * function is mostly a defensive copy that freezes the wiring/scenario at app
 * start and exposes a single typed seam the rest of `core/` consumes.
 *
 * Pure TS — no Angular import.
 */
export function createAppConfig(env: Environment): AppConfig {
  return {
    production: env.production,
    name: env.name,
    wiring: {
      remote: env.wiring.remote,
      db: env.wiring.db,
    },
    apiBaseUrl: env.apiBaseUrl,
    scenario: {
      injectNetworkFailure: env.scenario.injectNetworkFailure,
      injectTimeout: env.scenario.injectTimeout,
      injectServerFailure: env.scenario.injectServerFailure,
      injectDbFailure: env.scenario.injectDbFailure,
    },
  };
}

export * from './app-config';
export { Logger } from './logger';

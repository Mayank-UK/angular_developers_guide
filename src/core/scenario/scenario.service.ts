import { inject, Injectable, WritableSignal, signal } from '@angular/core';
import { APP_CONFIG } from '../di/tokens';
import type { AppConfig, ScenarioConfig } from '../config/app-config';
import { FailureScenario } from './failure-scenario';

/**
 * ScenarioService — the Angular replacement for the React guide's module-level
 * mutable scenario holder. Holds dev-only failure-injection toggles as
 * `WritableSignal<boolean>`s seeded from `AppConfig.scenario`, so the
 * Exception-handling screen can flip outcomes at runtime and the data layer
 * (FakeApiService / FakeAppDatabase / interceptors) reacts on the next read.
 *
 * `providedIn: 'root'` — a single process-wide instance. The booleans are
 * independent (matching the environment's four flags); the derived
 * `apiScenario()` / `dbScenario()` accessors collapse them to a single
 * `FailureScenario` with a documented priority for switch-style consumers that
 * mirror the React fakes.
 */
@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private readonly config: AppConfig = inject(APP_CONFIG);

  readonly injectNetworkFailure: WritableSignal<boolean> = signal(
    this.config.scenario.injectNetworkFailure,
  );
  readonly injectTimeout: WritableSignal<boolean> = signal(
    this.config.scenario.injectTimeout,
  );
  readonly injectServerFailure: WritableSignal<boolean> = signal(
    this.config.scenario.injectServerFailure,
  );
  readonly injectDbFailure: WritableSignal<boolean> = signal(
    this.config.scenario.injectDbFailure,
  );

  // ---- read accessors the data layer checks ----
  shouldInjectNetworkFailure(): boolean {
    return this.injectNetworkFailure();
  }
  shouldInjectTimeout(): boolean {
    return this.injectTimeout();
  }
  shouldInjectServerFailure(): boolean {
    return this.injectServerFailure();
  }
  shouldInjectDbFailure(): boolean {
    return this.injectDbFailure();
  }

  /**
   * Collapse the API-side toggles into a single `FailureScenario` for switch-
   * style consumers. Priority: timeout > network > server > none (timeouts are
   * a stricter network signal, so they win when both are set).
   */
  apiScenario(): FailureScenario {
    if (this.injectTimeout()) return FailureScenario.Timeout;
    if (this.injectNetworkFailure()) return FailureScenario.NetworkFailure;
    if (this.injectServerFailure()) return FailureScenario.ServerFailure;
    return FailureScenario.None;
  }

  /** Collapse the DB-side toggle into a single `FailureScenario`. */
  dbScenario(): FailureScenario {
    return this.injectDbFailure()
      ? FailureScenario.DbFailure
      : FailureScenario.None;
  }

  /** Reset every toggle back to the seeded config values (dev-screen "reset"). */
  reset(): void {
    const s: ScenarioConfig = this.config.scenario;
    this.injectNetworkFailure.set(s.injectNetworkFailure);
    this.injectTimeout.set(s.injectTimeout);
    this.injectServerFailure.set(s.injectServerFailure);
    this.injectDbFailure.set(s.injectDbFailure);
  }
}

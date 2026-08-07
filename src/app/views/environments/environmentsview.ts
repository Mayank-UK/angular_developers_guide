import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { APP_CONFIG } from '../../../core/di/tokens';
import { EnvironmentName } from '../../../core/config/app-config';

/**
 * EnvironmentsView — how this app keeps dev, staging, and production apart,
 * the Angular way IN THIS APP.
 *
 * Angular does not use Vite's `--mode` / `.env.<mode>` files (the React
 * sibling's mechanism) nor Flutter's `--flavor` / per-flavour entrypoints.
 * Instead it swaps ONE source file wholesale at build time: `angular.json`
 * has a `fileReplacements` block per named configuration that points
 * `src/environments/environment.ts` at `environment.development.ts` or
 * `environment.staging.ts`. The selected file exports the same `environment`
 * const, which `createAppConfig(environment)` freezes into a typed
 * `AppConfig`, which `provideData(config)` reads to wire fake-vs-live sources.
 * One `--configuration` flag selects the flavour; the entire DI graph re-wires
 * with no view changes.
 *
 * This screen is documentation-by-example of the app's OWN environment setup.
 * Every code excerpt below is the REAL source in `src/environments/`,
 * `angular.json`, `src/core/config/`, and `src/data/providers.ts`. The live
 * demos read the REAL `inject(APP_CONFIG)` bound in `app.config.ts`.
 *
 * NOTE: the exported `EnvironmentsView` is declared at the BOTTOM of this file.
 * Its `imports` reference local helper components (EnvInspectorDemo,
 * FlavourPickerDemo) that are block-scoped declarations — the main component
 * must come AFTER every helper it names so its decorator does not read an
 * uninitialized binding at module-evaluation time (the TDZ rule the other view
 * screens follow).
 */

/* -------------------------------------------------------------------------- */
/* Local live demos — declared BEFORE the exported view (TDZ rule).            */
/* -------------------------------------------------------------------------- */

/**
 * EnvInspectorDemo — the CENTERPIECE. Reads the REAL `inject(APP_CONFIG)`
 * resolved through the DI graph bound in `app.config.ts` and displays the
 * current flavour: name, production flag, wiring (fake|live for remote + db),
 * apiBaseUrl, and the scenario block.
 *
 * Because the dev server (`ng serve`) runs the `development` configuration,
 * visiting this screen in dev shows `development / fake`. Building with
 * `--configuration production` and serving that bundle shows the production
 * environment file's values instead — proving the `fileReplacements` swap
 * reached runtime. No environment-specific branch lives in feature code: the
 * component reads the SAME token either way.
 */
@Component({
  selector: 'app-env-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="demo">
      <div class="banner">
        <span class="overline">resolved at runtime from inject(APP_CONFIG)</span>
        <span class="flavour" [class]="' flavour-' + config.name">
          <span class="flavour-dot"></span>
          {{ config.name }} / {{ config.wiring.remote }}
        </span>
      </div>

      <div class="grid">
        <div class="cell">
          <p class="cell-label">name</p>
          <p class="cell-value">
            <code>{{ config.name }}</code>
            <span class="hint">— EnvironmentName literal</span>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">production</p>
          <p class="cell-value">
            <code>{{ config.production }}</code>
            <span class="hint">— gates optimization, logs, devtools</span>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">wiring.remote</p>
          <p class="cell-value">
            <code>{{ config.wiring.remote }}</code>
            <span class="hint">— FakeApiService vs PostApiService</span>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">wiring.db</p>
          <p class="cell-value">
            <code>{{ config.wiring.db }}</code>
            <span class="hint">— FakeAppDatabase vs AppDatabaseImpl</span>
          </p>
        </div>
        <div class="cell cell-wide">
          <p class="cell-label">apiBaseUrl</p>
          <p class="cell-value">
            <code>{{ config.apiBaseUrl }}</code>
          </p>
        </div>
        <div class="cell cell-wide">
          <p class="cell-label">scenario (dev failure injection)</p>
          <p class="cell-value scenario">
            <span
              >injectNetworkFailure:
              <strong>{{ config.scenario.injectNetworkFailure }}</strong></span
            >
            <span
              >injectTimeout:
              <strong>{{ config.scenario.injectTimeout }}</strong></span
            >
            <span
              >injectServerFailure:
              <strong>{{ config.scenario.injectServerFailure }}</strong></span
            >
            <span
              >injectDbFailure:
              <strong>{{ config.scenario.injectDbFailure }}</strong></span
            >
          </p>
        </div>
      </div>

      <pre class="selected"><code>selected by angular.json fileReplacements
  └─ build configuration → <strong>{{ activeBuildConfig }}</strong>
       └─ swaps in <strong>{{ activeEnvFile }}</strong>
            └─ createAppConfig(environment) → provideData(config)
                 └─ wiring → <strong>{{ config.wiring.remote }}/{{ config.wiring.db }}</strong></code></pre>

      <p class="footnote">
        This readout is LIVE: it reads the exact inject(APP_CONFIG) value the
        DI graph built at bootstrap. Run <code>ng serve</code> (development) →
        the banner reads <code>dev / fake</code>. Run
        <code>ng build --configuration staging</code> then serve the bundle → it
        reads <code>staging / live</code>. Same component, same token — only the
        file Angular swapped in changed.
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-xs);
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .overline {
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .flavour {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xs);
        padding: var(--space-xxs) var(--space-sm);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
        background: var(--color-surface);
        border: 1px solid var(--color-outline);
      }
      .flavour-dot {
        width: 8px;
        height: 8px;
        border-radius: var(--radius-pill);
        background: var(--color-on-surface-variant);
      }
      .flavour-dev .flavour-dot {
        background: var(--color-secondary);
      }
      .flavour-staging .flavour-dot {
        background: var(--color-warning);
      }
      .flavour-prod .flavour-dot {
        background: var(--color-primary);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-xs);
      }
      .cell {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .cell-wide {
        grid-column: 1 / -1;
      }
      .cell-label {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .cell-value {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .cell-value code {
        font-family: var(--font-mono);
        color: var(--color-primary);
      }
      .cell-value .hint {
        display: block;
        margin-top: var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .scenario {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-sm);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
      }
      .scenario strong {
        color: var(--color-primary);
      }
      .selected {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        line-height: 1.6;
        color: var(--color-on-surface);
        overflow-x: auto;
        white-space: pre;
      }
      .selected strong {
        color: var(--color-primary);
      }
      .footnote {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
      .footnote code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
    `,
  ],
})
class EnvInspectorDemo {
  readonly config = inject(APP_CONFIG);

  /** Map the runtime env name back to which angular.json build config + file. */
  readonly activeBuildConfig =
    this.config.name === EnvironmentName.Dev
      ? 'development'
      : this.config.name === EnvironmentName.Staging
        ? 'staging'
        : 'production';

  readonly activeEnvFile =
    this.config.name === EnvironmentName.Dev
      ? 'src/environments/environment.development.ts'
      : this.config.name === EnvironmentName.Staging
        ? 'src/environments/environment.staging.ts'
        : 'src/environments/environment.ts';
}

/* -------------------------------------------------------------------------- */
/* Build-command data — the REAL environment file contents, inlined so the    */
/* picker demo can show what each --configuration flag resolves to without a  */
/* rebuild. Mirrors the REAL src/environments/*.ts verbatim.                  */
/* -------------------------------------------------------------------------- */

interface FlavourRow {
  readonly cmd: string;
  readonly config: 'development' | 'staging' | 'production';
  readonly envFile: string;
  readonly name: 'dev' | 'staging' | 'prod';
  readonly production: boolean;
  readonly remote: 'fake' | 'live';
  readonly db: 'fake' | 'live';
  readonly apiBaseUrl: string;
}

const FLAVOURS: readonly FlavourRow[] = [
  {
    cmd: 'ng serve',
    config: 'development',
    envFile: 'src/environments/environment.development.ts',
    name: 'dev',
    production: false,
    remote: 'fake',
    db: 'fake',
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  },
  {
    cmd: 'ng build --configuration staging',
    config: 'staging',
    envFile: 'src/environments/environment.staging.ts',
    name: 'staging',
    production: false,
    remote: 'live',
    db: 'live',
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  },
  {
    cmd: 'ng build',
    config: 'production',
    envFile: 'src/environments/environment.ts',
    name: 'prod',
    production: true,
    remote: 'fake',
    db: 'fake',
    apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  },
];

/**
 * FlavourPickerDemo — pick a build command and see which environment file the
 * `fileReplacements` block swaps in, plus the resulting `AppConfig` values.
 * The data is the REAL contents of the three `src/environments/environment*.ts`
 * files inlined (so the demo can show all three flavours without rebuilding);
 * the live `EnvInspectorDemo` above is what proves the swap actually reached
 * runtime in the current build.
 */
@Component({
  selector: 'app-env-flavour-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="demo">
      <div class="chips">
        @for (f of flavours; track f.cmd) {
          <button
            type="button"
            class="chip"
            [class.active]="selected() === f"
            (click)="select.set(f)"
          >
            <code>{{ f.cmd }}</code>
          </button>
        }
      </div>

      @if (selected(); as f) {
        <div class="resolution">
          <p class="resolution-label">
            fileReplacements for the
            <code>{{ f.config }}</code> configuration
          </p>
          <pre class="resolution-code"><code>replace: src/environments/environment.ts
   with: <strong>{{ f.envFile }}</strong></code></pre>
        </div>

        <div class="grid">
          <div class="cell">
            <p class="cell-label">environment.name</p>
            <p class="cell-value">
              <code>{{ f.name }}</code>
            </p>
          </div>
          <div class="cell">
            <p class="cell-label">production</p>
            <p class="cell-value">
              <code>{{ f.production }}</code>
            </p>
          </div>
          <div class="cell">
            <p class="cell-label">wiring.remote</p>
            <p class="cell-value">
              <code>{{ f.remote }}</code>
              <span class="hint">{{ remoteImpl(f.remote) }}</span>
            </p>
          </div>
          <div class="cell">
            <p class="cell-label">wiring.db</p>
            <p class="cell-value">
              <code>{{ f.db }}</code>
              <span class="hint">{{ dbImpl(f.db) }}</span>
            </p>
          </div>
          <div class="cell cell-wide">
            <p class="cell-label">apiBaseUrl</p>
            <p class="cell-value">
              <code>{{ f.apiBaseUrl }}</code>
            </p>
          </div>
        </div>

        <pre class="tree"><code>{{ f.cmd }}
  └─ configuration: <strong>{{ f.config }}</strong>
       └─ fileReplacements → <strong>{{ f.envFile }}</strong>
            └─ createAppConfig(environment)
                 └─ provideData(config)
                      ├─ POST_REPOSITORY → PostRepositoryImpl
                      │    ├─ remote → <strong>{{ remoteImpl(f.remote) }}</strong>
                      │    └─ db     → <strong>{{ dbImpl(f.db) }}</strong>
                      └─ Logger        → enableLogs = <strong>{{ !f.production }}</strong></code></pre>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .demo {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .chip {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        background: var(--color-surface);
        cursor: pointer;
        font-family: inherit;
        transition: border-color 0.15s, background 0.15s;
      }
      .chip:hover {
        border-color: var(--color-primary);
      }
      .chip.active {
        border-color: var(--color-primary);
        background: var(--color-surface-tint);
      }
      .chip code {
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
      }
      .resolution {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
      }
      .resolution-label {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .resolution-label code {
        font-family: var(--font-mono);
        text-transform: none;
        color: var(--color-on-surface);
      }
      .resolution-code {
        margin: 0;
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
        white-space: pre;
        overflow-x: auto;
      }
      .resolution-code strong {
        color: var(--color-primary);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-xs);
      }
      .cell {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .cell-wide {
        grid-column: 1 / -1;
      }
      .cell-label {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .cell-value {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .cell-value code {
        font-family: var(--font-mono);
        color: var(--color-primary);
      }
      .cell-value .hint {
        display: block;
        margin-top: var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        font-family: var(--font-mono);
      }
      .tree {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface-variant);
        font-family: var(--font-mono);
        font-size: var(--text-body-sm);
        line-height: 1.6;
        color: var(--color-on-surface);
        overflow-x: auto;
        white-space: pre;
      }
      .tree strong {
        color: var(--color-primary);
      }
    `,
  ],
})
class FlavourPickerDemo {
  readonly flavours = FLAVOURS;
  readonly select = signal<FlavourRow>(FLAVOURS[0]);
  readonly selected = computed(() => this.select());

  remoteImpl(r: 'fake' | 'live'): string {
    return r === 'fake' ? 'FakeApiService' : 'PostApiService';
  }
  dbImpl(d: 'fake' | 'live'): string {
    return d === 'fake' ? 'FakeAppDatabase' : 'AppDatabaseImpl';
  }
}

/* -------------------------------------------------------------------------- */
/* The exported screen — declared AFTER its helper imports (TDZ rule).         */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-environments-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    EnvInspectorDemo,
    FlavourPickerDemo,
  ],
  templateUrl: './environments_view.html',
  styleUrl: './environments_view.scss',
})
export class EnvironmentsView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/environments + angular.json +       */
/* src/core/config + src/data/providers.ts + src/app/app.config.ts.            */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  envProd: `// src/environments/environment.ts — PRODUCTION default.
// angular.json ships this file when no --configuration is passed (the build
// defaultConfiguration is "production"). Swap wiring to 'live' to hit a real
// backend; today it stays on fakes so the prod bundle runs offline too.
export const environment = {
  production: true,
  name: 'prod' as const,
  /** Swap to 'live' to hit a real backend; 'fake' uses in-memory fakes. */
  wiring: {
    remote: 'fake' as 'fake' | 'live',
    db:     'fake' as 'fake' | 'live',
  },
  apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  /** Inject failures into the data path — dev/staging only, ignored in prod. */
  scenario: {
    injectNetworkFailure: false,
    injectTimeout: false,
    injectServerFailure: false,
    injectDbFailure: false,
  },
} as const;`,
  envDev: `// src/environments/environment.development.ts — DEVELOPMENT.
// angular.json's "development" configuration replaces environment.ts with this
// file via fileReplacements. The dev server (ng serve) uses the development
// configuration by default, so 'ng serve' → this file is what ships to the
// browser. Dev defaults to fakes so the app runs with no backend / no browser DB.
export const environment = {
  production: false,
  name: 'dev' as const,
  wiring: {
    remote: 'fake' as 'fake' | 'live',
    db:     'fake' as 'fake' | 'live',
  },
  apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  scenario: {
    injectNetworkFailure: false,
    injectTimeout: false,
    injectServerFailure: false,
    injectDbFailure: false,
  },
} as const;`,
  envStaging: `// src/environments/environment.staging.ts — STAGING.
// angular.json's "staging" configuration replaces environment.ts with this file
// via fileReplacements (ng build --configuration staging). Staging hits the live
// backend but can still inject failures for QA.
export const environment = {
  production: false,
  name: 'staging' as const,
  wiring: {
    remote: 'live' as 'fake' | 'live',
    db:     'live' as 'fake' | 'live',
  },
  apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  scenario: {
    injectNetworkFailure: false,
    injectTimeout: false,
    injectServerFailure: false,
    injectDbFailure: false,
  },
} as const;`,
  angularJson: `// angular.json (trimmed) — fileReplacements swaps ONE source file per
// configuration. The build defaultConfiguration is "production"; the serve
// defaultConfiguration is "development". Production has NO fileReplacements
// block — environment.ts ships as-is.
{
  "architect": {
    "build": {
      "builder": "@angular/build:application",
      "configurations": {
        "production": {
          "budgets": [ /* initial + anyComponentStyle limits */ ],
          "outputHashing": "all"
        },
        "staging": {
          "fileReplacements": [
            { "replace": "src/environments/environment.ts",
              "with":     "src/environments/environment.staging.ts" }
          ],
          "optimization": true,
          "extractLicenses": true,
          "sourceMap": false
        },
        "development": {
          "fileReplacements": [
            { "replace": "src/environments/environment.ts",
              "with":     "src/environments/environment.development.ts" }
          ],
          "optimization": false,
          "sourceMap": true
        }
      },
      "defaultConfiguration": "production"
    },
    "serve": {
      "builder": "@angular/build:dev-server",
      "configurations": { /* production / staging / development buildTargets */ },
      "defaultConfiguration": "development"
    }
  }
}`,
  createAppConfig: `// src/core/config/index.ts — the single reader of the environment record.
// Turns the raw object exported by environment*.ts into a typed AppConfig,
// defensively copying the wiring/scenario so they cannot be mutated later.
// Pure TS — no Angular import — so it is unit-testable without TestBed.
export function createAppConfig(env: Environment): AppConfig {
  return {
    production: env.production,
    name: env.name,
    wiring: {
      remote: env.wiring.remote,
      db:     env.wiring.db,
    },
    apiBaseUrl: env.apiBaseUrl,
    scenario: {
      injectNetworkFailure: env.scenario.injectNetworkFailure,
      injectTimeout:        env.scenario.injectTimeout,
      injectServerFailure:  env.scenario.injectServerFailure,
      injectDbFailure:      env.scenario.injectDbFailure,
    },
  };
}

export * from './app-config';
export { Logger } from './logger';`,
  appConfigType: `// src/core/config/app-config.ts — the typed shape every layer consumes.
// Const-object + literal union (NOT enum) so the file stays compatible with
// Angular's erasable-only TypeScript setting.
export const EnvironmentName = {
  Dev:     'dev',
  Staging: 'staging',
  Prod:    'prod',
} as const;
export type EnvironmentName =
  (typeof EnvironmentName)[keyof typeof EnvironmentName];

export interface WiringConfig {
  remote: 'fake' | 'live';
  db:     'fake' | 'live';
}

export interface ScenarioConfig {
  injectNetworkFailure: boolean;
  injectTimeout:        boolean;
  injectServerFailure:  boolean;
  injectDbFailure:      boolean;
}

export interface AppConfig {
  production:  boolean;
  name:        EnvironmentName;
  wiring:      WiringConfig;
  apiBaseUrl:  string;
  scenario:    ScenarioConfig;
}

export const isDev     = (c: AppConfig): boolean => c.name === EnvironmentName.Dev;
export const isStaging = (c: AppConfig): boolean => c.name === EnvironmentName.Staging;
export const isProd    = (c: AppConfig): boolean => c.name === EnvironmentName.Prod;`,
  provideData: `// src/data/providers.ts — provideData reads config.wiring and picks the
// concrete remote + db implementations. ONE field, ONE rebuild, the entire DI
// graph re-wires from in-memory fakes to a live REST + IndexedDB backend.
export function provideData(config: AppConfig): EnvironmentProviders {
  const useFakeRemote = config.wiring.remote === 'fake';
  const useFakeDb     = config.wiring.db     === 'fake';

  const RemoteImpl: Type<PostRemoteDataSource> = useFakeRemote
    ? FakeApiService          // dev: in-memory, reads ScenarioService
    : PostApiService;         // staging/prod: HttpClient + retry interceptor
  const DbImpl: Type<AppDatabase> = useFakeDb
    ? FakeAppDatabase         // dev: in-memory
    : AppDatabaseImpl;        // staging/prod: Dexie/IndexedDB

  const providers: Provider[] = [
    { provide: APP_CONFIG, useValue: config },
    { provide: Logger, useFactory: () => new Logger(config.name, !config.production) },
    RemoteImpl,
    DbImpl,
    { provide: POST_REPOSITORY,
      useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger] },
    { provide: GET_POSTS_USE_CASE,
      useFactory: (repo) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY] },
  ];
  return makeEnvironmentProviders(providers);
}`,
  bootstrap: `// src/app/app.config.ts — the root providers list. createAppConfig reads the
// active environment file (selected by angular.json fileReplacements) and feeds
// provideData, which wires the whole graph before the first component mounts.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([retryInterceptor])),  // live path only
    provideData(createAppConfig(environment)),                 // the DI seam
    // …store/effects providers
  ],
};

// src/main.ts
bootstrapApplication(App, appConfig).catch((err) => console.error(err));`,
  buildFlags: `# Build flags select the flavour. Each maps to a named configuration in
# angular.json, whose fileReplacements block swaps environment.ts.

ng serve                                    # dev server  → development
ng serve  --configuration production        # dev server  → production
ng serve  --configuration staging           # dev server  → staging
ng build                                    # production  (defaultConfiguration)
ng build --configuration development        # development
ng build --configuration staging            # staging

# The selected file is REPLACED AT BUILD TIME — its contents are inlined into
# the bundle. There is no runtime "env switch"; to change flavours, rebuild.`,
  contrast: `Angular fileReplacements vs Vite --mode vs Flutter --flavor:

• Angular — ONE source file per configuration, swapped wholesale by the
  angular.json "fileReplacements" block. The file exports the same ` +
    '`environment`' +
    ` const; createAppConfig(environment) turns it into a typed AppConfig.
  Selected by --configuration at build/serve time. No runtime env switch.

• Vite (the React sibling) — ONE .env.<mode> file per mode, loaded by --mode.
  Only VITE_-prefixed vars reach the client; createAppConfig reads import.meta.env.

• Flutter — typically separate entrypoints (main_dev.dart, main_staging.dart,
  main_prod.dart) + native flavours (Android applicationId suffixes, iOS schemes).
  More moving parts per environment because there is a native layer.

• Secrets — none of these protect a client-bundled secret. Anything inlined into
  the JS the browser downloads is public. Real secrets belong behind a backend.`,
};

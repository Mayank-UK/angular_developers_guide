import {
  InjectionToken,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { APP_CONFIG, GET_POSTS_USE_CASE, POST_REPOSITORY } from '../../../core/di/tokens';
import { getWiring } from '../../../data/providers';

/**
 * DependencyManagementView — how dependencies are wired the Angular way IN
 * THIS APP.
 *
 * "Dependency management" is the question: who constructs the HTTP client, the
 * database, the repository, the use case — and who hands them to whom? The
 * React sibling answers it with a hand-rolled service locator (a `Container`
 * class with a typed accessor per service). Angular has first-class DI, so this
 * app answers it with the platform: `InjectionToken`s name the contracts,
 * `provideData(config)` registers fake-vs-live implementations against them at
 * bootstrap, and any screen resolves what it needs with `inject(TOKEN)` — no
 * prop-drilling, no concrete-singleton import, no service-locator module. One
 * environment flip swaps the entire graph from in-memory fakes to a live REST
 * backend + IndexedDB, and not a single view changes.
 *
 * This screen is documentation-by-example of the app's OWN DI seam. Every code
 * excerpt below is the REAL source in src/core/di, src/data, src/core/config,
 * and src/environments; the two live demos resolve the REAL tokens bound in
 * app.config.ts.
 *
 * NOTE: the exported `DependencyManagementView` is declared at the BOTTOM of
 * this file. Its `imports` reference local helper components (WiringInspector,
 * ProviderRecipesDemo, HierarchyOverrideDemo) that are block-scoped
 * declarations — the main component must come AFTER every helper it names so
 * its decorator does not read an uninitialized binding at module-evaluation
 * time (the TDZ rule the other view screens follow).
 */

/* -------------------------------------------------------------------------- */
/* Local live demos — declared BEFORE the exported view (TDZ rule).            */
/* -------------------------------------------------------------------------- */

/**
 * WiringInspector — the CENTERPIECE #1. Reads the REAL tokens bound in
 * app.config.ts and shows what the DI graph actually resolved to in this run.
 *
 * `inject(APP_CONFIG)` exposes the environment-driven wiring; `getWiring(config)`
 * is the value-based introspection helper from src/data/providers.ts that lets
 * the UI say "fake vs live" WITHOUT `instanceof`-checking data-layer classes
 * (which would violate the rule that ui/ never couples to data/ internals).
 * Reading `instance.constructor.name` is the runtime mirror of the same fact —
 * it shows the concrete class the injector built, with no import of that class.
 */
@Component({
  selector: 'app-di-wiring-inspector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="demo">
      <div class="row">
        <span class="pill">env: {{ config.name }}</span>
        <span class="pill" [class.is-prod]="config.production">
          production: {{ config.production }}
        </span>
        <span class="pill">apiBaseUrl: {{ config.apiBaseUrl }}</span>
      </div>

      <div class="grid">
        <div class="cell">
          <p class="cell-label">APP_CONFIG</p>
          <p class="cell-value">
            <code>{{ config.name }}</code> config — wiring
            <code>{{ '{ remote: ' + config.wiring.remote + ', db: ' + config.wiring.db + ' }' }}</code>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">getWiring(config)</p>
          <p class="cell-value">
            <code>{{ '{ remote: ' + wiring.remote + ', db: ' + wiring.db + ' }' }}</code>
            <span class="hint">— mirrors config.wiring, no instanceof needed</span>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">POST_REPOSITORY</p>
          <p class="cell-value">
            resolved to <code>{{ repoClassName }}</code>
            <span class="hint">— runtime class name of the bound impl</span>
          </p>
        </div>
        <div class="cell">
          <p class="cell-label">GET_POSTS_USE_CASE</p>
          <p class="cell-value">
            resolved to <code>{{ useCaseClassName }}</code>
            <span class="hint">— built by the useFactory in provideData()</span>
          </p>
        </div>
      </div>

      <pre class="tree"><code>GetPostsUseCase
  └─ PostRepositoryImpl
       ├─ PostRemoteDataSource → <strong>{{ remoteLabel }}</strong>
       ├─ AppDatabase           → <strong>{{ dbLabel }}</strong>
       └─ Logger</code></pre>

      <p class="footnote">
        Swapping fake ↔ live is a STARTUP decision: it reads
        <code>AppConfig.wiring</code> inside <code>provideData()</code> at
        bootstrap. To flip it, change <code>wiring</code> in the relevant
        <code>src/environments/environment*.ts</code> and rebuild — the entire
        graph re-wires with no view changes.
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
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-xs);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        background: var(--color-surface);
      }
      .pill.is-prod {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .pill code,
      .cell-value code,
      .footnote code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-xs);
      }
      .cell {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
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
      .cell-value .hint {
        display: block;
        margin-top: var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
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
      }
      .tree strong {
        color: var(--color-primary);
      }
      .footnote {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
    `,
  ],
})
class WiringInspector {
  /** The real tokens, resolved through the DI graph bound in app.config.ts. */
  private readonly repository = inject(POST_REPOSITORY);
  private readonly useCase = inject(GET_POSTS_USE_CASE);
  readonly config = inject(APP_CONFIG);

  /** Value-based introspection — no instanceof, no data-layer import. */
  readonly wiring = getWiring(this.config);

  readonly repoClassName = this.repository.constructor.name;
  readonly useCaseClassName = this.useCase.constructor.name;

  readonly remoteLabel =
    this.wiring.remote === 'fake' ? 'FakeApiService (dev)' : 'PostApiService (live REST)';
  readonly dbLabel =
    this.wiring.db === 'fake' ? 'FakeAppDatabase (in-memory)' : 'AppDatabaseImpl (Dexie/IndexedDB)';
}

/**
 * ProviderRecipesDemo — CENTERPIECE #2. Resolves one token per recipe
 * (useValue / useClass / useFactory / useExisting) plus a multi-provider, all
 * declared on THIS component's providers. The factory records the timestamp at
 * which the injector first ran it; the "bump" button forces a change-detection
 * pass without re-running the factory, proving providers are singletons within
 * an injector (the timestamp does not change).
 */
class GreetingService {
  readonly salute = 'Hello from GreetingService (useClass)';
}

/** A token backed by useValue. */
const DEMO_VALUE = new InjectionToken<string>('DEMO_VALUE (useValue)');
/** A token backed by useClass. */
const DEMO_CLASS = new InjectionToken<GreetingService>('DEMO_CLASS (useClass)');
/** A token backed by useFactory — records when the injector built it. */
const DEMO_FACTORY = new InjectionToken<{ builtAt: number }>(
  'DEMO_FACTORY (useFactory)',
);
/** A token backed by useExisting — an alias of DEMO_CLASS. */
const DEMO_EXISTING = new InjectionToken<GreetingService>(
  'DEMO_EXISTING (useExisting)',
);
/** A multi-provider — every registration is appended to the resolved array. */
const DEMO_MULTI = new InjectionToken<readonly string[]>('DEMO_MULTI (multi)');

@Component({
  selector: 'app-di-provider-recipes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="demo">
      <div class="recipes">
        <div class="recipe">
          <p class="recipe-label">useValue</p>
          <p class="recipe-token">
            <code>DEMO_VALUE</code>
          </p>
          <p class="recipe-out">{{ value }}</p>
        </div>
        <div class="recipe">
          <p class="recipe-label">useClass</p>
          <p class="recipe-token">
            <code>DEMO_CLASS</code>
          </p>
          <p class="recipe-out">{{ klass.salute }}</p>
        </div>
        <div class="recipe">
          <p class="recipe-label">useFactory</p>
          <p class="recipe-token">
            <code>DEMO_FACTORY</code>
          </p>
          <p class="recipe-out">
            built at {{ builtAt }}ms
            <span class="hint" [class.stale]="bump() > 0">
              {{ bump() === 0 ? '(singleton — not re-run on CD)' : '(still singleton — same timestamp after ' + bump() + ' bump(s))' }}
            </span>
          </p>
        </div>
        <div class="recipe">
          <p class="recipe-label">useExisting</p>
          <p class="recipe-token">
            <code>DEMO_EXISTING</code>
          </p>
          <p class="recipe-out">
            {{ existing.salute }}
            <span class="hint">— same instance as DEMO_CLASS: {{ sameInstance ? 'yes' : 'no' }}</span>
          </p>
        </div>
        <div class="recipe recipe--multi">
          <p class="recipe-label">multi: true</p>
          <p class="recipe-token">
            <code>DEMO_MULTI</code>
          </p>
          <p class="recipe-out">
            @for (item of multi; track item) {
              <span class="chip">{{ item }}</span>
            }
          </p>
        </div>
      </div>

      <div class="controls">
        <button type="button" class="btn" (click)="bumpCD()">
          bump change detection ({{ bump() }})
        </button>
        <span class="footnote">
          The factory timestamp stays fixed — Angular instantiates a provider
          once per injector and caches the instance.
        </span>
      </div>
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
      .recipes {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: var(--space-xs);
      }
      .recipe {
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .recipe--multi {
        grid-column: 1 / -1;
      }
      .recipe-label {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-primary);
      }
      .recipe-token {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .recipe-token code,
      .footnote code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
      .recipe-out {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .recipe-out .hint {
        display: block;
        margin-top: var(--space-xxs);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .recipe-out .hint.stale {
        color: var(--color-secondary);
      }
      .chip {
        display: inline-block;
        margin: var(--space-xxs) var(--space-xxs) 0 0;
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-family: var(--font-mono);
        font-size: var(--text-caption);
        color: var(--color-on-surface);
        background: var(--color-surface-variant);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .footnote {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
  providers: [
    GreetingService,
    { provide: DEMO_VALUE, useValue: 'Hello from useValue' },
    { provide: DEMO_CLASS, useClass: GreetingService },
    { provide: DEMO_FACTORY, useFactory: () => ({ builtAt: Date.now() }) },
    { provide: DEMO_EXISTING, useExisting: GreetingService },
    { provide: DEMO_MULTI, useValue: 'one (useValue, multi)', multi: true },
    { provide: DEMO_MULTI, useValue: 'two (useValue, multi)', multi: true },
    { provide: DEMO_MULTI, useFactory: () => 'three (useFactory, multi)', multi: true },
  ],
})
class ProviderRecipesDemo {
  private readonly greeting = inject(GreetingService);
  readonly value = inject(DEMO_VALUE);
  readonly klass = inject(DEMO_CLASS);
  readonly factory = inject(DEMO_FACTORY);
  readonly existing = inject(DEMO_EXISTING);
  readonly multi = inject(DEMO_MULTI);

  /** True when useExisting aliases the SAME instance as the direct injection. */
  readonly sameInstance = this.existing === this.greeting;
  readonly builtAt = this.factory.builtAt;

  /** Bump counter — proves the factory does not re-run on change detection. */
  readonly bump = signal(0);
  bumpCD(): void {
    this.bump.update((n) => n + 1);
  }
}

/**
 * HierarchyOverrideDemo — CENTERPIECE #3. Demonstrates the injector hierarchy:
 * the parent component provides `DEMO_MESSAGE` at ITS injector, and a nested
 * child component re-provides the same token at the CHILD injector. Within the
 * child subtree the child's binding wins (lowest injector in the tree always
 * resolves first); outside it, the parent's binding is what shows. Toggle the
 * child override on/off to watch the child's readout flip while the parent's
 * stays put — the canonical "component-scoped provider" override.
 */
const DEMO_MESSAGE = new InjectionToken<string>('DEMO_MESSAGE');

@Component({
  selector: 'app-di-hierarchy-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="node node--child">
      <p class="node-tag">child injector (own providers)</p>
      <p class="node-val">
        DEMO_MESSAGE → <code>{{ message }}</code>
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .node {
        padding: var(--space-sm);
        border: 1px dashed var(--color-primary);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .node-tag {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-primary);
      }
      .node-val {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .node-val code {
        font-family: var(--font-mono);
      }
    `,
  ],
  // When the override is ENABLED, the child declares its own providers and the
  // child injector wins. When DISABLED, no providers here → falls through to
  // the parent injector (the parent's binding is what shows).
  providers: [
    { provide: DEMO_MESSAGE, useValue: '_OVERRIDE — child injector wins_' },
  ],
})
class HierarchyChild {
  readonly message = inject(DEMO_MESSAGE);
}

@Component({
  selector: 'app-di-hierarchy-override',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HierarchyChild],
  template: `
    <div class="demo">
      <div class="node node--parent">
        <p class="node-tag">parent injector (providers on this component)</p>
        <p class="node-val">
          DEMO_MESSAGE → <code>{{ message }}</code>
          <span class="hint">— the parent reads its own binding</span>
        </p>

        <div class="child-slot">
          @if (overrideOn()) {
            <app-di-hierarchy-child />
          } @else {
            <div class="node node--placeholder">
              <p class="node-tag">child injector — override off</p>
              <p class="node-val">
                no child providers → falls through to parent:
                <code>{{ message }}</code>
              </p>
            </div>
          }
        </div>
      </div>

      <div class="controls">
        <button type="button" class="btn" (click)="toggle()">
          {{ overrideOn() ? 'mount child WITHOUT its own providers' : 'mount child WITH its own providers' }}
        </button>
        <span class="footnote">
          The parent's readout never changes; the child's flips the moment its
          own providers array re-declares the token.
        </span>
      </div>
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
      .node {
        padding: var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .node--parent {
        border-color: var(--color-on-surface-variant);
      }
      .node--placeholder {
        border-style: dashed;
        border-color: var(--color-outline);
      }
      .node-tag {
        margin: 0 0 var(--space-xxs);
        font-size: var(--text-overline);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-on-surface-variant);
      }
      .node--child .node-tag {
        color: var(--color-primary);
      }
      .node-val {
        margin: 0;
        font-size: var(--text-body-sm);
        color: var(--color-on-surface);
      }
      .node-val code {
        font-family: var(--font-mono);
      }
      .node-val .hint {
        color: var(--color-on-surface-variant);
      }
      .child-slot {
        margin-top: var(--space-sm);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-sm);
      }
      .btn {
        padding: var(--space-xxs) var(--space-sm);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--color-on-surface-variant);
        font-size: var(--text-caption);
        cursor: pointer;
      }
      .btn:hover {
        background: var(--color-surface-variant);
      }
      .footnote {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        line-height: 1.6;
      }
    `,
  ],
  // The parent component's OWN injector — a component-scoped provider. Anything
  // injected inside this subtree resolves here first, then walks UP the tree
  // (route → root) if not found.
  providers: [{ provide: DEMO_MESSAGE, useValue: 'parent value (component-scoped)' }],
})
class HierarchyOverrideDemo {
  readonly message = inject(DEMO_MESSAGE);
  readonly overrideOn = signal(true);
  toggle(): void {
    this.overrideOn.update((v) => !v);
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER the local demos (TDZ rule).              */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-dependency-management-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    WiringInspector,
    ProviderRecipesDemo,
    HierarchyOverrideDemo,
  ],
  templateUrl: './dependency_management_view.html',
  styleUrl: './dependency_management_view.scss',
})
export class DependencyManagementView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/core/di + src/data + src/core/config  */
/* + src/environments.                                                         */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  contrast: `Angular native DI vs the React sibling's hand-rolled container:

• Registration — Angular: list a provider once in a providers array
  ({ provide: TOKEN, useClass: … } / useValue / useFactory / useExisting), or call
  a provideX() factory in app.config.ts. React: this app hand-rolls a Container
  class with register(name, instance) + a typed accessor per service.
• Resolution — Angular: inject(TOKEN) anywhere in an injection context, or a
  constructor parameter. React: container.getPostsUseCase (a module singleton).
• Hierarchy — Angular: injectors form a TREE (root → route → component), so a
  child injector can shadow a parent binding. React's locator is flat — one map.
• Lifetime — Angular: providers are singletons WITHIN their injector; a provider
  on a component's providers dies with that component. React: singletons live for
  the page, torn down manually in dispose().
• Reactivity — neither DI system re-renders. Theme/auth state use React Context
  or Angular signals; DI is for STABLE, non-reactive services.`,
  tokens: `// src/core/di/tokens.ts — the DI seam. core/ may import @angular/core; the
// domain layer must stay framework-free, so the tokens reference the domain
// contracts via TYPE-ONLY imports (no runtime coupling).
import { InjectionToken } from '@angular/core';
import type { AppConfig } from '../config/app-config';
import type { PostRepository } from '../../domain/repositories/post-repository';
import type { GetPostsUseCase } from '../../domain/usecases/get-posts-usecase';

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
export const POST_REPOSITORY = new InjectionToken<PostRepository>('POST_REPOSITORY');
export const GET_POSTS_USE_CASE = new InjectionToken<GetPostsUseCase>('GET_POSTS_USE_CASE');

// A token is just a typed, named slot — it does NOT say what implementation
// fills it. That decision lives in providers (see provideData below).`,
  providers: `// src/data/providers.ts — the Angular equivalent of container.initialize().
// Reads AppConfig.wiring (fake | live) and binds the domain contracts to the
// tokens through factories. HttpClient is intentionally NOT provided here —
// the live path consumes provideHttpClient(withInterceptors([...])) from
// app.config.ts.
export function provideData(config: AppConfig): EnvironmentProviders {
  const RemoteImpl: Type<PostRemoteDataSource> =
    config.wiring.remote === 'fake' ? FakeApiService : PostApiService;
  const DbImpl: Type<AppDatabase> =
    config.wiring.db === 'fake' ? FakeAppDatabase : AppDatabaseImpl;

  const providers: Provider[] = [
    { provide: APP_CONFIG, useValue: config },                 // useValue
    { provide: Logger,
      useFactory: () => new Logger(config.name, !config.production) }, // useFactory
    RemoteImpl,                                                 // shorthand: useClass
    DbImpl,
    { provide: POST_REPOSITORY,
      useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger] },                     // useFactory + deps
    { provide: GET_POSTS_USE_CASE,
      useFactory: (repo) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY] },
  ];
  return makeEnvironmentProviders(providers);
}`,
  recipes: `// The four provider recipes + multi-providers. Each maps a TOKEN to a value.
{ provide: APP_CONFIG, useValue: config },                      // a plain value
{ provide: PostApiService, useClass: PostApiService },          // (shorthand: just the class)
{ provide: POST_REPOSITORY,                                     // build it lazily
  useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
  deps: [PostApiService, AppDatabaseImpl, Logger] },
{ provide: SAME_THING, useExisting: PostApiService },           // alias another token

// multi: true — every registration is APPENDED to the resolved array (instead
// of overriding). Used for plug-in lists: interceptors, validators, handlers.
{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
{ provide: HTTP_INTERCEPTORS, useClass: RetryInterceptor, multi: true },
// inject(HTTP_INTERCEPTORS) → [AuthInterceptor, RetryInterceptor, …]`,
  injectVsCtor: `// Modern: the inject() function — preferred for standalone components.
@Component({ /* … */ })
class PostsDemo {
  private readonly useCase = inject(GET_POSTS_USE_CASE);   // the SEAM
  private readonly config  = inject(APP_CONFIG);
}

// Classic: constructor injection. Either works; inject() reads better with
// signals (readonly field initialisers) and is required when resolving inside
// a functional HttpInterceptorFn / resolver / guard that has no constructor.
class PostsDemo {
  constructor(
    private readonly useCase: GetPostsUseCase,   // Angular reads the TS type
    private readonly config: AppConfig,
  ) {}
}

// inject() also resolves inside factories, guards, resolvers, interceptors —
// anywhere in an injection context — which a constructor parameter can't.`,
  hierarchy: `The injector tree (resolves bottom-up — lowest injector wins):

  root injector  ← provideX(...) and providers in app.config.ts live here
       │            (singletons for the whole app: APP_CONFIG, HttpClient,
       │             POST_REPOSITORY, GET_POSTS_USE_CASE, Router, …)
       ▼
  route injector ← providers on a route's 'providers' field (lazy-loaded routes
       │            can have their own bindings — e.g. an admin feature wiring
       │            a different auth backend). Children of that route see them.
       ▼
  component injector ← 'providers' on a @Component. Visible only inside that
       │                component's subtree. This is the COMPONENT-SCOPED
       │                override — a child can re-declare a token and win.
       ▼
  child component injector ← nested @Component providers, and so on.

When a token is requested, Angular walks UP from the requesting component until
it finds a provider. The first match wins — so a component-level provider SHADOWS
a root-level one for that subtree only.

// Route-level providers (a lazy feature can wire its own backend):
{
  path: 'admin',
  loadComponent: () => import('./admin').then(m => m.Admin),
  providers: [{ provide: POST_REPOSITORY, useClass: AdminPostRepository }],
}`,
  envSwap: `// src/environments/environment.development.ts — dev defaults to fakes.
export const environment = {
  production: false,
  name: 'dev' as const,
  wiring: { remote: 'fake' as 'fake' | 'live',
            db:     'fake' as 'fake' | 'live' },
  apiBaseUrl: 'https://jsonplaceholder.typicode.com',
  scenario: { /* … */ },
} as const;

// src/environments/environment.staging.ts — staging hits the live backend.
wiring: { remote: 'live' as 'fake' | 'live',
          db:     'live' as 'fake' | 'live' },

// src/environments/environment.ts — production default (also fakes today).
wiring: { remote: 'fake', db: 'fake' },

// angular.json swaps the file wholesale at build time (fileReplacements):
//   ng build                       → environment.ts (prod defaults)
//   ng build --configuration staging → environment.staging.ts
//   ng serve                       → environment.development.ts
// createAppConfig(environment) → typed AppConfig → provideData(config) reads
// config.wiring and binds FakeApiService/FakeAppDatabase vs the live classes.
// ONE field, ONE rebuild, the entire graph re-wires — no view changes.`,
  getWiring: `// src/data/providers.ts — runtime introspection WITHOUT instanceof.
// Preserves the invariant that ui/ never couples to data/ internals: the UI
// can say "the remote slot is fake" by reading a value, not by importing the
// concrete classes it would otherwise need for an instanceof check.
export function getWiring(config: AppConfig): {
  remote: 'fake' | 'live';
  db: 'fake' | 'live';
} {
  return { remote: config.wiring.remote, db: config.wiring.db };
}

// Used by this screen's WiringInspector demo:
//   readonly wiring = getWiring(inject(APP_CONFIG));
//   // wiring.remote === 'fake' in dev, 'live' in staging → no data-layer import.`,
  bootstrap: `// src/main.ts — bootstrap wires the whole graph before the first render.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// src/app/app.config.ts — the root providers list. Order doesn't matter; Angular
// builds the graph lazily on first inject().
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([retryInterceptor])),  // live path only
    provideData(createAppConfig(environment)),                 // the DI seam
    // …store/effects providers
  ],
};

// createAppConfig(environment) reads the active environment file (selected by
// angular.json fileReplacements) and freezes it into a typed AppConfig. By the
// time any component mounts, every token is resolvable.`,
  consume: `// A view resolves what it needs via inject() — never a concrete repo impl.
@Component({ /* … */ })
class PostsDemo {
  private readonly useCase = inject(GET_POSTS_USE_CASE);
  readonly state = signal<DemoState>({ status: 'idle', posts: [] });

  async fetch(): Promise<void> {
    const result: Result<Post[]> = await this.useCase.execute();
    if (result.ok) this.state.set({ status: 'success', posts: result.value });
    else           this.state.set({ status: 'error', posts: [], failure: result.failure });
  }
}

// The same component runs unchanged against FakeApiService (dev) or
// PostApiService (staging) — the token abstracts which one. That is the
// dependency rule made real by DI.`,
};

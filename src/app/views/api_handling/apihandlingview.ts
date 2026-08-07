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
import { ShowError } from '../../../ui/components/show-error/show-error';
import { APP_CONFIG, GET_POSTS_USE_CASE } from '../../../core/di/tokens';
import { ScenarioService } from '../../../core/scenario/scenario.service';
import { FailureScenario } from '../../../core/scenario/failure-scenario';
import type { Post } from '../../../domain/models/post';
import type { Result } from '../../../core/result';
import type { Failure } from '../../../core/error-handling/failure';

/**
 * ApiHandlingView — how data reaches the UI the Angular way IN THIS APP.
 *
 * This screen is documentation-by-example of the app's OWN clean-architecture
 * pipeline. Fetching "posts" looks like one call in the component, but it
 * travels a deliberate chain: view → use case → repository → remote data source
 * → HttpClient → REST API, and the answer comes back as DTOs → domain models →
 * a Result<T>. Every layer has one job and a narrow interface, so any layer can
 * be swapped (fake ↔ live API, remote ↔ cache) without the layers above or below
 * noticing. The view never imports a DTO, a DAO, or HttpClient — it resolves the
 * use case through the DI seam (inject(GET_POSTS_USE_CASE)) and switches on the
 * Result. That seam is the whole point of the screen.
 *
 * The whole pipeline already exists in src/domain + src/data + src/core — this
 * screen walks through it layer by layer (reading the REAL source) and then
 * drives it live via the wired use case (fake repository in dev, so it works
 * offline).
 *
 * NOTE: the exported `ApiHandlingView` is declared at the BOTTOM of this file.
 * Its `imports` reference a local helper component (PostsDemo) that is a
 * block-scoped declaration — the main component must come AFTER every helper it
 * names so its decorator does not read an uninitialized binding at module-
 * evaluation time (the TDZ rule the other view screens follow).
 */

/* -------------------------------------------------------------------------- */
/* Local live demo — drives the REAL use-case seam. Declared BEFORE the        */
/* exported view so the view's decorator does not hit a TDZ binding.           */
/* -------------------------------------------------------------------------- */

/**
 * The four API outcomes the demo can simulate. The FakeApiService (dev wiring)
 * reads ScenarioService signals with priority timeout > network > server, so
 * the demo writes exactly one of these at a time to steer the next fetch.
 */
const SCENARIO_OPTIONS: readonly {
  readonly value: FailureScenario;
  readonly label: string;
}[] = [
  { value: FailureScenario.None, label: 'success' },
  { value: FailureScenario.NetworkFailure, label: 'network error' },
  { value: FailureScenario.Timeout, label: 'timeout' },
  { value: FailureScenario.ServerFailure, label: 'server error (500)' },
];

type DemoStatus = 'idle' | 'loading' | 'success' | 'error';

interface DemoState {
  readonly status: DemoStatus;
  readonly posts: readonly Post[];
  /** Non-blocking warning carried by Result.Success (e.g. stale cache). */
  readonly warning?: Failure;
  /** Blocking failure carried by Result.Failed. */
  readonly failure?: Failure;
}

/**
 * PostsDemo — the CENTERPIECE. Calls the REAL GetPostsUseCase resolved through
 * the DI token, NOT HttpClient. The view holds no transport concerns; it
 * switches on the returned Result<Post[]> and renders loading / success / error
 * (with the offline-first warning path) using the design-system primitives.
 *
 * The scenario chips write to ScenarioService, which the wired FakeApiService
 * (dev) reads on the next fetch — so flipping "server error" then refetching
 * drives the real Result.Failed path through the real error pipeline.
 */
@Component({
  selector: 'app-api-posts-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShowError],
  template: `
    <div class="demo">
      <div class="controls">
        <span class="wiring">
          wiring:
          <code>{{ wiringLabel() }}</code>
        </span>

        <fieldset class="scenarios">
          <legend>API scenario (written to ScenarioService)</legend>
          @for (opt of scenarioOptions; track opt.value) {
            <label class="chip" [class.is-active]="selected() === opt.value">
              <input
                type="radio"
                name="api-scenario"
                [value]="opt.value"
                [checked]="selected() === opt.value"
                (change)="selectScenario(opt.value)"
              />
              <span>{{ opt.label }}</span>
            </label>
          }
        </fieldset>

        <button type="button" class="btn primary" (click)="fetch()">
          ↻ fetch posts
        </button>
        <button type="button" class="btn" (click)="resetScenario()">
          reset scenario
        </button>
      </div>

      @switch (state().status) {
        @case ('loading') {
          <p class="status loading" data-testid="posts-loading">
            <span class="spinner" aria-hidden="true"></span>
            Loading posts through the pipeline…
          </p>
        }
        @case ('error') {
          <div class="err-frame" data-testid="posts-error">
            <ui-show-error
              [message]="state().failure?.message ?? 'Unknown error'"
              [severity]="state().failure?.severity ?? 'critical'"
              [kind]="state().failure?.kind ?? 'unknown'"
              (retry)="fetch()"
            />
          </div>
        }
        @case ('success') {
          @if (state().warning) {
            <p class="status warning" data-testid="posts-warning">
              ⚠ {{ state().warning?.message }} — served from cache (non-blocking
              Result.Success warning).
            </p>
          }
          @if (state().posts.length === 0) {
            <p class="status empty">No posts returned.</p>
          } @else {
            <ul class="posts" data-testid="posts-list">
              @for (p of state().posts; track p.id) {
                <li class="post">
                  <p class="title">{{ p.title }}</p>
                  <p class="body">{{ p.body }}</p>
                </li>
              }
            </ul>
          }
          <p class="summary">
            {{ state().posts.length }} post(s) from the use case ·
            Result&lt;Post[]&gt; → <strong>Success</strong>
          </p>
        }
        @default {
          <p class="status idle">
            Press <em>fetch posts</em> — the view calls
            <code>inject(GET_POSTS_USE_CASE).execute()</code> and renders the
            returned <code>Result&lt;Post[]&gt;</code>.
          </p>
        }
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
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .wiring {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .wiring code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
      }
      .scenarios {
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        padding: var(--space-xxs) var(--space-xs);
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-xxs);
      }
      .scenarios legend {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        padding: 0 var(--space-xxs);
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-xxs);
        padding: var(--space-xxs) var(--space-xs);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-pill);
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
        cursor: pointer;
      }
      .chip input {
        accent-color: var(--color-primary);
      }
      .chip.is-active {
        border-color: var(--color-primary);
        color: var(--color-on-surface);
        background: var(--color-surface-variant);
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
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .status {
        margin: 0;
        padding: var(--space-sm) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
        font-size: var(--text-body-sm);
        color: var(--color-on-surface-variant);
        display: flex;
        align-items: center;
        gap: var(--space-xs);
      }
      .status.warning {
        border-color: var(--color-primary);
        color: var(--color-on-surface);
      }
      .status.idle code {
        font-family: var(--font-mono);
      }
      .err-frame {
        max-height: 320px;
        overflow: auto;
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
      }
      .posts {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }
      .post {
        padding: var(--space-xs) var(--space-md);
        border: 1px solid var(--color-outline);
        border-radius: var(--radius-md);
        background: var(--color-surface);
      }
      .post .title {
        margin: 0;
        font-size: var(--text-body-sm);
        font-weight: 600;
        color: var(--color-on-surface);
      }
      .post .body {
        margin: var(--space-xxs) 0 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .summary {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .summary strong {
        color: var(--color-on-surface);
      }
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-outline);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        display: inline-block;
        animation: api-spin 0.8s linear infinite;
      }
      @keyframes api-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
class PostsDemo {
  /** The DI-token seam — the ONLY data dependency the view declares. */
  private readonly useCase = inject(GET_POSTS_USE_CASE);
  private readonly scenario = inject(ScenarioService);
  private readonly config = inject(APP_CONFIG);

  readonly state = signal<DemoState>({ status: 'idle', posts: [] });
  readonly scenarioOptions = SCENARIO_OPTIONS;

  /** Reflects the live ScenarioService priority (timeout > network > server). */
  readonly selected = computed<FailureScenario>(() => this.scenario.apiScenario());

  readonly wiringLabel = computed(
    () => `${this.config.wiring.remote} remote · ${this.config.wiring.db} db`,
  );

  /** Drive the real pipeline: use case → repository → remote/cache → Result. */
  async fetch(): Promise<void> {
    this.state.set({ status: 'loading', posts: [] });
    const result: Result<Post[]> = await this.useCase.execute();
    if (result.ok) {
      this.state.set({
        status: 'success',
        posts: result.value,
        warning: result.warning,
      });
    } else {
      this.state.set({ status: 'error', posts: [], failure: result.failure });
    }
  }

  /** Write exactly one scenario into the ScenarioService signals. */
  selectScenario(s: FailureScenario): void {
    this.scenario.injectNetworkFailure.set(s === FailureScenario.NetworkFailure);
    this.scenario.injectTimeout.set(s === FailureScenario.Timeout);
    this.scenario.injectServerFailure.set(s === FailureScenario.ServerFailure);
  }

  resetScenario(): void {
    this.scenario.reset();
  }
}

/* -------------------------------------------------------------------------- */
/* The exported view — declared AFTER PostsDemo (TDZ rule).                    */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-api-handling-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    PostsDemo,
  ],
  templateUrl: './api_handling_view.html',
  styleUrl: './api_handling_view.scss',
})
export class ApiHandlingView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/domain + src/data + src/core.       */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  pipeline: `UI  (view + inject(GET_POSTS_USE_CASE))
        │  execute()
        ▼
GetPostsUseCase              ← domain: orchestration seam (policy goes here)
        │  getPosts()
        ▼
PostRepository (interface)   ← domain: the CONTRACT the UI depends on
        │  implemented by
        ▼
PostRepositoryImpl           ← data: remote-first + cache fallback (offline-first)
   ├──► PostRemoteDataSource ─► HttpClient ─► REST API /posts
   │        returns PostDTO[]        (retry.interceptor: idempotent + jittered)
   │        engine error → AppException via guardedApiCall / httpErrorToException
   └──► AppDatabase (write-through cache)  ◄── posts saved on every success

        │  maps DTO → Post, wraps in Result<Post[]>
        ▼
Result<Post[]> travels back up UNCHANGED — the UI switches on result.ok`,
  domain: `// src/domain/models/post.ts — pure domain model. No framework, no I/O.
export interface Post {
  id: number;
  title: string;
  body: string;
}

// src/domain/repositories/post-repository.ts — the seam data implements.
import type { Post } from '../models/post';
import type { Result } from '../../core/result';

export interface PostRepository {
  getPosts(): Promise<Result<Post[]>>;   // failures are VALUES, not throws
}

// src/domain/usecases/get-posts-usecase.ts — thin orchestration. The boundary
// where cross-cutting policy (logging, combining sources, business rules) lives.
export class GetPostsUseCase {
  constructor(private readonly repository: PostRepository) {}

  execute(): Promise<Result<Post[]>> {
    return this.repository.getPosts();
  }
}`,
  tokens: `// src/core/di/tokens.ts — the DI seam. domain/ stays framework-free; these
// tokens reference the domain contracts via TYPE-ONLY imports (no runtime
// coupling), so Angular can inject them.
import { InjectionToken } from '@angular/core';

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');
export const POST_REPOSITORY = new InjectionToken<PostRepository>('POST_REPOSITORY');
export const GET_POSTS_USE_CASE = new InjectionToken<GetPostsUseCase>('GET_POSTS_USE_CASE');

// A view resolves data through the USE-CASE token — never HttpClient, never a
// DTO, never a repository IMPLEMENTATION:
//   private readonly getPosts = inject(GET_POSTS_USE_CASE);`,
  dto: `// src/data/remote/post-dto.ts — the wire/transport shape. Responsible for
// (de)serialization and mapping to/from the domain Post. DTOs NEVER leave data/.
export interface PostDTO {
  id: number;
  title: string;
  body: string;
}

// Deserialize + VALIDATE (don't coerce): a malformed payload throws, so bad
// server data surfaces as a typed exception instead of NaN ids reaching the UI.
export function postDtoFromJson(json: Record<string, unknown>): PostDTO {
  const { id, title, body } = json;
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new Error('Invalid post: id must be an integer');
  }
  if (typeof title !== 'string') throw new Error('Invalid post: title must be a string');
  if (typeof body !== 'string')  throw new Error('Invalid post: body must be a string');
  return { id, title, body };
}

// DTO → domain model (the mapping happens ONCE, here in the data layer).
export function dtoToPost(dto: PostDTO): Post {
  return { id: dto.id, title: dto.title, body: dto.body };
}`,
  remote: `// src/data/remote/post-api.service.ts — live Angular implementation wrapping
// HttpClient. DTOs never cross into domain/ or ui/. Raw HttpClient errors are
// upgraded to typed AppExceptions by guardedApiCall.
import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { guardedApiCall } from '../../core/error-handling/guards';
import { APP_CONFIG } from '../../core/di/tokens';

export interface PostRemoteDataSource {
  getPosts(): Promise<PostDTO[]>;
}

@Injectable()
export class PostApiService implements PostRemoteDataSource {
  private readonly http = inject(HttpClient);
  private readonly config = inject(APP_CONFIG);

  getPosts(): Promise<PostDTO[]> {
    return guardedApiCall(async () => {        // → AppException on HttpErrorResponse
      const data = await firstValueFrom(
        this.http.get<unknown>(\`\${this.config.apiBaseUrl}/posts\`),
      );
      if (!Array.isArray(data)) throw new ServerException('Expected a list of posts');
      return (data as Record<string, unknown>[]).map(postDtoFromJson);
    });
  }
}`,
  interceptor: `// src/data/remote/retry.interceptor.ts — functional HttpInterceptorFn.
// Idempotent-only, exponential full-jitter, never retries errors that are
// already typed AppExceptions (they are intentional, not transient).
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  let attempt = 0;
  const attemptRequest = (currentReq) =>
    next(currentReq).pipe(
      catchError((error: unknown) => {
        if (error instanceof AppException) return throwError(() => error);
        if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
        const exception = httpErrorToException(error);   // status → typed exception
        const retryable =
          IDEMPOTENT_METHODS.has(currentReq.method.toLowerCase()) &&
          isTransient(exception);                         // network/timeout only
        if (retryable && attempt < MAX_RETRIES) {
          attempt += 1;
          return timer(jitteredDelay(attempt))            // random(0, base * 2^(n-1))
            .pipe(concatMap(() => attemptRequest(currentReq)));
        }
        return throwError(() => exception);               // typed → data layer
      }),
    );
  return attemptRequest(req);
};`,
  guards: `// src/core/error-handling/guards.ts — single source of truth for the
// HttpErrorResponse → AppException mapping (used by guardedApiCall AND the
// retry interceptor, so the data layer only ever handles typed exceptions).
export function httpErrorToException(e: HttpErrorResponse): AppException {
  const status = e.status;
  if (status === 0)            return new NetworkException(e.message, { cause: e });
  if (status === 408)          return new TimeoutException('Request timed out', { cause: e });
  if (status === 401 || status === 403)
                               return new AuthException(\`Authentication failed (\${status})\`, { cause: e });
  if (status >= 500 && status <= 599)
                               return new ServerException(serverMessage(e) ?? \`Server returned \${status}\`, { cause: e });
  return new ServerException(serverMessage(e) ?? \`Server returned \${status}\`, { cause: e });
}

// Two-stage pipeline: AppException (technical) → Failure (semantic, severity-driven).
export function mapExceptionToFailure(e: AppException): Failure {
  const innerCause =
    e.cause instanceof AppException ? mapExceptionToFailure(e.cause) : undefined;
  if (e instanceof TimeoutException || e instanceof NetworkException)
    return new NetworkFailure(e.message, innerCause);
  if (e instanceof ServerException) return new ServerFailure(e.message, innerCause);
  if (e instanceof AuthException)   return new AuthFailure(e.message, innerCause);
  if (e instanceof AppDatabaseException) return new DatabaseFailure(e.message, innerCause);
  return new UnknownFailure(e.message, innerCause);
}`,
  repository: `// src/data/repositories/post-repository-impl.ts — orchestrates remote + local.
// Offline-first: on network/server failure it falls back to the local cache.
async getPosts() {
  return safeRepositoryCall<Post[]>({
    call: async () => {
      const remotePosts = await this.remote.getPosts();
      try { await this.local.insertPosts(remotePosts); }   // write-through cache
      catch (e) { this.logger.warning('Failed to cache posts', e); } // best-effort
      return remotePosts.map(dtoToPost);                   // DTO → domain HERE
    },
    onNetworkError: (cause) => this.serveFromCache(cause), // → cache fallback
    onServerError:   (cause) => this.serveFromCache(cause),
  });
}

// serveFromCache: cache hit  → Success(posts, warning = networkFailure)  [non-blocking]
//                 cache miss → Failed(networkFailure)                     [blocking]
//                 cache read fails → Failed(CacheFailure ← networkFailure) [chained]`,
  result: `// src/core/result.ts — the domain return type for fallible work. Expected
// failures are VALUES, not throws, so every call site acknowledges them at the
// type level (no forgotten try/catch).
export type Result<T> = Success<T> | Failed;

export interface Success<T> {
  ok: true;
  value: T;
  warning?: Failure;   // non-blocking, e.g. "showed stale cache"
}
export interface Failed {
  ok: false;
  failure: Failure;    // blocking
}

// Caller narrows cleanly on result.ok with full type narrowing:
const result = await getPostsUseCase.execute();   // Promise<Result<Post[]>>
if (result.ok) {
  render(result.value);                  // Post[]
  if (result.warning) warn(result.warning);
} else {
  showError(result.failure);             // Failure, narrowed
}`,
  providers: `// src/data/providers.ts — Angular equivalent of a service locator. Wires
// fake-vs-live sources based on AppConfig.wiring, then binds the domain
// contracts to the InjectionTokens. HttpClient is NOT provided here — the live
// path consumes provideHttpClient(withInterceptors([retryInterceptor])) from
// app.config.ts.
export function provideData(config: AppConfig): EnvironmentProviders {
  const RemoteImpl = config.wiring.remote === 'fake' ? FakeApiService : PostApiService;
  const DbImpl     = config.wiring.db     === 'fake' ? FakeAppDatabase : AppDatabaseImpl;
  return makeEnvironmentProviders([
    { provide: APP_CONFIG, useValue: config },
    RemoteImpl, DbImpl,
    { provide: POST_REPOSITORY,
      useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger] },
    { provide: GET_POSTS_USE_CASE,
      useFactory: (repo) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY] },
  ]);
}`,
  fake: `// src/data/fake/fake-api-service.ts — dev-only stand-in for the live remote.
// Returns canned PostDTO[] after a delay; throws typed AppExceptions based on
// ScenarioService toggles, so the Exception path is exercisable offline.
@Injectable()
export class FakeApiService implements PostRemoteDataSource {
  private readonly scenario = inject(ScenarioService);
  private readonly posts: PostDTO[] = [ /* canned posts */ ];

  getPosts(): Promise<PostDTO[]> {
    return this.simulate(() => [...this.posts]);
  }
  private async simulate<T>(onSuccess: () => T): Promise<T> {
    await delay(600);
    if (this.scenario.shouldInjectTimeout())       throw new TimeoutException('…');
    if (this.scenario.shouldInjectNetworkFailure()) throw new NetworkException('…');
    if (this.scenario.shouldInjectServerFailure())  throw new ServerException('…');
    return onSuccess();
  }
}`,
  consume: `// THIS SCREEN's demo (src/app/views/api_handling/apihandlingview.ts) —
// the view resolves the use case via the DI token and switches on Result.
// No HttpClient, no DTO, no repository impl import in the view.
type DemoStatus = 'idle' | 'loading' | 'success' | 'error';

private readonly useCase = inject(GET_POSTS_USE_CASE);   // the SEAM
readonly state = signal<DemoState>({ status: 'idle', posts: [] });

async fetch(): Promise<void> {
  this.state.set({ status: 'loading', posts: [] });
  const result: Result<Post[]> = await this.useCase.execute();
  if (result.ok) {
    this.state.set({ status: 'success', posts: result.value, warning: result.warning });
  } else {
    this.state.set({ status: 'error', posts: [], failure: result.failure });
  }
}

// template: @switch (state().status) { … loading / <ui-show-error/> / post list … }`,
  angularVsReact: `Angular vs React sibling — same layering, different plumbing:

• DI — Angular has FIRST-CLASS DI (InjectionToken + providers + inject()).
  The React guide hand-rolls a service locator (container.ts). Here provideData()
  in src/data/providers.ts wires fake-vs-live and binds the domain contracts to
  POST_REPOSITORY / GET_POSTS_USE_CASE; the view just injects the token.
• HTTP client — Angular HttpClient (Observables) vs axios (Promises). Same
  interceptor concept; this app's retry.interceptor.ts is a functional
  HttpInterceptorFn (idempotent + jittered).
• DTOs — TypeScript types are erased at runtime, so a DTO is a plain interface
  + pure conversion fns (postDtoFromJson / dtoToPost). No runtime class, unlike
  Dart's fromJson factory.
• Errors — identical two-stage pipeline: AppException (data) → Failure (domain)
  → Result<T>. Severity drives presentation (critical → <ui-show-error/>;
  warning → non-blocking). See the Exception-handling screen.
• State machine — this view uses a small discriminated-union signal (DemoStatus)
  driven straight off Result. The React sibling uses a useReducer hook. The
  NgRx/RxJS siblings cover the heavier state-management cases.`,
};

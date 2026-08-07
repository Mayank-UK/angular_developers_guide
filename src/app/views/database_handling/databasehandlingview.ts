import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SectionWrapper } from '../../../ui/components/section-wrapper/section-wrapper';
import { ContentGroupWrapper } from '../../../ui/components/content-group-wrapper/content-group-wrapper';
import { TextBlock } from '../../../ui/components/text-block/text-block';
import { CodeBlock } from '../../../ui/components/code-block/code-block';
import { Example } from '../../../ui/components/example/example';
import { CacheDemo } from './cache-demo';

/**
 * DatabaseHandlingView — local persistence the Angular way IN THIS APP.
 *
 * Documentation-by-example of the app's OWN local-persistence layer (the
 * IndexedDB/Dexie DAO layer in src/data/local + the offline-first repository
 * in src/data/repositories). The whole point: a component never talks to
 * IndexedDB directly. Between "the UI wants posts" and "rows in a browser
 * database" there is a deliberate chain — repository → AppDatabase → PostDAO →
 * Dexie → IndexedDB — and the DAO never leaks past the repository. The view
 * depends on the `POST_REPOSITORY` contract, not on Dexie, not on a DAO, not on
 * IndexedDB. That seam is what makes the layer swappable (real Dexie ↔ in-memory
 * fake) and testable without a browser.
 *
 * The CENTERPIECE is a live demo that reads/writes through the REAL DAO layer,
 * routed via the repository DI token (see cache-demo.ts + demo-cache-wiring.ts).
 *
 * NOTE: the exported `DatabaseHandlingView` is declared at the BOTTOM of this
 * file. Its `imports` reference `CacheDemo`, which is a block-scoped import (not
 * a TDZ risk like a local class declaration), but the page's `SNIPPETS` const is
 * declared after the class is referenced by `snippets = SNIPPETS` — so the const
 * must be hoisted (a `const` is not hoisted). To keep that working, `snippets`
 * is assigned `SNIPPETS` (a module-level const declared below) — Angular reads
 * the field at runtime (well after module evaluation completes), so the TDZ
 * window has closed by then. This mirrors the lifecycle/api-handling siblings.
 */
@Component({
  selector: 'app-database-handling-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SectionWrapper,
    ContentGroupWrapper,
    TextBlock,
    CodeBlock,
    Example,
    CacheDemo,
  ],
  templateUrl: './database_handling_view.html',
  styleUrl: './database_handling_view.scss',
})
export class DatabaseHandlingView {
  /** Code listings rendered by the page's CodeBlocks (REAL source excerpts). */
  readonly snippets = SNIPPETS;
}

/* -------------------------------------------------------------------------- */
/* Code listings shown in the page's <ui-code-block> elements.                */
/* All excerpts are the REAL source in src/data/local + src/data/repositories  */
/* + src/core. They are trimmed for readability but accurate to the files.     */
/* -------------------------------------------------------------------------- */

const SNIPPETS = {
  whyLocal: `// Why a real database, not localStorage:
//
//  localStorage                 IndexedDB (via Dexie)
//  ─────────────                ──────────────────────
//  synchronous (blocks UI)      asynchronous (non-blocking)
//  ~5 MB origin cap             hundreds of MB+, often gigabytes
//  strings only                 structured objects, Blobs, files
//  no queries                   indexed by key, range/table queries
//  no transactions              transactional, multi-store
//  single tab                   shared across tabs (same origin)
//
// Posts are structured objects fetched over the network; IndexedDB is the
// right primitive. Dexie tames its awkward callback API into promises + a
// declarative schema, so this app gets the capacity without the boilerplate.`,
  contract: `// src/data/local/app-database.ts — the contract, NOT the engine.
// Just like PostRepository hides the network behind an interface, AppDatabase
// hides the storage engine. The repository holds an AppDatabase, never a Dexie
// instance, never an IndexedDB request. Swappable per environment.
export abstract class AppDatabase {
  abstract insertPosts(posts: PostDTO[]): Promise<void>;
  abstract getPosts(): Promise<PostDTO[]>;
  abstract clearPosts(): Promise<void>;
}

// The repository depends on the ABSTRACT, wired in src/data/providers.ts:
//   { provide: ..., useFactory: (remote, db, logger) =>
//       new PostRepositoryImpl(remote, db, logger), deps: [..., DbImpl, ...] }
// A view injects POST_REPOSITORY — it never imports AppDatabaseImpl.`,
  connection: `// src/data/local/app-database.ts — AppDatabaseImpl is the ONLY file that
// imports Dexie. It owns the schema + the DAO; per-table queries live in the DAO.
import Dexie, { type Table } from 'dexie';

export class AppDatabaseImpl extends Dexie implements AppDatabase {
  private readonly postDAO?: PostDAO;
  private readonly dexieAvailable: boolean;
  private memory: PostDTO[] = [];   // in-memory fallback when IndexedDB absent

  constructor() {
    super('app_database');
    // IndexedDB is absent in some test/SSR contexts — detect at construction
    // and degrade to the in-memory store instead of throwing, so DI never
    // blows up when the engine is missing.
    this.dexieAvailable = typeof indexedDB !== 'undefined';
    if (this.dexieAvailable) {
      try {
        this.version(1).stores({ posts: 'id, title' }); // pk + secondary index
        const posts = this.table<PostDTO, number>('posts');
        this.postDAO = new PostDAO(posts);              // hand table to the DAO
      } catch {
        this.dexieAvailable = false;                    // schema failed → fallback
      }
    }
  }

  async insertPosts(posts: PostDTO[]): Promise<void> {
    if (this.dexieAvailable && this.postDAO) return this.postDAO.insertAll(posts);
    this.memory = [...posts];                            // fallback path
  }
  // getPosts() / clearPosts() branch the same way.`,
  dao: `// src/data/local/post-dao.ts — one table, direct data-access operations.
// Owns a single Dexie table; upgrades ANY engine error to a typed
// AppDatabaseException (cause-chained) so a flaky IndexedDB never leaks a raw
// Dexie error upward. Works with DTOs (the on-disk shape), never domain models —
// the DTO→domain mapping is the repository's job one layer up.
export class PostDAO {
  constructor(private readonly posts: Table<PostDTO, number>) {}

  async insertAll(posts: PostDTO[]): Promise<void> {
    try {
      await this.posts.bulkPut(posts);          // upsert by primary key 'id'
    } catch (e) {
      throw new AppDatabaseException(
        \`Failed to cache posts: \${stringify(e)}\`, { cause: e });
    }
  }

  async getAll(): Promise<PostDTO[]> {
    try {
      const rows = await this.posts.toArray();
      // validate on read too — cache corruption surfaces as a typed exception
      return rows.map((r) => postDtoFromJson(r as unknown as Record<string, unknown>));
    } catch (e) {
      throw new AppDatabaseException(
        \`Failed to read posts: \${stringify(e)}\`, { cause: e });
    }
  }
  // clear() wraps this.posts.clear() the same way.`,
  seam: `// DAOs NEVER leak to the view. The dependency rule (ARCHITECTURE.md):
//
//   ui / app  ──inject(POST_REPOSITORY)──►  core/di/tokens
//        │  type-only imports                   │  InjectionToken
//        ▼                                      ▼
//   domain (Post, PostRepository)          data (PostRepositoryImpl)
//                                             ├──► PostRemoteDataSource
//                                             └──► AppDatabase ──► PostDAO ──► Dexie
//
// The view resolves the use-case/repository token; it never imports
// AppDatabaseImpl, PostDAO, or Dexie. data/providers.ts is the ONLY place that
// knows which concrete database implementation is wired.`,
  repository: `// src/data/repositories/post-repository-impl.ts — orchestrates remote + local.
// Offline-first: on network/server failure it falls back to the local cache.
async getPosts() {
  return safeRepositoryCall<Post[]>({
    call: async () => {
      const remotePosts = await this.remote.getPosts();   // PostDTO[]
      try {
        await this.local.insertPosts(remotePosts);        // write-through cache
      } catch (e) {
        this.logger.warning('Failed to cache posts', e);  // best-effort, non-fatal
      }
      return remotePosts.map(dtoToPost);                  // DTO → domain HERE
    },
    onNetworkError: (cause) => this.serveFromCache(cause),// → cache fallback
    onServerError:   (cause) => this.serveFromCache(cause),
  });
}

// serveFromCache — the offline-first matrix in one method:
private async serveFromCache(cause: AppException) {
  const upstreamFailure = mapExceptionToFailure(cause);
  try {
    const cached = await this.local.getPosts();           // DAO read
    if (cached.length > 0) {
      // cache HIT → Success with a non-blocking warning (stale-but-usable)
      return success(cached.map(dtoToPost), upstreamFailure);
    }
    // cache MISS → surface the original upstream failure (blocking)
    return forwardNetworkFailure(cause);
  } catch (e) {
    // cache READ FAILED → chain a Critical CacheFailure on top of the upstream
    const chained = new CacheFailure(dbError.message, upstreamFailure,
      FailureSeverity.Critical);
    this.logger.error(\`Cache fallback also failed:\\n\${chained.chain}\`);
    return failed(chained);
  }
}`,
  errors: `// src/core/error-handling — database errors follow the SAME pipeline as remote.
//
// 1. DAO throws a typed AppDatabaseException (cause-chained on the raw error):
throw new AppDatabaseException('Failed to read posts', { cause: e });

// 2. guards.mapExceptionToFailure turns it into a user-facing Failure:
if (e instanceof AppDatabaseException) {
  return new DatabaseFailure(e.message, innerCause);  // severity: Critical
}

// 3. During cache fallback, a CacheFailure is CHAINED on top of the upstream
//    network failure — Failure.chain reconstructs the whole story for logs:
const chained = new CacheFailure(dbError.message, networkFailure,
  FailureSeverity.Critical);
// chain: "No cached data available
//           → caused by: Simulated offline (simulated)"
//
// 4. The Failure travels up inside a Result. The UI switches on result.ok and
//    Failure.severity — it NEVER sees a raw Dexie error or an IndexedDB event.`,
  fallback: `// src/data/local/app-database.ts — IndexedDB is absent in jsdom/SSR. The app
// detects that at construction and degrades to an in-memory store, so DI never
// blows up when the engine is missing. SAME code path either way — the
// repository and the DAO don't know which branch ran.
constructor() {
  super('app_database');
  this.dexieAvailable = typeof indexedDB !== 'undefined';
  if (this.dexieAvailable) {
    this.version(1).stores({ posts: 'id, title' });
    this.postDAO = new PostDAO(this.table('posts'));
  }   // else: this.memory (a PostDTO[]) is used by every method
}

async getPosts(): Promise<PostDTO[]> {
  if (this.dexieAvailable && this.postDAO) return this.postDAO.getAll();
  return [...this.memory];   // tests/SSR path — no Dexie, no IndexedDB
}

// The dev wiring goes further: environment.development.ts sets wiring.db:'fake'
// so provideData registers FakeAppDatabase (in-memory, reads ScenarioService)
// for the whole app. The tokens/repository/error-pipeline are all REAL — only
// the leaf database implementation is swapped.`,
  providers: `// src/data/providers.ts — the Angular equivalent of a service locator. Reads
// AppConfig.wiring and picks the real Dexie connection vs the in-memory fake,
// then binds the domain contracts to the InjectionTokens. The view injects
// POST_REPOSITORY — it never knows (or cares) which DB implementation is wired.
export function provideData(config: AppConfig): EnvironmentProviders {
  const DbImpl: Type<AppDatabase> =
    config.wiring.db === 'fake' ? FakeAppDatabase : AppDatabaseImpl;

  return makeEnvironmentProviders([
    // ...
    DbImpl,
    { provide: POST_REPOSITORY,
      useFactory: (remote, db, logger) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger] },
    { provide: GET_POSTS_USE_CASE,
      useFactory: (repo) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY] },
  ]);
}`,
  consume: `// THIS SCREEN's demo (src/app/views/database_handling/cache-demo.ts) —
// the view resolves the repository via the DI token and switches on Result.
// No DAO, no Dexie, no AppDatabaseImpl import in the view.
@Component({
  providers: [provideDemoCache()],   // component-scoped: REAL AppDatabaseImpl
})                                    //   + a demo remote (toggleable offline)
class CacheDemo {
  private readonly repository = inject(POST_REPOSITORY);   // the SEAM
  readonly admin = inject(DemoCacheAdmin);                 // demo-only controls
  readonly state = signal<DemoState>({ status: 'idle', posts: [] });

  async fetch(): Promise<void> {
    this.state.set({ status: 'loading', posts: [] });
    const result: Result<Post[]> = await this.repository.getPosts();
    if (result.ok) {
      this.state.set({ status: 'success',
        posts: result.value, warning: result.warning });   // warning = stale cache
    } else {
      this.state.set({ status: 'error', posts: [], failure: result.failure });
    }
  }
}`,
  angularVsReact: `Angular vs React sibling — same local-persistence shape, different plumbing:

• Engine — both use IndexedDB via Dexie (same AppDatabase + PostDAO layering,
  same DTO-on-disk, same AppDatabaseException → Failure mapping).
• DI — Angular injects AppDatabase through a provider function (provideData in
  src/data/providers.ts) keyed by InjectionToken; the React guide reaches into a
  hand-rolled container (container.appDatabase). The view NEVER imports the DAO
  in either app — only the repository seam.
• Fakes — both ship an in-memory FakeAppDatabase for dev/tests. Angular's reads
  ScenarioService signals (inject(ScenarioService)); the React guide reads a
  module-level mutable scenario holder.
• Connectivity fallback — identical offline-first matrix: cache hit →
  Success+warning; cache miss → Failed (blocking); cache read fails → chained
  Critical CacheFailure. See the API-handling screen for the live end-to-end
  drive of the full pipeline.`,
};

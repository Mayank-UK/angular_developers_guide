import {
  InjectionToken,
  Injectable,
  type Provider,
  inject,
} from '@angular/core';
import { Logger } from '../../../core/config/logger';
import { POST_REPOSITORY } from '../../../core/di/tokens';
import { NetworkException } from '../../../core/error-handling/exceptions';
import { PostRepositoryImpl } from '../../../data/repositories/post-repository-impl';
import {
  AppDatabaseImpl,
  type AppDatabase,
} from '../../../data/local/app-database';
import type { PostRemoteDataSource } from '../../../data/remote/post-api.service';
import type { PostDTO } from '../../../data/remote/post-dto';

/**
 * Component-scoped DI wiring for the Database-handling screen's live demo.
 *
 * Mirrors `src/data/providers.ts` (the app-wide `provideData`) at the demo
 * scale: it binds the {@link POST_REPOSITORY} token to the REAL
 * {@link PostRepositoryImpl}, backed by the REAL {@link AppDatabaseImpl} (Dexie
 * + the real `PostDAO` → real IndexedDB in the browser; in-memory fallback when
 * IndexedDB is absent), and a tiny {@link DemoRemoteDataSource} whose
 * online/offline state the demo can toggle.
 *
 * The view component injects only the {@link POST_REPOSITORY} token (the seam)
 * and the {@link DemoCacheAdmin} helper — it NEVER imports Dexie, the `PostDAO`,
 * `AppDatabaseImpl`, or `PostRepositoryImpl`. Those live HERE, in the demo's
 * wiring, exactly as the app-wide `AppDatabaseImpl`/`PostRepositoryImpl` live in
 * `src/data/`. The data-layer concretes do not leak into the view.
 */

/** Component-local token for the real AppDatabaseImpl instance (shared by the
 * repository and the DemoCacheAdmin so they talk to the SAME store). */
const DEMO_APP_DATABASE = new InjectionToken<AppDatabase>('DEMO_APP_DATABASE');

/** Component-local token for the demo remote data source. */
const DEMO_REMOTE = new InjectionToken<DemoRemoteDataSource>('DEMO_REMOTE');

/**
 * DemoRemoteDataSource — a tiny stand-in for the live remote source. Returns
 * canned {@link PostDTO} posts after a short delay, or throws a typed
 * {@link NetworkException} when the demo flips it "offline". Because it throws a
 * TYPED AppException, the real {@link PostRepositoryImpl} routes it straight to
 * `onNetworkError` → `serveFromCache` — the genuine offline-first fallback.
 */
export class DemoRemoteDataSource implements PostRemoteDataSource {
  /** Flipped by the demo's "go offline / online" control. */
  offline = false;

  private readonly posts: readonly PostDTO[] = [
    {
      id: 101,
      title: 'Cached post one',
      body: 'Written to IndexedDB through the real PostDAO on a successful fetch.',
    },
    {
      id: 102,
      title: 'Survives the reload',
      body: 'Persisted by Dexie. Reload the page — the rows are still there.',
    },
    {
      id: 103,
      title: 'Served when the network fails',
      body: 'The repository falls back to this cache and warns the user.',
    },
  ];

  async getPosts(): Promise<PostDTO[]> {
    await delay(450);
    if (this.offline) {
      // A typed AppException — the repository maps it to a NetworkFailure and
      // triggers serveFromCache. The demo view never sees "DexieError" or any
      // engine concept; only Result<Post[]>.
      throw new NetworkException('Demo remote is offline (simulated)');
    }
    return this.posts.map((p) => ({ ...p }));
  }
}

/**
 * DemoCacheAdmin — a view-facing helper that exposes demo-only controls over the
 * SAME {@link AppDatabase} the repository uses. The view cannot clear the cache
 * through the `PostRepository` seam (the repository manages cache lifetime
 * internally — by design), so this admin is the demo's escape hatch for showing
 * the cache-miss path. It deliberately exposes only `clearCache` + an engine
 * readout — NOT the underlying DAO/Dexie table.
 */
@Injectable()
export class DemoCacheAdmin {
  private readonly db = inject(DEMO_APP_DATABASE);
  private readonly remote = inject(DEMO_REMOTE);

  /** Human-readable label for which storage engine the real AppDatabaseImpl
   * resolved to in THIS environment. IndexedDB is absent in jsdom/SSR, so the
   * app degrades to the in-memory fallback there — same code path. */
  readonly engine: 'IndexedDB (Dexie)' | 'in-memory fallback' =
    typeof indexedDB !== 'undefined'
      ? 'IndexedDB (Dexie)'
      : 'in-memory fallback';

  clearCache(): Promise<void> {
    return this.db.clearPosts();
  }

  goOffline(): void {
    this.remote.offline = true;
  }

  goOnline(): void {
    this.remote.offline = false;
  }

  isOffline(): boolean {
    return this.remote.offline;
  }
}

/**
 * The component-scoped provider set for the demo. Binds {@link POST_REPOSITORY}
 * to the REAL {@link PostRepositoryImpl} using the REAL {@link AppDatabaseImpl}
 * + the {@link DemoRemoteDataSource}. The demo component lists this in its
 * `providers`, overriding the app-wide wiring for its subtree only — the rest
 * of the app is unaffected.
 */
export function provideDemoCache(): Provider[] {
  return [
    // The REAL Dexie connection (owns the real PostDAO). One instance shared
    // across the repository + the DemoCacheAdmin below.
    { provide: DEMO_APP_DATABASE, useClass: AppDatabaseImpl },
    { provide: DEMO_REMOTE, useClass: DemoRemoteDataSource },
    DemoCacheAdmin,
    {
      provide: POST_REPOSITORY,
      useFactory: (
        remote: PostRemoteDataSource,
        db: AppDatabase,
        logger: Logger,
      ) => new PostRepositoryImpl(remote, db, logger),
      deps: [DEMO_REMOTE, DEMO_APP_DATABASE, Logger],
    },
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

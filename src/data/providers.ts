import {
  EnvironmentProviders,
  makeEnvironmentProviders,
  Provider,
  Type,
} from '@angular/core';
import type { AppConfig } from '../core/config/app-config';
import { Logger } from '../core/config/logger';
import {
  APP_CONFIG,
  GET_POSTS_USE_CASE,
  POST_REPOSITORY,
} from '../core/di/tokens';
import type { PostRepository } from '../domain/repositories/post-repository';
import { GetPostsUseCase } from '../domain/usecases/get-posts-usecase';
import { PostRepositoryImpl } from './repositories/post-repository-impl';
import {
  PostApiService,
  type PostRemoteDataSource,
} from './remote/post-api.service';
import { FakeApiService } from './fake/fake-api-service';
import { AppDatabaseImpl, type AppDatabase } from './local/app-database';
import { FakeAppDatabase } from './fake/fake-app-database';

/**
 * Value-based introspection of what the DI graph actually wired, so UI readouts
 * (e.g. the Dependency-management screen) can show "fake" vs "live" without
 * `instanceof`-checking data-layer classes — preserving the invariant that
 * `ui/` never couples to `data/` internals. Mirrors the React guide's
 * `container.getWiring()`.
 */
export function getWiring(config: AppConfig): {
  remote: 'fake' | 'live';
  db: 'fake' | 'live';
} {
  return { remote: config.wiring.remote, db: config.wiring.db };
}

/**
 * provideData — the Angular equivalent of the React guide's
 * `container.initialize()`. Registers `APP_CONFIG`, the `Logger`, and wires
 * fake-vs-live sources for the remote + local slots based on `config.wiring`,
 * then binds the `PostRepository` and `GetPostsUseCase` contracts.
 *
 * HttpClient is intentionally NOT provided here: the fake path needs no HTTP,
 * and the live path consumes `provideHttpClient(...)` registered in
 * `app.config.ts` (which also installs the retry interceptor).
 */
export function provideData(config: AppConfig): EnvironmentProviders {
  const useFakeRemote = config.wiring.remote === 'fake';
  const useFakeDb = config.wiring.db === 'fake';

  const RemoteImpl: Type<PostRemoteDataSource> = useFakeRemote
    ? FakeApiService
    : PostApiService;
  const DbImpl: Type<AppDatabase> = useFakeDb
    ? FakeAppDatabase
    : AppDatabaseImpl;

  const providers: Provider[] = [
    { provide: APP_CONFIG, useValue: config },
    {
      provide: Logger,
      useFactory: () => new Logger(config.name, !config.production),
    },
    RemoteImpl,
    DbImpl,
    {
      provide: POST_REPOSITORY,
      useFactory: (
        remote: PostRemoteDataSource,
        db: AppDatabase,
        logger: Logger,
      ) => new PostRepositoryImpl(remote, db, logger),
      deps: [RemoteImpl, DbImpl, Logger],
    },
    {
      provide: GET_POSTS_USE_CASE,
      useFactory: (repo: PostRepository) => new GetPostsUseCase(repo),
      deps: [POST_REPOSITORY],
    },
  ];

  return makeEnvironmentProviders(providers);
}

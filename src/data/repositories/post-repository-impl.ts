import { Logger } from '../../core/config/logger';
import { failed, success } from '../../core/result';
import {
  AppDatabaseException,
  AppException,
} from '../../core/error-handling/exceptions';
import {
  forwardNetworkFailure,
  mapExceptionToFailure,
  safeRepositoryCall,
} from '../../core/error-handling/guards';
import {
  CacheFailure,
  FailureSeverity,
} from '../../core/error-handling/failure';
import type { Post } from '../../domain/models/post';
import type { PostRepository } from '../../domain/repositories/post-repository';
import type { AppDatabase } from '../local/app-database';
import type { PostRemoteDataSource } from '../remote/post-api.service';
import { dtoToPost } from '../remote/post-dto';

/**
 * PostRepositoryImpl — orchestrates remote + local sources and implements the
 * offline-first fallback strategy. Mirrors the React/Flutter `PostRepositoryImpl`.
 *
 * Flow:
 *   1. Fetch from the remote source.
 *   2. Cache the result locally (best-effort; a cache write failure is only
 *      logged, never surfaced to the user).
 *   3. On network/server failure, fall back to the local cache:
 *        - cache hit  → Success(posts, warning = networkFailure)   [non-blocking]
 *        - cache miss → Failed(networkFailure)                      [blocking]
 *        - cache read fails → Failed(CacheFailure ← networkFailure) [blocking, chained]
 */
export class PostRepositoryImpl implements PostRepository {
  private readonly remote: PostRemoteDataSource;
  private readonly local: AppDatabase;
  private readonly logger: Logger;

  constructor(
    remote: PostRemoteDataSource,
    local: AppDatabase,
    logger: Logger,
  ) {
    this.remote = remote;
    this.local = local;
    this.logger = logger;
  }

  async getPosts() {
    return safeRepositoryCall<Post[]>({
      logger: this.logger,
      call: async () => {
        const remotePosts = await this.remote.getPosts();
        try {
          await this.local.insertPosts(remotePosts);
        } catch (e) {
          this.logger.warning('Failed to cache posts', e);
        }
        return remotePosts.map(dtoToPost);
      },
      onNetworkError: (cause) => this.serveFromCache(cause),
      onServerError: (cause) => this.serveFromCache(cause),
    });
  }

  /** Cache fallback shared by network + server error paths. */
  private async serveFromCache(cause: AppException) {
    this.logger.warning(
      `Remote fetch failed (${cause.constructor.name}), falling back to cache`,
    );

    const upstreamFailure = mapExceptionToFailure(cause);

    try {
      const cached = await this.local.getPosts();
      if (cached.length > 0) {
        // Non-blocking: show stale data, warn the user.
        return success(cached.map(dtoToPost), upstreamFailure);
      }
      // No cache → surface the original upstream failure (blocking).
      return forwardNetworkFailure(cause);
    } catch (e) {
      const dbError =
        e instanceof AppDatabaseException
          ? e
          : new AppDatabaseException('Cache read failed', { cause: e });
      // Build the chained CacheFailure once — it is both the logged value and
      // the returned failure. Critical because the cache was the last resort.
      const chained = new CacheFailure(
        dbError.message,
        upstreamFailure,
        FailureSeverity.Critical,
      );
      this.logger.error(`Cache fallback also failed:\n${chained.chain}`);
      return failed(chained);
    }
  }
}

import type { Table } from 'dexie';
import { AppDatabaseException } from '../../core/error-handling/exceptions';
import { stringify } from '../../core/error-handling/stringify';
import {
  postDtoFromJson,
  type PostDTO,
} from '../remote/post-dto';

/**
 * PostDAO — direct data-access operations for the `posts` table. Mirrors the
 * React/Flutter guide's `data/local/daos/post_dao.dart`. It owns a single Dexie
 * table and upgrades any engine error to an `AppDatabaseException` (which the
 * repository maps to a CacheFailure / DatabaseFailure).
 *
 * DAOs work with DTOs (the on-disk shape), never domain models — that mapping
 * happens one layer up, in the repository.
 */
export class PostDAO {
  private readonly posts: Table<PostDTO, number>;

  constructor(posts: Table<PostDTO, number>) {
    this.posts = posts;
  }

  async insertAll(posts: PostDTO[]): Promise<void> {
    try {
      await this.posts.bulkPut(posts);
    } catch (e) {
      throw new AppDatabaseException(`Failed to cache posts: ${stringify(e)}`, {
        cause: e,
      });
    }
  }

  async getAll(): Promise<PostDTO[]> {
    try {
      const rows = await this.posts.toArray();
      return rows.map((r) =>
        postDtoFromJson(r as unknown as Record<string, unknown>),
      );
    } catch (e) {
      throw new AppDatabaseException(`Failed to read posts: ${stringify(e)}`, {
        cause: e,
      });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.posts.clear();
    } catch (e) {
      throw new AppDatabaseException(`Failed to clear posts: ${stringify(e)}`, {
        cause: e,
      });
    }
  }
}

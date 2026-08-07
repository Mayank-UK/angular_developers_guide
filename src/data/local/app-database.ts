import Dexie, { type Table } from 'dexie';
import type { PostDTO } from '../remote/post-dto';
import { PostDAO } from './post-dao';

/**
 * AppDatabase — the local persistence layer, backed by IndexedDB via Dexie.
 * Mirrors the React/Flutter guide's `AppDatabase` (abstract contract) +
 * `AppDatabaseImpl` (the concrete connection that owns DAOs and delegates to
 * them). This file is the connection/schema provider; per-table queries live in
 * `post-dao.ts`, matching how the remote layer separates HTTP client from the
 * remote data source.
 *
 * Dexie stores plain JSON-shaped objects directly, so PostDTO is both the
 * in-memory and on-disk shape.
 *
 * Safety: Dexie/IndexedDB may be unavailable in some test contexts (e.g. a
 * Node/jsdom run without `fake-indexeddb`). `AppDatabaseImpl` detects that
 * (via `typeof indexedDB`) and degrades to an in-memory store instead of
 * throwing at construction, so DI never blows up when the DB engine is absent.
 */
export abstract class AppDatabase {
  abstract insertPosts(posts: PostDTO[]): Promise<void>;
  abstract getPosts(): Promise<PostDTO[]>;
  abstract clearPosts(): Promise<void>;
}

export class AppDatabaseImpl extends Dexie implements AppDatabase {
  private readonly postDAO?: PostDAO;
  private readonly dexieAvailable: boolean;
  private memory: PostDTO[] = [];

  constructor() {
    super('app_database');
    this.dexieAvailable = typeof indexedDB !== 'undefined';
    if (this.dexieAvailable) {
      try {
        this.version(1).stores({
          // `id` is the natural primary key (not auto-incremented).
          posts: 'id, title',
        });
        const posts = this.table<PostDTO, number>('posts');
        this.postDAO = new PostDAO(posts);
      } catch {
        // Schema setup failed — fall back to the in-memory store.
        this.dexieAvailable = false;
      }
    }
  }

  async insertPosts(posts: PostDTO[]): Promise<void> {
    if (this.dexieAvailable && this.postDAO) {
      await this.postDAO.insertAll(posts);
      return;
    }
    this.memory = [...posts];
  }

  async getPosts(): Promise<PostDTO[]> {
    if (this.dexieAvailable && this.postDAO) {
      return this.postDAO.getAll();
    }
    return [...this.memory];
  }

  async clearPosts(): Promise<void> {
    if (this.dexieAvailable && this.postDAO) {
      await this.postDAO.clear();
      return;
    }
    this.memory = [];
  }
}

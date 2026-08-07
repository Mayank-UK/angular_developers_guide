import { inject, Injectable } from '@angular/core';
import { ScenarioService } from '../../core/scenario/scenario.service';
import { AppDatabaseException } from '../../core/error-handling/exceptions';
import { AppDatabase } from '../local/app-database';
import type { PostDTO } from '../remote/post-dto';

/**
 * FakeAppDatabase — dev-only in-memory implementation of the local database.
 * Mirrors the React/Flutter guide's `FakeAppDatabase`. Lets the
 * Database-handling and Exception-handling screens simulate cache write/read
 * failures without a real IndexedDB store.
 *
 * Uses the single `injectDbFailure` toggle for both reads and writes (the
 * Angular environment exposes one DB failure flag, vs. the React guide's split
 * read/write scenarios).
 */
@Injectable()
export class FakeAppDatabase extends AppDatabase {
  private readonly scenario = inject(ScenarioService);
  private store: PostDTO[] = [];

  async insertPosts(posts: PostDTO[]): Promise<void> {
    await delay(100);
    if (this.scenario.shouldInjectDbFailure()) {
      throw new AppDatabaseException('Simulated cache write failed');
    }
    this.store = [...posts];
  }

  async getPosts(): Promise<PostDTO[]> {
    await delay(100);
    if (this.scenario.shouldInjectDbFailure()) {
      throw new AppDatabaseException('Simulated cache read failed');
    }
    return [...this.store];
  }

  async clearPosts(): Promise<void> {
    await delay(100);
    this.store = [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

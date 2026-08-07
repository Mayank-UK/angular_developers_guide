import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ShowError } from '../../../ui/components/show-error/show-error';
import { POST_REPOSITORY } from '../../../core/di/tokens';
import type { Post } from '../../../domain/models/post';
import type { Result } from '../../../core/result';
import type { Failure } from '../../../core/error-handling/failure';
import { provideDemoCache, DemoCacheAdmin } from './demo-cache-wiring';

/**
 * CacheDemo — the CENTERPIECE of the Database-handling screen.
 *
 * Reads and writes the local store through the REAL data pipeline: it injects
 * the {@link POST_REPOSITORY} DI token and calls `getPosts()`. Because the
 * component-scoped {@link provideDemoCache} wiring binds that token to the REAL
 * `PostRepositoryImpl` backed by the REAL `AppDatabaseImpl` (Dexie + the real
 * `PostDAO`), every read/write hits the genuine local-persistence layer — the
 * view never imports a DAO, Dexie, or `AppDatabaseImpl`.
 *
 * The demo walks all four quadrants of the offline-first matrix:
 *   1. online + fetch  → remote 200, write-through to IndexedDB, Success.
 *   2. online + fetch again → cache refreshed.
 *   3. offline + fetch (cache warm) → cache fallback, Success WITH a
 *      non-blocking warning (the data survived in the DAO).
 *   4. offline + fetch (cache empty) → cache miss, blocking Failed.
 *
 * The {@link DemoCacheAdmin} exposes the demo-only controls (go offline/online,
 * clear cache, engine readout) over the SAME store — without leaking the DAO.
 */
type DemoStatus = 'idle' | 'loading' | 'success' | 'error';

interface DemoState {
  readonly status: DemoStatus;
  readonly posts: readonly Post[];
  /** Non-blocking warning carried by Result.Success when serving stale cache. */
  readonly warning?: Failure;
  /** Blocking failure carried by Result.Failed. */
  readonly failure?: Failure;
}

@Component({
  selector: 'app-database-cache-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShowError],
  providers: provideDemoCache(),
  template: `
    <div class="demo">
      <div class="controls">
        <span class="engine">
          storage engine: <code>{{ admin.engine }}</code>
        </span>

        <button
          type="button"
          class="btn primary"
          (click)="fetch()"
          [disabled]="state().status === 'loading'"
        >
          ↻ fetch posts (through the seam)
        </button>

        <button
          type="button"
          class="btn"
          (click)="toggleConnectivity()"
          [class.is-offline]="offline()"
        >
          {{ offline() ? '● offline' : '○ online' }}
        </button>

        <button type="button" class="btn" (click)="clearCache()">
          clear cache
        </button>
      </div>

      <p class="hint">
        Every fetch calls
        <code>inject(POST_REPOSITORY).getPosts()</code> — never a DAO/Dexie
        import in the view. The repository decides remote-vs-cache.
      </p>

      @switch (state().status) {
        @case ('loading') {
          <p class="status loading" data-testid="cache-loading">
            <span class="spinner" aria-hidden="true"></span>
            Routing through repository → DAO → Dexie…
          </p>
        }
        @case ('error') {
          <div class="err-frame" data-testid="cache-error">
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
            <p class="status warning" data-testid="cache-warning">
              ⚠ {{ state().warning?.message }} — served stale data from the DAO
              (non-blocking Result.Success warning).
            </p>
          } @else {
            <p class="status ok" data-testid="cache-fresh">
              ✓ Fetched fresh from the remote and wrote through to the cache via
              the real PostDAO.
            </p>
          }
          @if (state().posts.length === 0) {
            <p class="status empty">No posts returned.</p>
          } @else {
            <ul class="posts" data-testid="cache-list">
              @for (p of state().posts; track p.id) {
                <li class="post">
                  <p class="title">{{ p.title }}</p>
                  <p class="body">{{ p.body }}</p>
                </li>
              }
            </ul>
          }
          <p class="summary">
            {{ state().posts.length }} post(s) · Result&lt;Post[]&gt; →
            <strong>Success</strong>
            @if (state().warning) {
              <span class="badge">+ warning</span>
            }
          </p>
        }
        @default {
          <p class="status idle">
            Press <em>fetch posts</em>. Then flip <em>offline</em> and fetch
            again — the cache survives in the DAO and is served with a warning.
            Clear the cache while offline to see the blocking cache-miss path.
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
        gap: var(--space-xs);
      }
      .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-xs);
      }
      .engine {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .engine code {
        font-family: var(--font-mono);
        color: var(--color-on-surface);
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
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .btn.primary {
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      .btn.is-offline {
        border-color: var(--color-error);
        color: var(--color-error);
      }
      .hint {
        margin: 0;
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .hint code {
        font-family: var(--font-mono);
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
      .status.ok {
        border-color: var(--color-success, var(--color-primary));
        color: var(--color-on-surface);
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
      .badge {
        display: inline-block;
        margin-left: var(--space-xxs);
        padding: 0 var(--space-xxs);
        border: 1px solid var(--color-primary);
        border-radius: var(--radius-pill);
        color: var(--color-primary);
        font-size: var(--text-overline);
      }
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid var(--color-outline);
        border-top-color: var(--color-primary);
        border-radius: 50%;
        display: inline-block;
        animation: db-spin 0.8s linear infinite;
      }
      @keyframes db-spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
class CacheDemo {
  /** The DI-token seam — the ONLY data dependency the view declares. */
  private readonly repository = inject(POST_REPOSITORY);
  /** Demo-only controls over the shared store (no DAO leak). */
  readonly admin = inject(DemoCacheAdmin);

  readonly state = signal<DemoState>({ status: 'idle', posts: [] });

  /** The demo's connectivity flag. Owned here so OnPush reacts to the toggle;
   *  synced into the DemoRemoteDataSource via the admin so the real repository
   *  sees the same state on the next fetch. */
  readonly offline = signal(false);

  /** Drive the real pipeline: repository → remote + (AppDatabase → DAO) → Result. */
  async fetch(): Promise<void> {
    this.state.set({ status: 'loading', posts: [] });
    const result: Result<Post[]> = await this.repository.getPosts();
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

  toggleConnectivity(): void {
    const next = !this.offline();
    this.offline.set(next);
    if (next) {
      this.admin.goOffline();
    } else {
      this.admin.goOnline();
    }
  }

  async clearCache(): Promise<void> {
    await this.admin.clearCache();
    this.state.set({
      status: 'idle',
      posts: [],
    });
  }
}

export { CacheDemo };

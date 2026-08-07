import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { shareReplay, tap, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { demoApiInterceptor } from './demo-api.interceptor';
import { provideScopedHttpClient } from './scoped-http-client';

/**
 * CachingDemo — a live demonstration of `shareReplay` request dedup.
 *
 * The same cold Observable is subscribed to three times in quick succession.
 * WITHOUT shareReplay, that fires THREE network requests (one per subscriber —
 * that is how cold Observables work). WITH shareReplay({ bufferSize: 1,
 * refCount: true }), the THREE subscriptions share ONE network request and all
 * receive the same cached response.
 *
 * The "request count" below is the number of times the producer function
 * actually ran — flip shareReplay on and off and watch it jump from 1 to 3.
 *
 * (Component-scoped HttpClient + the demoApiInterceptor, same isolation trick
 * as the todo demo. The count is captured by a `tap` in the producer itself.)
 */
let producerRuns = 0;

@Component({
  selector: 'app-rxjs-caching-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="col">
      <div class="row">
        <button type="button" class="btn" (click)="run()">subscribe ×3</button>
        <label class="toggle">
          <input #shareReplayBox type="checkbox" [checked]="useShareReplay()" (change)="useShareReplay.set(shareReplayBox.checked)" />
          wrap with <code>shareReplay</code>
        </label>
        <button type="button" class="btn ghost" (click)="resetCount()">reset count</button>
      </div>
      <p class="readout">
        producer ran <strong>{{ runs() }}</strong> time(s) for 3 subscribers
        · last result: <strong>{{ last() }}</strong>
      </p>
      <p class="hint">
        Without <code>shareReplay</code>: 3 runs (cold Observable re-executes per
        subscriber). With it: 1 run — the single network response is replayed to
        all three. This is the building block of every RxJS-based HTTP cache.
      </p>
    </div>
  `,
  styles: [
    `
      :host { display: block; }
      .col { display: flex; flex-direction: column; gap: var(--space-sm); }
      .row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); }
      .btn {
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        color: var(--color-on-surface);
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        cursor: pointer;
        font-size: var(--text-body-sm);
      }
      .btn:hover { background: var(--color-surface-variant); }
      .btn.ghost { border-style: dashed; }
      .toggle {
        display: flex; align-items: center; gap: var(--space-xs);
        font-size: var(--text-caption); color: var(--color-on-surface-variant);
        cursor: pointer;
      }
      .toggle input { accent-color: var(--color-primary); }
      .readout, .hint { margin: 0; font-size: var(--text-body-sm); color: var(--color-on-surface-variant); }
      .readout strong { color: var(--color-on-surface); }
      .readout code, .hint code { font-family: var(--font-mono); }
    `,
  ],
  providers: [
    // Component-scoped HttpClient with the demo interceptor (see todo-demo.ts
    // + scoped-http-client.ts for the type-safe child-injector approach).
    provideScopedHttpClient([demoApiInterceptor]),
  ],
})
export class CachingDemo {
  private readonly http = inject(HttpClient);

  readonly useShareReplay = signal(true);
  readonly runs = signal(0);
  readonly last = signal('—');

  readonly label = computed(() =>
    this.useShareReplay() ? 'with shareReplay' : 'no shareReplay',
  );

  run(): void {
    producerRuns = 0;
    this.runs.set(0);

    const source$ = this.buildSource$();

    // Subscribe three times — simulating three components (or three reads)
    // wanting the same data at the same moment.
    source$.subscribe((v) => this.last.set(v));
    source$.subscribe((v) => this.last.set(v));
    source$.subscribe((v) => this.last.set(v));

    // producerRuns is mutated synchronously inside the producer for the
    // no-shareReplay path (each subscribe re-runs map/tap immediately), and
    // captured asynchronously otherwise. Read it after a tick to cover latency.
    timer(700).subscribe(() => this.runs.set(producerRuns));
  }

  resetCount(): void {
    producerRuns = 0;
    this.runs.set(0);
    this.last.set('—');
  }

  /**
   * Builds the cold source. The `tap` increments the producer-run counter, so
   * we can SEE how many times the actual work ran. shareReplay is toggled by
   * the checkbox.
   */
  private buildSource$() {
    const base$ = this.http.get<unknown>('/api/todos').pipe(
      tap(() => {
        producerRuns += 1;
      }),
      map(() => `fetched at ${new Date().toLocaleTimeString()}`),
    );
    return this.useShareReplay()
      ? base$.pipe(shareReplay({ bufferSize: 1, refCount: true }))
      : base$;
  }
}

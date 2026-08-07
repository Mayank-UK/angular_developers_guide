import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DemoRequestLog } from './demo-api.interceptor';

/**
 * DemoRequestLogView — the on-screen HTTP request log rendered by the RxJS /
 * server-state todo demo's `loggingInterceptor`.
 *
 * Extracted into its own presentational component for two reasons:
 *  1. Single responsibility — the request log is a self-contained widget (its
 *     own data source, markup, and ~40% of the demo's CSS). Owning it lets the
 *     todo demo stay focused on the query pipeline.
 *  2. Component-style budget — Angular measures component styles per-component,
 *   so a shared inline-styles block big enough to blow the project's
 *   `anyComponentStyle` budget belongs behind its own selector scope rather
 *   than masked by a raised budget.
 *
 * It takes the `DemoRequestLog` as an `input()` (the parent injects the
 * component-scoped instance and passes it down), so it stays a dumb view.
 */
@Component({
  selector: 'app-demo-request-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="log" open>
      <summary>
        HTTP request log
        <span class="muted"
          >({{ entries().length }}) — live, via the loggingInterceptor</span
        >
      </summary>
      @if (entries().length === 0) {
        <p class="muted logempty">no calls yet — refetch or add a todo.</p>
      } @else {
        <table class="logtable">
          <thead>
            <tr>
              <th>#</th>
              <th>method</th>
              <th>url</th>
              <th>status</th>
              <th>ms</th>
              <th>time</th>
            </tr>
          </thead>
          <tbody>
            @for (e of entries(); track e.order) {
              <tr [class.err]="e.outcome === 'error'">
                <td class="ord">{{ e.order }}</td>
                <td><code>{{ e.method }}</code></td>
                <td class="url">{{ e.url }}</td>
                <td class="code">{{ e.code }}</td>
                <td class="ms">{{ e.ms }}</td>
                <td class="at">{{ e.at }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
      <button type="button" class="btn ghost small" (click)="log().reset()">
        clear log
      </button>
    </details>
  `,
  styleUrl: './request-log.scss',
})
export class DemoRequestLogView {
  readonly log = input.required<DemoRequestLog>();
  /** The log entries, re-read as a computed so the template binds signal-style. */
  readonly entries = computed(() => this.log().entries());
}

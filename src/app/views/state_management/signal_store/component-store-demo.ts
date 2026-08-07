import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';

import { CounterStore } from './todos-store/todos.store';

/**
 * ComponentStoreDemo — ONE component-local counter. The `CounterStore` is
 * listed in `providers: [CounterStore]`, so the ANGULAR INJECTOR creates a
 * FRESH instance for EACH `app-signal-store-component-demo` element mounted in
 * the template. The page renders TWO of them side by side — bump the left and
 * the right does NOT move, because each element owns its own store.
 *
 * This is the v21 component-scoped pattern (the older
 * `provideComponentStore(CounterStore)` helper was folded into plain
 * `providers`). Use it for state that should live and die with one component —
 * a form, a widget, a dialog — and the root pattern (`providers: [TodosStore]`
 * in app.config) for app-wide shared state.
 *
 * Lives in its own file (rather than as a non-exported helper inside the view)
 * because the Angular compiler requires a component that declares its own
 * `providers` to be a properly standalone, importable declaration.
 */
@Component({
  selector: 'app-signal-store-component-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CounterStore],
  template: `
    <div class="card">
      <span class="cap">{{ label() }}</span>
      <span class="value">{{ store.count() }}</span>
      <div class="row">
        <button type="button" class="btn primary" (click)="store.inc()">
          +1
        </button>
        <button type="button" class="btn ghost" (click)="store.reset()">
          reset
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-xs);
        border: 1px solid var(--color-outline);
        background: var(--color-surface);
        border-radius: var(--radius-md);
        padding: var(--space-md);
      }
      .cap {
        font-size: var(--text-caption);
        color: var(--color-on-surface-variant);
      }
      .value {
        font-size: var(--text-display-sm);
        font-weight: 700;
        color: var(--color-on-surface);
        font-variant-numeric: tabular-nums;
      }
      .row {
        display: flex;
        gap: var(--space-xs);
      }
      .btn {
        border-radius: var(--radius-md);
        padding: var(--space-xs) var(--space-md);
        font-size: var(--text-body-sm);
        cursor: pointer;
        border: 1px solid transparent;
      }
      .btn.primary {
        background: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-button-card);
      }
      .btn.primary:hover {
        background: var(--color-primary-container);
      }
      .btn.ghost {
        border-color: var(--color-outline);
        color: var(--color-on-surface);
        background: transparent;
      }
      .btn.ghost:hover {
        background: var(--color-surface-variant);
      }
    `,
  ],
})
export class ComponentStoreDemo {
  /** A FRESH store per element — `providers: [CounterStore]` above. */
  readonly store = inject(CounterStore);

  /** "Counter A" / "Counter B" — so the side-by-side pair is legible. */
  readonly label = input<string>('Counter');
}

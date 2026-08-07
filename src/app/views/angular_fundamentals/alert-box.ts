import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * AlertBox — the component created dynamically in the "dynamic components"
 * section of the Angular fundamentals screen.
 *
 * It is intentionally tiny: a single `input()` for its message and a token-
 * driven surface. It is NOT referenced by any template statically — the screen
 * builds it imperatively with `ViewContainerRef.createComponent(...)`, which is
 * the whole point of that section.
 */
@Component({
  selector: 'app-alert-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="alert">
      <span class="dot" aria-hidden="true"></span>
      <span class="msg">{{ message() }}</span>
    </div>
  `,
  styles: [
    `
      .alert {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-outline);
        background-color: var(--color-surface-tint);
        color: var(--color-on-surface);
        font-size: var(--text-body-sm);
      }
      .dot {
        height: 8px;
        width: 8px;
        border-radius: var(--radius-pill);
        background-color: var(--color-secondary);
      }
    `,
  ],
})
export class AlertBox {
  readonly message = input<string>('Dynamic content');
}

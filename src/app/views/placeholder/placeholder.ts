import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * PlaceholderView — temporary body for routes whose full content arrives in a
 * later task. Mirrors the react `<PlaceholderView/>`. Renders inside the
 * SectionWrapper/TextBlock primitives so the visual language stays consistent
 * even for stubs.
 */
@Component({
  selector: 'app-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="placeholder">
      <p class="note">
        @if (phase()) {
          <span>Coming in {{ phase() }}.</span>
        }
        The architecture foundation is in place — this screen's content lands in
        a later task.
      </p>
    </div>
  `,
  styles: [
    `
      .placeholder {
        border-radius: var(--radius-lg);
        border: 1px dashed var(--color-outline);
        padding: var(--space-lg);
        text-align: center;
      }
      .note {
        margin: 0;
        font-size: var(--text-body);
        color: var(--color-on-surface-variant);
      }
    `,
  ],
})
export class PlaceholderView {
  /** Where this lands in the phased build (e.g. "M2"). */
  readonly phase = input<string>('');
}

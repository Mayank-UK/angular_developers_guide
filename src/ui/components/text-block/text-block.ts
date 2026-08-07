import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * TextBlock — a full-width paragraph of body text. Mirrors the react
 * `<TextBlock/>`. Kept string-only so multi-line examples render predictably
 * (whitespace preserved via `white-space: pre-line`).
 *
 * Generous line-height (1.7) and the muted variant color give body copy room to
 * breathe and read as secondary to headings.
 */
@Component({
  selector: 'ui-text-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="text">{{ text() }}</p>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .text {
        margin: 0;
        width: 100%;
        font-size: var(--text-body);
        line-height: 1.7;
        color: var(--color-on-surface-variant);
        white-space: pre-line;
      }
    `,
  ],
})
export class TextBlock {
  readonly text = input.required<string>();
}

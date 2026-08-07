import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * ContentGroupWrapper — a sub-grouping label inside a section. Mirrors the
 * react `<ContentGroupWrapper/>`.
 *
 * Visual role: one step below the section title. Rendered as an overline
 * (uppercase, letter-spaced, muted) so the hierarchy reads clearly:
 * section title -> overline label -> body/code/example.
 */
@Component({
  selector: 'ui-content-group-wrapper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-group-wrapper.html',
  styleUrl: './content-group-wrapper.scss',
})
export class ContentGroupWrapper {
  readonly title = input.required<string>();
}

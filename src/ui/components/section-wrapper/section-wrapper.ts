import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * SectionWrapper — a titled, surface-tinted block grouping related content.
 * Mirrors the react `<SectionWrapper/>`.
 *
 * Visual role: the primary structural unit of a page. The title carries a
 * coloured accent bar so sections are scannable, and there's generous vertical
 * breathing room between siblings so long pages don't read as a wall.
 */
@Component({
  selector: 'ui-section-wrapper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section-wrapper.html',
  styleUrl: './section-wrapper.scss',
})
export class SectionWrapper {
  readonly title = input.required<string>();
}

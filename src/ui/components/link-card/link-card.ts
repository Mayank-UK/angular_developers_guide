import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * LinkCard — a navigation card: title + optional description + a router link.
 * Used by the hub screens to render their sub-screen grids.
 *
 * The item shape is defined locally (not imported from `domain/`) so the UI
 * layer stays decoupled from the data layer. Hubs pass plain objects.
 */
export interface LinkCardItem {
  readonly title: string;
  readonly route: string;
  readonly description?: string;
}

@Component({
  selector: 'ui-link-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './link-card.html',
  styleUrl: './link-card.scss',
})
export class LinkCard {
  readonly item = input.required<LinkCardItem>();
}
